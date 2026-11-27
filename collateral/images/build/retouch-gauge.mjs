// Retouches the Pexels 462394 gauge so its pointer reads 6.4 bar (the site's PI-204 demo value).
// The original pointer rests at 0 bar. Writes collateral/assets/raw/sense-gauge/pexels-462394-retouched.jpg.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = path.join(ROOT, 'collateral/assets/raw/sense-gauge/pexels-462394.jpg');
const OUT = path.join(ROOT, 'collateral/assets/raw/sense-gauge/pexels-462394-retouched.jpg');
const RX = 2000, RY = 1000, W = 2400, H = 1900; // working region (full-res px)
const L = (x, y) => [x - RX, y - RY];
const hub = L(3376, 2110);
const oldTip = L(2206, 1622), oldEnd = L(4022, 2400);
const t6 = [3866, 1300], t8 = [4340, 1736];
const tip = L(t6[0] + 0.2 * (t8[0] - t6[0]), t6[1] + 0.2 * (t8[1] - t6[1]));
const ux = (tip[0] - hub[0]), uy = (tip[1] - hub[1]), ul = Math.hypot(ux, uy);
const u = [ux / ul, uy / ul], n = [-u[1], u[0]];
const tailLen = 700;
const pt = (s, w) => [hub[0] + u[0] * s + n[0] * w, hub[1] + u[1] * s + n[1] * w];
const f = (p) => p.map((v) => v.toFixed(1)).join(',');

// 1. region + old-needle mask (thin part + paddle), generous width
const img = await sharp(SRC).extract({ left: RX, top: RY, width: W, height: H }).removeAlpha().raw().toBuffer();
const seg = (a, b, wa, wb) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  return `<polygon points="${f([a[0] + nx * wa, a[1] + ny * wa])} ${f([b[0] + nx * wb, b[1] + ny * wb])} ${f([b[0] - nx * wb, b[1] - ny * wb])} ${f([a[0] - nx * wa, a[1] - ny * wa])}"/>`;
};
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/><g fill="#fff">${seg(oldTip, hub, 34, 66)}${seg(hub, oldEnd, 58, 92)}<circle cx="${2446 - RX}" cy="${1818 - RY}" r="70"/><g transform="translate(10 46)">${seg(oldTip, hub, 30, 56)}${seg(hub, oldEnd, 56, 96)}</g><circle cx="${oldEnd[0]}" cy="${oldEnd[1]}" r="92"/></g><g fill="#000"><rect x="${4062 - RX}" y="${2180 - RY}" width="90" height="230"/><rect x="${2420 - RX}" y="${1540 - RY}" width="200" height="${1680 - 1540}"/></g></svg>`;
const mask = await sharp(Buffer.from(maskSvg)).blur(10).extractChannel(0).raw().toBuffer();
for (let y = 2150 - RY; y < 2470 - RY; y++) for (let x = 4030 - RX; x < 4200 - RX; x++) { const X = x + RX, Y = y + RY; if ((X >= 4042 && Y < 2334) || X >= 4082) mask[y * W + x] = 0; } // keep the "10" numeral
// 2. normalised-convolution fill from bright dial pixels only (numerals/ticks don't bleed in)
const keep = Buffer.alloc(W * H);
const kimg = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const r = img[i * 3], g = img[i * 3 + 1], b = img[i * 3 + 2];
  const ok = mask[i] < 8 && 0.3 * r + 0.59 * g + 0.11 * b > 150 ? 255 : 0;
  keep[i] = ok;
  if (ok) { kimg[i * 3] = r; kimg[i * 3 + 1] = g; kimg[i * 3 + 2] = b; }
}
const nc = async (sig) => [await sharp(kimg, { raw: { width: W, height: H, channels: 3 } }).blur(sig).raw().toBuffer(), await sharp(keep, { raw: { width: W, height: H, channels: 1 } }).blur(sig).extractChannel(0).raw().toBuffer()];
const [A1, K1] = await nc(24), [A2, K2] = await nc(90);
const out = Buffer.from(img);
for (let i = 0; i < W * H; i++) {
  const m = mask[i] / 255;
  if (m <= 0) continue;
  const w1 = Math.min(1, K1[i] / 40); // near detail where the fine pass has support, wide pass elsewhere
  for (let c = 0; c < 3; c++) {
    const f1 = K1[i] > 0 ? (A1[i * 3 + c] / K1[i]) * 255 : 0, f2 = (A2[i * 3 + c] / Math.max(K2[i], 1)) * 255;
    const fill = Math.max(0, Math.min(255, f1 * w1 + f2 * (1 - w1) + (Math.random() - 0.5) * 5));
    out[i * 3 + c] = Math.round(img[i * 3 + c] * (1 - m) + fill * m);
  }
}
// 3. new pointer: thin tip to 6.4 bar, paddle tail, soft contact shadow
const len = ul;
const needle = `M${f(pt(len, 0))} L${f(pt(len - 40, 5))} L${f(pt(0, 24))} L${f(pt(-tailLen + 120, 36))} Q${f(pt(-tailLen - 8, 52))} ${f(pt(-tailLen, 0))} Q${f(pt(-tailLen - 8, -52))} ${f(pt(-tailLen + 120, -36))} L${f(pt(0, -24))} L${f(pt(len - 40, -5))} Z`;
const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><filter id="b"><feGaussianBlur stdDeviation="9"/></filter><path d="${needle}" fill="#000" opacity="0.22" transform="translate(14 18)" filter="url(#b)"/></svg>`;
const needleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${needle}" fill="#0b0c0e"/><path d="${needle}" fill="none" stroke="#2a2d33" stroke-width="2" opacity="0.6"/></svg>`;
// 4. original hub cap back on top
const capR = 128;
const capMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><filter id="b"><feGaussianBlur stdDeviation="2"/></filter><circle cx="${hub[0]}" cy="${hub[1]}" r="${capR}" fill="#fff" filter="url(#b)"/></svg>`);
const cap = await sharp(img, { raw: { width: W, height: H, channels: 3 } }).ensureAlpha().composite([{ input: capMask, blend: 'dest-in' }]).png().toBuffer();
const region = await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .composite([{ input: Buffer.from(shadowSvg) }, { input: Buffer.from(needleSvg) }, { input: cap }])
  .png().toBuffer();
await sharp(SRC).composite([{ input: region, left: RX, top: RY }]).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(OUT);
await sharp(OUT).extract({ left: RX, top: RY, width: W, height: H }).resize(1200).toFile(path.join(ROOT, 'collateral/review/cand/gz-retouched.jpg'));
console.log('tip', tip.map((v, i) => Math.round(v + (i ? RY : RX))), 'hub', [3376, 2110]);
