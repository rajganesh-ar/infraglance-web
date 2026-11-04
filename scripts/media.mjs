// Encodes raw stock media into web formats and writes the manifest.
//
//   node scripts/media.mjs                 photos + videos (skips outputs that already exist)
//   node scripts/media.mjs --photos        photos only          (--videos: videos only)
//   node scripts/media.mjs --only=a,b      just these keys
//   node scripts/media.mjs --clean         afterwards, delete files in public/media/{p,v}
//                                          that the manifest no longer references
//   node scripts/media.mjs --force         re-encode even when the output files exist
//
// Input:  assets/credits.json + assets/raw/{photos,video}/<key>.*
// Output: public/media/{p,v}/…  and  src/data/media.json
//
// House grade (GRADE_VERSION): every asset is analysed (luminance, colourfulness, cast, contrast,
// orange share) and gets its own bounded correction so the library reads as one brand that sits on
// the site palette: white balance pulled part-way to neutral-cool (highlights protected, so clipped
// whites stay white), exposure and contrast pulled toward a house target, saturation normalised
// with a soft knee and extra restraint on saturated orange, cool split-tone in the shadows only and
// blacks landing on the site ink (#05070B). The grade is baked into one 65³ 3D LUT per asset and
// applied with the same tetrahedral interpolation to photos (here, in JS) and video (ffmpeg lut3d),
// so a poster and its clip match. credits.json `grade`: "none" (skip, e.g. false-colour thermal) or
// "soft" (half strength, for imagery where colour carries meaning) or "cool" (warm/sepia frames
// pulled harder toward the cool palette; see coolGrade).
// credits.json `pos` (optional): the focal point as CSS object-position (e.g. "50% 15%"), copied to
// the manifest as-is; <Picture>/<Video> use it so wide and portrait crops keep heads in frame.
// A pos-only change needs no re-encode: `node scripts/media.mjs --only=<key>` rewrites the entry.
//
// Photos: AVIF q52 + JPEG q80 (mozjpeg) at 640–2600 px.
// Videos: ≤10 s, 25 fps, seamless 0.6 s cross-dissolve loop (never dips to black), H.264 + VP9 at
//         1920/1280, BT.709 tagged. Poster = the clip's first frame from the same graded chain
//         (not graded twice).
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_P = 'public/media/p';
const OUT_V = 'public/media/v';
const MANIFEST = 'src/data/media.json';
const PHOTO_WIDTHS = [640, 960, 1280, 1920, 2600];
const POSTER_WIDTHS = [640, 1280, 1920];
const FPS = 25;
const LOOP_FRAMES = 15; // 0.6 s cross-dissolve from the clip's end back into its start

/* ------------------------------------------------------------------------------------------ */
/* House grade                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export const GRADE_VERSION = 'g3';
export const LUT_N = 65;
const W709 = [0.2126, 0.7152, 0.0722];
/** Blacks land on the site ink (--ink #05070B), so dark image areas meet dark sections seamlessly. */
const INK = [5 / 255, 7 / 255, 11 / 255];
/** Neutral-preserving cross-mix (rows sum to 1): orange leans amber, blue leans teal. */
const BASE = [
  [0.965, 0.035, 0.0],
  [0.015, 0.97, 0.015],
  [0.0, 0.035, 0.965],
];
/** Cool split-tone added to shadows only (fades out by mid-grey; highlights stay neutral). */
const TINT = [-0.011, 0.002, 0.015];
/** Where the house grade pulls every asset (sRGB-encoded measures on the graded output). */
export const TARGET = {
  Y: 0.45, // mean Rec.709 luma
  chroma: 0.105, // mean (max − min), i.e. colourfulness
  C: 0.215, // luma standard deviation (global contrast)
  exposurePull: 0.55, // fraction of the way (in log luma) toward TARGET.Y
};
const WB_TARGET = [0.985, 1, 1.02]; // linear R:G:B the neutrals are pulled toward (slightly cool)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toEnc = (l) => (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
const hueOf = (r, g, b, mx, d) => {
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};

