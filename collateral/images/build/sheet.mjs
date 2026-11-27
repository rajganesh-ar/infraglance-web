// Tiles PNG/JPGs into a review sheet: node sheet.mjs out.png cols cellW file...
import sharp from 'sharp';
const [out, cols, cellW, ...files] = process.argv.slice(2);
const C = +cols, W = +cellW, gap = 16;
const tiles = await Promise.all(files.map(async (f) => {
  const buf = await sharp(f).resize({ width: W, height: Math.round(W * 0.75), fit: 'inside' }).png().toBuffer();
  const m = await sharp(buf).metadata();
  return { buf, w: m.width, h: m.height };
}));
const rows = Math.ceil(tiles.length / C);
const rowH = []; for (let r = 0; r < rows; r++) rowH.push(Math.max(...tiles.slice(r * C, r * C + C).map((t) => t.h)));
const H = rowH.reduce((a, b) => a + b + gap, gap);
const comp = []; let y = gap;
for (let r = 0; r < rows; r++) { for (let c = 0; c < C; c++) { const t = tiles[r * C + c]; if (t) comp.push({ input: t.buf, left: gap + c * (W + gap), top: y }); } y += rowH[r] + gap; }
await sharp({ create: { width: gap + C * (W + gap), height: H, channels: 4, background: '#8a96a3' } }).composite(comp).png().toFile(out);
console.log(out);
