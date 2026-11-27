// Retouch helpers on packed RGB buffers (2400×1350 output frame).
//   fill   – removes a mark by filling the polygon from its surroundings (normalised convolution),
//            so paint, metal or floor texture carries through instead of a blur box
//   epoxy  – flat dark component top with a slight top-light gradient and a pin-1 dimple
//   desatRed – pulls saturated red/maroon toward cool ink, leaves neutrals (white dial, metal) alone
import sharp from 'sharp';

const W = 2400, H = 1350;
async function mask(polys, feather = 1.5) {
  const shapes = polys.map((p) => `<polygon points="${p.map((q) => q.join(',')).join(' ')}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/><filter id="f"><feGaussianBlur stdDeviation="${feather}"/></filter><g fill="#fff" filter="url(#f)">${shapes}</g></svg>`;
  return sharp(Buffer.from(svg)).extractChannel(0).raw().toBuffer();
}
const bbox = (polys) => {
  const xs = polys.flat().map((p) => p[0]), ys = polys.flat().map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

export async function fill(px, poly, { sigma, keepOut = [], lumaMax = 256, lumaMin = -1 } = {}) {
  const [x0, y0, x1, y1] = bbox([poly]);
  const s = sigma ?? Math.max(3, Math.min(x1 - x0, y1 - y0) * 0.45);
  const m = await mask([poly], 1.2);
  const hole = await mask([poly], 0); // hard hole for the source mask
  // local window
  const pad = Math.ceil(s * 4) + 4;
  const L = Math.max(0, Math.floor(x0) - pad), T = Math.max(0, Math.floor(y0) - pad);
  const R = Math.min(W, Math.ceil(x1) + pad), B = Math.min(H, Math.ceil(y1) + pad);
  const w = R - L, h = B - T;
  const src = Buffer.alloc(w * h * 3), keep = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gi = (y + T) * W + (x + L), li = y * w + x;
    const Y = 0.2126 * px[gi * 3] + 0.7152 * px[gi * 3 + 1] + 0.0722 * px[gi * 3 + 2];
    const k = hole[gi] < 20 && Y <= lumaMax && Y >= lumaMin ? 255 : 0;
    keep[li] = k;
    if (k) for (let c = 0; c < 3; c++) src[li * 3 + c] = px[gi * 3 + c];
  }
  const A = await sharp(src, { raw: { width: w, height: h, channels: 3 } }).blur(s).raw().toBuffer();
  const K = await sharp(keep, { raw: { width: w, height: h, channels: 1 } }).blur(s).extractChannel(0).raw().toBuffer();
  const keepOutMask = keepOut.length ? await mask(keepOut, 0.8) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gi = (y + T) * W + (x + L), li = y * w + x;
    let a = m[gi] / 255;
    if (keepOutMask) a *= 1 - keepOutMask[gi] / 255;
    if (a <= 0) continue;
    const k = Math.max(K[li], 1), n = (Math.random() - 0.5) * 4;
    for (let c = 0; c < 3; c++) {
      const f = Math.min(255, Math.max(0, (A[li * 3 + c] / k) * 255 + n));
      px[gi * 3 + c] = Math.round(px[gi * 3 + c] * (1 - a) + f * a);
    }
  }
}

export async function epoxy(px, poly, { keepOut = [], dimple, top = [44, 46, 52], bottom = [22, 23, 27] } = {}) {
  const m = await mask([poly], 1.0);
  const ko = keepOut.length ? await mask(keepOut, 0.8) : null;
  const [, y0, , y1] = bbox([poly]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let a = m[i] / 255;
    if (ko) a *= 1 - ko[i] / 255;
    if (a <= 0) continue;
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    let d = 0;
    if (dimple) { const r = Math.hypot(x - dimple[0], y - dimple[1]); d = r < dimple[2] ? (r > dimple[2] - 2.2 ? 26 : -8) : 0; }
    const n = (Math.random() - 0.5) * 3;
    for (let c = 0; c < 3; c++) {
      const v = top[c] + (bottom[c] - top[c]) * t + d + n;
      px[i * 3 + c] = Math.round(px[i * 3 + c] * (1 - a) + v * a);
    }
  }
}

/** Cool/desaturate saturated reds (maroon backdrops) toward ink; neutrals and whites untouched. */
export function desatRed(px, { amount = 0.85, darken = 0.62 } = {}) {
  for (let i = 0; i < px.length; i += 3) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    const redness = r > g && r > b ? Math.min(1, Math.max(0, (sat - 0.18) / 0.35)) * Math.min(1, (r - Math.max(g, b)) / 60) : 0;
    if (redness <= 0) continue;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const k = amount * redness;
    // cool ink-blue neutral at reduced luminance
    const tr = Y * darken * 0.86, tg = Y * darken * 0.95, tb = Y * darken * 1.12 + 6;
    px[i] = Math.round(r + (tr - r) * k);
    px[i + 1] = Math.round(g + (tg - g) * k);
    px[i + 2] = Math.min(255, Math.round(b + (tb - b) * k));
  }
}