/** One pixel through the grade. r,g,b in 0–1 sRGB-encoded; writes into out[0..2]. */
export function gradePixel(r, g, b, P, out) {
  // 1. White balance in linear light; protected near clipping so whites never pick up a tint.
  const mx0 = Math.max(r, g, b);
  const hp = 1 - smooth(0.72, 1.0, mx0);
  r = toEnc(Math.min(1, toLin(r) * (1 + (P.wb[0] - 1) * hp)));
  g = toEnc(Math.min(1, toLin(g) * (1 + (P.wb[1] - 1) * hp)));
  b = toEnc(Math.min(1, toLin(b) * (1 + (P.wb[2] - 1) * hp)));
  // 2. Neutral-preserving cross-mix.
  let R = BASE[0][0] * r + BASE[0][1] * g + BASE[0][2] * b;
  let G = BASE[1][0] * r + BASE[1][1] * g + BASE[1][2] * b;
  let B = BASE[2][0] * r + BASE[2][1] * g + BASE[2][2] * b;
  // 3. Tone: exposure (power curve, fixed end points) then contrast (blend toward smoothstep).
  const tone = (x) => {
    x = clamp(x, 0, 1) ** P.gamma;
    return x + P.contrast * (x * x * (3 - 2 * x) - x);
  };
  R = tone(R);
  G = tone(G);
  B = tone(B);
  // 4. Saturation around Rec.709 luma: global factor, soft knee on strong colour, extra on orange.
  const Y = W709[0] * R + W709[1] * G + W709[2] * B;
  const mx = Math.max(R, G, B);
  const d = mx - Math.min(R, G, B);
  let f = P.sat;
  if (d > 1e-4) {
    if (P.orange > 0) {
      const h = hueOf(R, G, B, mx, d);
      const wh = 1 - smooth(0, 1, Math.abs(h - 30) / 24);
      f *= 1 - P.orange * wh * smooth(0.12, 0.42, d);
    }
    const c = d * f;
    const K = 0.32;
    if (c > K) f *= (K + (c - K) * 0.7) / c;
  }
  R = Y + (R - Y) * f;
  G = Y + (G - Y) * f;
  B = Y + (B - Y) * f;
  // 5. Cool shadows (zero at black and above mid-grey), 6. blacks onto the site ink.
  const w = P.tint * smooth(0.0, 0.08, Y) * (1 - smooth(0.12, 0.55, Y));
  out[0] = INK[0] + (1 - INK[0]) * clamp(R + TINT[0] * w, 0, 1);
  out[1] = INK[1] + (1 - INK[1]) * clamp(G + TINT[1] * w, 0, 1);
  out[2] = INK[2] + (1 - INK[2]) * clamp(B + TINT[2] * w, 0, 1);
}

/** Stats over a packed RGB (uint8) buffer: the measures the grade normalises. */
export function analysePixels(px) {
  const n = px.length / 3;
  let Y = 0, Y2 = 0, S = 0, CH = 0, RB = 0, O = 0;
  let nr = 0, ng = 0, nb = 0, nn = 0, ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < px.length; i += 3) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const y = W709[0] * r + W709[1] * g + W709[2] * b;
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    Y += y;
    Y2 += y * y;
    S += mx === 0 ? 0 : d / mx;
    CH += d;
    RB += r - b;
    if (d > 0.12 && d / mx > 0.35) {
      const h = hueOf(r, g, b, mx, d);
      if (h >= 10 && h <= 50) O++;
    }
    if (y > 0.05 && y < 0.95) {
      const lr = toLin(r), lg = toLin(g), lb = toLin(b);
      ar += lr; ag += lg; ab += lb; an++;
      if (d < 0.2 && y > 0.08 && y < 0.9) { nr += lr; ng += lg; nb += lb; nn++; }
    }
  }
  const m = Y / n;
  return {
    Y: m,
    S: S / n,
    chroma: CH / n,
    RB: RB / n,
    O: O / n,
    C: Math.sqrt(Math.max(0, Y2 / n - m * m)),
    // linear mean of the near-neutral pixels (grey-world fallback when there are too few)
    neutral: nn > n * 0.03 ? [nr / nn, ng / nn, nb / nn] : an ? [ar / an, ag / an, ab / an] : [1, 1, 1],
    neutralShare: nn / n,
  };
}

const round = (x, d = 4) => +x.toFixed(d);

