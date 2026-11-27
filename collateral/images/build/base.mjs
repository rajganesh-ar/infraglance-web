// Graded 2400×1350 base photos for the detection images, plus grid previews for placing overlays.
//   node collateral/images/build/base.mjs [id,id]
// Grade: the website's own house grade (scripts/media.mjs, imported read-only), solved on the full
// original exactly as the site does, then cropped to 16:9 and resized.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveGrade, buildLut, applyLut, thumbPixels } from '../../../scripts/media.mjs';
import { BASES } from './bases.config.mjs';
import * as RT from './retouch.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'collateral/images/base');
const GRID = path.join(ROOT, 'collateral/review/images-grid');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(GRID, { recursive: true });
const W709 = [0.2126, 0.7152, 0.0722];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const round = (x, d = 4) => +x.toFixed(d);
function coolGrade(px) { // copy of scripts/media.mjs coolGrade (not exported)
  const P = solveGrade(px, 'auto');
  const r = P.wb[0] / P.wb[1], b = P.wb[2] / P.wb[1];
  const gr = clamp(r ** 1.6, 0.88, 1.025), gb = clamp(b ** 1.6, 0.975, 1.12);
  const nrm = W709[0] * gr + W709[1] + W709[2] * gb;
  return { ...P, mode: 'cool', wb: [gr / nrm, 1 / nrm, gb / nrm].map((x) => round(x)), sat: round(clamp(P.sat * 0.86, 0.58, 0.97)), orange: round(Math.min(0.14, P.orange + 0.04)) };
}
const pick = (px, mode) => (mode === 'cool' ? coolGrade(px) : solveGrade(px, mode === 'soft' ? 'soft' : 'auto'));

const only = process.argv[2]?.split(',');
for (const [id, c] of Object.entries(BASES)) {
  if (only && !only.includes(id)) continue;
  const src = path.join(ROOT, c.src);
  const meta = await sharp(src).rotate().metadata();
  const W = meta.width, H = meta.height;
  // crop: cx, cy = centre in 0–1 of the source; w = crop width as fraction of source width (default: max 16:9)
  let cw = Math.round((c.w ?? Math.min(1, (H * 16) / 9 / W)) * W);
  let ch = Math.round((cw * 9) / 16);
  if (ch > H) { ch = H; cw = Math.round((H * 16) / 9); }
  const left = clamp(Math.round((c.cx ?? 0.5) * W - cw / 2), 0, W - cw);
  const top = clamp(Math.round((c.cy ?? 0.5) * H - ch / 2), 0, H - ch);
  let img = sharp(src).rotate().extract({ left, top, width: cw, height: ch });
  if (c.flip) img = img.flop();
  const { data, info } = await img.removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  let px = data;
  if (c.grade !== 'none') {
    const P = pick(await thumbPixels(src), c.grade ?? 'auto');
    px = applyLut(data, buildLut(P));
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 3 } };
  const outPx = await sharp(px, raw).resize(2400, 1350, { kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).raw().toBuffer();
  if (c.desatRed) RT.desatRed(outPx, c.desatRed === true ? {} : c.desatRed);
  for (const r of c.retouch ?? []) {
    if (r.mode === 'epoxy') await RT.epoxy(outPx, r.poly, r);
    else if (r.mode === 'fill') await RT.fill(outPx, r.poly, r);
  }
  await sharp(outPx, { raw: { width: 2400, height: 1350, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(OUT, `${id}.jpg`));
  if (c.retouch?.some((r) => !r.mode || r.mode === 'blur')) {
    // soften marks/logos inside polygons (output coordinates), feathered mask
    const f = path.join(OUT, `${id}.jpg`);
    let buf = fs.readFileSync(f);
    for (const r of c.retouch.filter((q) => !q.mode || q.mode === 'blur')) {
      const blur = await sharp(buf).blur(r.sigma ?? 14).toBuffer();
      const mask = Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='2400' height='1350'><filter id='f'><feGaussianBlur stdDeviation='${r.feather ?? 6}'/></filter><polygon points='${r.poly.map((p) => p.join(',')).join(' ')}' fill='#fff' filter='url(#f)'/></svg>`);
      const m = await sharp(blur).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      const out = await sharp(buf).composite([{ input: m }]).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
      fs.writeFileSync(f, out); buf = out;
    }
  }
  // grid preview (1200×675, lines every 100 px of the 2400 frame, safe area outlined)
  let g = '';
  for (let x = 100; x < 2400; x += 100) g += `<line x1="${x}" y1="0" x2="${x}" y2="1350" stroke="${x % 500 ? '#ffffff55' : '#ff0'}" stroke-width="2"/><text x="${x + 4}" y="40" font-size="28" fill="#ff0" font-family="monospace">${x}</text>`;
  for (let y = 100; y < 1350; y += 100) g += `<line x1="0" y1="${y}" x2="2400" y2="${y}" stroke="${y % 500 ? '#ffffff55' : '#ff0'}" stroke-width="2"/><text x="6" y="${y - 6}" font-size="28" fill="#ff0" font-family="monospace">${y}</text>`;
  g += `<rect x="300" y="60" width="1800" height="1230" fill="none" stroke="#f0f" stroke-width="4" stroke-dasharray="20 12"/>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 2400 1350">${g}</svg>`);
  const small = await sharp(path.join(OUT, `${id}.jpg`)).resize(1200, 675).toBuffer();
  await sharp(small).composite([{ input: svg }]).jpeg({ quality: 80 }).toFile(path.join(GRID, `${id}.jpg`));
  console.log(id, `${W}x${H} crop ${cw}x${ch}@${left},${top}`);
}