function gradeBuffer(px, P) {
  const out = Buffer.allocUnsafe(px.length);
  const o = [0, 0, 0];
  for (let i = 0; i < px.length; i += 3) {
    gradePixel(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, P, o);
    out[i] = Math.round(o[0] * 255);
    out[i + 1] = Math.round(o[1] * 255);
    out[i + 2] = Math.round(o[2] * 255);
  }
  return out;
}

/**
 * Works out one asset's grade parameters from a small RGB thumbnail (packed uint8).
 * mode: 'auto' | 'soft'. Returns plain JSON (it is hashed into the output file names).
 */
export function solveGrade(px, mode = 'auto') {
  const soft = mode === 'soft';
  const a = analysePixels(px);
  // White balance: partial pull of the near-neutral mean toward WB_TARGET, bounded, with less
  // room to warm (the brand leans cool) than to cool. Normalised to keep grey luminance.
  const [mr, mg, mb] = a.neutral;
  // grey-world (few neutral pixels, e.g. a sodium-lit tunnel) is less trustworthy: pull less
  const s = (soft ? 0.6 : 1) * (a.neutralShare > 0.03 ? 0.5 : 0.3);
  const gr = clamp(((WB_TARGET[0] * mg) / Math.max(mr, 1e-4)) ** s, 0.92, 1.025);
  const gb = clamp(((WB_TARGET[2] * mg) / Math.max(mb, 1e-4)) ** s, 0.975, 1.09);
  const nrm = W709[0] * gr + W709[1] + W709[2] * gb;
  const wb = [gr / nrm, 1 / nrm, gb / nrm];
  const P = { v: GRADE_VERSION, mode, wb, gamma: 1, contrast: 0.1, sat: 1, orange: soft ? 0 : clamp((a.O - 0.04) * 0.5, 0, 0.1), tint: soft ? 0.6 : 1 };
  const targetY = Math.exp(Math.log(Math.max(a.Y, 0.02)) * (1 - TARGET.exposurePull) + Math.log(TARGET.Y) * TARGET.exposurePull);
  const solveGamma = () => {
    let lo = 0.72, hi = 1.32;
    for (let k = 0; k < 14; k++) {
      P.gamma = (lo + hi) / 2;
      const y = analysePixels(gradeBuffer(px, P)).Y;
      if (y > targetY) lo = P.gamma;
      else hi = P.gamma;
    }
    P.gamma = (lo + hi) / 2;
  };
  for (let pass = 0; pass < 2; pass++) {
    solveGamma();
    // contrast: house amount, nudged toward the target spread (measured with contrast off)
    const c0 = P.contrast;
    P.contrast = 0;
    const C = analysePixels(gradeBuffer(px, P)).C;
    P.contrast = clamp(0.1 + 2.0 * (TARGET.C - C), -0.06, 0.3);
    if (pass === 0) P.contrast = (P.contrast + c0) / 2;
    // saturation: factor that brings colourfulness toward the target; never boosts
    const sat0 = P.sat;
    P.sat = 1;
    const ch = analysePixels(gradeBuffer(px, P)).chroma;
    P.sat = clamp((TARGET.chroma / Math.max(ch, 1e-3)) ** 0.7, soft ? 0.8 : 0.68, 0.97);
    if (pass === 0) P.sat = (P.sat + sat0) / 2;
  }
  solveGamma();
  return { ...P, wb: P.wb.map((x) => round(x)), gamma: round(P.gamma), contrast: round(P.contrast), sat: round(P.sat), orange: round(P.orange), a: { Y: round(a.Y, 3), S: round(a.S, 3), RB: round(a.RB, 3), O: round(a.O, 3), C: round(a.C, 3) } };
}

/**
 * credits.json grade "cool": for warm or sepia frames that the auto grade leaves off-palette
 * (e.g. sodium-lit or sun-baked concrete). Starts from the auto solution, then pulls white balance
 * further toward neutral-cool and lowers the saturation floor. Kept outside GRADE_FP on purpose:
 * adding it does not rename the rest of the library, and P (hashed into the file names) carries
 * its result, so any change here still re-encodes the assets that use it.
 */
function coolGrade(px) {
  const P = solveGrade(px, 'auto');
  const r = P.wb[0] / P.wb[1], b = P.wb[2] / P.wb[1];
  const gr = clamp(r ** 1.6, 0.88, 1.025);
  const gb = clamp(b ** 1.6, 0.975, 1.12);
  const nrm = W709[0] * gr + W709[1] + W709[2] * gb;
  return { ...P, mode: 'cool', wb: [gr / nrm, 1 / nrm, gb / nrm].map((x) => round(x)), sat: round(clamp(P.sat * 0.86, 0.58, 0.97)), orange: round(Math.min(0.14, P.orange + 0.04)) };
}
const pickGrade = (px, mode) => (mode === 'cool' ? coolGrade(px) : solveGrade(px, mode === 'soft' ? 'soft' : 'auto'));

/** 3D LUT of the grade: Float32Array, index ((r·N + g)·N + b)·3 (same lattice as ffmpeg lut3d). */
export function buildLut(P, N = LUT_N) {
  const lut = new Float32Array(N * N * N * 3);
  const o = [0, 0, 0];
  for (let r = 0; r < N; r++)
    for (let g = 0; g < N; g++)
      for (let b = 0; b < N; b++) {
        gradePixel(r / (N - 1), g / (N - 1), b / (N - 1), P, o);
        const i = ((r * N + g) * N + b) * 3;
        lut[i] = o[0];
        lut[i + 1] = o[1];
        lut[i + 2] = o[2];
      }
  return lut;
}

/** Adobe .cube text for ffmpeg's lut3d (red varies fastest). */
export function cubeText(lut, N = LUT_N) {
  const lines = [`TITLE "infraglance ${GRADE_VERSION}"`, `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 0; r < N; r++) {
        const i = ((r * N + g) * N + b) * 3;
        lines.push(`${lut[i].toFixed(6)} ${lut[i + 1].toFixed(6)} ${lut[i + 2].toFixed(6)}`);
      }
  return lines.join('\n') + '\n';
}

/** Applies a LUT to packed RGB uint8 with tetrahedral interpolation (mirrors ffmpeg lut3d). */
export function applyLut(px, lut, N = LUT_N) {
  const out = Buffer.allocUnsafe(px.length);
  const sc = (N - 1) / 255;
  const sr = N * N * 3, sg = N * 3, sb = 3;
  for (let p = 0; p < px.length; p += 3) {
    const fr = px[p] * sc, fg = px[p + 1] * sc, fb = px[p + 2] * sc;
    const ir = Math.min(fr | 0, N - 2), ig = Math.min(fg | 0, N - 2), ib = Math.min(fb | 0, N - 2);
    const dr = fr - ir, dg = fg - ig, db = fb - ib;
    const c0 = (ir * N + ig) * N * 3 + ib * 3;
    const c7 = c0 + sr + sg + sb;
    let A, B, w0, w1, w2, w3;
    if (dr > dg) {
      if (dg > db) { A = c0 + sr; B = c0 + sr + sg; w0 = 1 - dr; w1 = dr - dg; w2 = dg - db; w3 = db; }
      else if (dr > db) { A = c0 + sr; B = c0 + sr + sb; w0 = 1 - dr; w1 = dr - db; w2 = db - dg; w3 = dg; }
      else { A = c0 + sb; B = c0 + sr + sb; w0 = 1 - db; w1 = db - dr; w2 = dr - dg; w3 = dg; }
    } else {
      if (db > dg) { A = c0 + sb; B = c0 + sg + sb; w0 = 1 - db; w1 = db - dg; w2 = dg - dr; w3 = dr; }
      else if (db > dr) { A = c0 + sg; B = c0 + sg + sb; w0 = 1 - dg; w1 = dg - db; w2 = db - dr; w3 = dr; }
      else { A = c0 + sg; B = c0 + sr + sg; w0 = 1 - dg; w1 = dg - dr; w2 = dr - db; w3 = db; }
    }
    for (let k = 0; k < 3; k++) {
      const v = w0 * lut[c0 + k] + w1 * lut[A + k] + w2 * lut[B + k] + w3 * lut[c7 + k];
      out[p + k] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
    }
  }
  return out;
}

/** Fingerprint of the grade maths, so any change to it re-encodes (new hashed file names). */
const GRADE_FP = createHash('sha1')
  .update([gradePixel, solveGrade, analysePixels, applyLut].map(String).join() + JSON.stringify({ W709, INK, BASE, TINT, TARGET, WB_TARGET, LUT_N }))
  .digest('hex')
  .slice(0, 6);

/** Small packed-RGB thumbnail of an image file, for analysis. */
export async function thumbPixels(src, size = 256) {
  return sharp(src).rotate().resize(size, size, { fit: 'inside' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
}

/* ------------------------------------------------------------------------------------------ */
/* Encoders                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const hashOf = (file, salt) => createHash('sha1').update(readFileSync(file)).update(salt).digest('hex').slice(0, 8);
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const credit = (c) => ({ author: c.author, source: c.source, url: c.url, license: c.license, licenseUrl: c.licenseUrl, title: c.title });
/** Copies credits.json `pos` (focal point) into a manifest entry, right after `lum`. */
const withPos = (entry, pos) => {
  if (typeof pos !== 'string' || !pos.trim()) return entry;
  const out = {};
  for (const [k, v] of Object.entries(entry)) {
    out[k] = v;
    if (k === 'lum') out.pos = pos.trim();
  }
  if (!('pos' in out)) out.pos = pos.trim();
  return out;
};
const webPath = (f) => '/' + f.replaceAll('\\', '/').replace(/^public\//, '');
const kb = (f) => Math.round(statSync(f).size / 1024);

let FORCE = false;
let TMP = os.tmpdir();

/** Placeholder colour (true average) and mean luma of a graded output. */
async function swatch(file) {
  const { channels } = await sharp(file).removeAlpha().stats();
  const color = hex(channels.slice(0, 3).map((c) => c.mean));
  const lum = round(analysePixels(await thumbPixels(file, 160)).Y, 2);
  return { color, lum };
}

/**
 * opts.grade: 'auto' | 'soft' | 'cool' | 'none'. Posters pass 'none' (their frame is already graded).
 */
async function encodePhoto(key, src, widths, alt, { grade = 'auto' } = {}) {
  const P = grade === 'none' ? null : pickGrade(await thumbPixels(src), grade);
  const base = sharp(src).rotate().removeAlpha().toColourspace('srgb');
  const meta = await sharp(src).rotate().metadata();
  const w0 = meta.autoOrient?.width ?? meta.width;
  const h0 = meta.autoOrient?.height ?? meta.height;
  const ws = widths.filter((w) => w <= w0);
  if (!ws.length) ws.push(w0);
  const h = hashOf(src, `${GRADE_VERSION}|${GRADE_FP}|${ws.join()}|${JSON.stringify(P)}`);
  const files = ws.map((w) => {
    const stem = path.join(OUT_P, `${key}-${w}.${h}`);
    return { w, a: stem + '.avif', j: stem + '.jpg' };
  });
  if (FORCE || files.some((f) => !existsSync(f.a) || !existsSync(f.j))) {
    const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
    const graded = P ? applyLut(data, buildLut(P)) : data;
    const raw = { raw: { width: info.width, height: info.height, channels: 3 } };
    for (const f of files) {
      const pipe = sharp(graded, raw).resize({ width: f.w, kernel: 'lanczos3' }).sharpen({ sigma: 0.5 });
      await pipe.clone().avif({ quality: 52, effort: 4 }).toFile(f.a);
      await pipe.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(f.j);
    }
  }
  const { color, lum } = await swatch(files[0].j);
  return {
    entry: { type: 'photo', w: w0, h: h0, color, lum, alt, avif: files.map((f) => [f.w, webPath(f.a)]), jpg: files.map((f) => [f.w, webPath(f.j)]) },
    P,
  };
}

function ffprobe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]);
  const j = JSON.parse(out.toString());
  return { w: j.streams[0].width, h: j.streams[0].height, dur: parseFloat(j.format.duration) };
}

function ff(args, opts = {}) {
  return execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { stdio: ['ignore', opts.capture ? 'pipe' : 'inherit', 'inherit'], maxBuffer: 1 << 28, cwd: opts.cwd });
}

// Decode BT.709 limited range → full-range RGB at 16 bit (identical in analysis, poster and clip).
const toRgb = (w) => `fps=${FPS},scale=${w}:-2:flags=lanczos+accurate_rnd+full_chroma_int:in_color_matrix=bt709:in_range=tv,format=rgb48le`;
const toYuv = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709';
const TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/** Packed RGB of a few frames across the clip (as the encode chain decodes them), for analysis. */
function clipPixels(src, start, len, w0, h0) {
  const w = 256;
  const hh = Math.round((w * h0) / w0 / 2) * 2;
  const bufs = [0.6, len / 2, len - 0.8].map((t) =>
    ff(['-ss', (start + t).toFixed(3), '-i', src, '-frames:v', '1', '-vf', `scale=${w}:${hh}:flags=lanczos+accurate_rnd+full_chroma_int:in_color_matrix=bt709:in_range=tv,format=rgb24`, '-f', 'rawvideo', '-'], { capture: true }),
  );
  return Buffer.concat(bufs);
}

async function encodeVideo(c) {
  const src = path.resolve(c.file);
  const { w: w0, h: h0, dur } = ffprobe(src);
  const start = round(c.start ?? Math.min(1.5, dur * 0.1), 3);
  const frames = Math.round(Math.min(10, Math.max(4, dur - start - 0.2)) * FPS);
  const len = frames / FPS; // decoded length; the published loop is len − 0.6 s
  const P = c.grade === 'none' ? null : pickGrade(clipPixels(src, start, len, w0, h0), c.grade);
  const h = hashOf(src, `${GRADE_VERSION}|${GRADE_FP}|${start}|${len}|loop${LOOP_FRAMES}|${JSON.stringify(P)}`);
  const cube = `grade-${c.key}.cube`;
  if (P) writeFileSync(path.join(TMP, cube), cubeText(buildLut(P)));
  const lut = P ? `,lut3d=file=${cube}:interp=tetrahedral` : '';
  const off = ((frames - 2 * LOOP_FRAMES) / FPS).toFixed(3);
  const graph = (w) =>
    `[0:v]${toRgb(w)}${lut},${toYuv},split[m][h];` +
    `[h]trim=end_frame=${LOOP_FRAMES},setpts=PTS-STARTPTS[head];` +
    `[m]trim=start_frame=${LOOP_FRAMES},setpts=PTS-STARTPTS[body];` +
    `[body][head]xfade=transition=fade:duration=${(LOOP_FRAMES / FPS).toFixed(3)}:offset=${off},format=yuv420p[v]`;
  const input = ['-ss', String(start), '-t', len.toFixed(3), '-i', src, '-an'];
  const outs = {};
  for (const [w, maxrate, vp9] of [[1920, '3200k', '2400k'], [1280, '1400k', '1000k']]) {
    const mp4 = path.join(OUT_V, `${c.key}-${w}.${h}.mp4`);
    const webm = path.join(OUT_V, `${c.key}-${w}.${h}.webm`);
    if (FORCE || !existsSync(mp4)) {
      console.log(`  mp4 ${w}`);
      ff([...input, '-filter_complex', graph(w), '-map', '[v]', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '22', '-maxrate', maxrate, '-bufsize', String(parseInt(maxrate) * 2) + 'k', '-g', '50', '-pix_fmt', 'yuv420p', ...TAGS, '-movflags', '+faststart', path.join(ROOT, mp4)], { cwd: TMP });
    }
    if (FORCE || !existsSync(webm)) {
      console.log(`  webm ${w}`);
      ff([...input, '-filter_complex', graph(w), '-map', '[v]', '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', vp9, '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-auto-alt-ref', '1', '-g', '50', '-pix_fmt', 'yuv420p', ...TAGS, path.join(ROOT, webm)], { cwd: TMP });
    }
    console.log(`  ${w}: mp4 ${kb(mp4)} KB, webm ${kb(webm)} KB`);
    outs[w] = { mp4: webPath(mp4), webm: webPath(webm) };
  }
  // Poster: the loop's first frame from the same graded chain, straight to RGB (no second grade).
  const frame = path.join(TMP, `poster-${c.key}.png`);
  ff([...input, '-filter_complex', `[0:v]${toRgb(1920)}${lut},trim=start_frame=${LOOP_FRAMES},setpts=PTS-STARTPTS,format=rgb24[p]`, '-map', '[p]', '-frames:v', '1', frame], { cwd: TMP });
  const { entry: poster } = await encodePhoto(`${c.key}-poster`, frame, POSTER_WIDTHS, c.title, { grade: 'none' });
  return {
    entry: { type: 'video', w: 1920, h: Math.round((1920 * poster.h) / poster.w), duration: round(len - LOOP_FRAMES / FPS, 2), alt: c.title, color: poster.color, lum: poster.lum, sources: outs, poster },
    P,
  };
}

/** Deletes files in public/media/{p,v} that the manifest does not reference. */
function clean(manifest) {
  const keep = new Set((JSON.stringify(manifest).match(/\/media\/[pv]\/[^"]+/g) ?? []).map((u) => path.normalize('public' + u)));
  let n = 0, bytes = 0;
  for (const dir of [OUT_P, OUT_V]) {
    for (const f of readdirSync(dir)) {
      const p = path.normalize(path.join(dir, f));
      if (keep.has(p) || !statSync(p).isFile()) continue;
      bytes += statSync(p).size;
      unlinkSync(p);
      n++;
    }
  }
  console.log(`clean: removed ${n} unreferenced files (${(bytes / 1048576).toFixed(1)} MB)`);
}

async function main() {
  process.chdir(ROOT);
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const only = argv.find((a) => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
  const doPhotos = !has('--videos');
  const doVideos = !has('--photos');
  FORCE = has('--force');
  TMP = mkdtempSync(path.join(os.tmpdir(), 'ig-media-'));
  mkdirSync(OUT_P, { recursive: true });
  mkdirSync(OUT_V, { recursive: true });
  const credits = JSON.parse(readFileSync('assets/credits.json', 'utf8'));
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const ordered = () => {
    const o = {};
    for (const c of credits) if (manifest[c.key]) o[c.key] = manifest[c.key];
    return o;
  };
  const save = () => writeFileSync(MANIFEST, JSON.stringify(ordered(), null, 1) + '\n');
  const failed = [];
  const fmt = (P) => (P ? `wb ${P.wb.map((x) => x.toFixed(3)).join('/')} γ ${P.gamma.toFixed(3)} c ${P.contrast.toFixed(3)} sat ${P.sat.toFixed(3)} or ${P.orange.toFixed(2)}` : 'ungraded');

  const run = async (c) => {
    if (only && !only.includes(c.key)) return;
    if (!existsSync(c.file)) {
      console.warn(`! missing file for ${c.key}: ${c.file} (keeping its previous manifest entry)`);
      return;
    }
    try {
      const t = Date.now();
      const { entry, P } = c.type === 'photo' ? await encodePhoto(c.key, c.file, PHOTO_WIDTHS, c.title, { grade: c.grade ?? 'auto' }) : await encodeVideo(c);
      manifest[c.key] = { ...withPos(entry, c.pos), credit: credit(c) };
      console.log(`${c.type} ${c.key}: ${fmt(P)} → ${entry.color} lum ${entry.lum} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
      save();
    } catch (err) {
      failed.push(c.key);
      console.error(`! failed ${c.key}:`, err.message);
    }
  };

  try {
    // Photos two at a time (sharp is multi-threaded already), videos one at a time.
    const photos = doPhotos ? credits.filter((c) => c.type === 'photo') : [];
    const queue = [...photos];
    await Promise.all([0, 1].map(async () => { while (queue.length) await run(queue.shift()); }));
    if (doVideos) for (const c of credits.filter((x) => x.type === 'video')) await run(c);
  } finally {
    rmSync(TMP, { recursive: true, force: true });
  }

  // Entries whose key left credits.json are dropped on a full run.
  if (!only && doPhotos && doVideos) for (const k of Object.keys(manifest)) if (!credits.some((c) => c.key === k)) delete manifest[k];
  save();
  console.log(`manifest: ${Object.keys(ordered()).length} entries → ${MANIFEST}`);
  if (failed.length) console.error(`! ${failed.length} failed: ${failed.join(', ')}`);
  // Safe even after a failure: a failed key keeps its previous entry, and so its files.
  if (has('--clean')) clean(ordered());
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
