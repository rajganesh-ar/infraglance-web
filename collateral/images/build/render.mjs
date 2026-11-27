// Writes overlay SVGs from det-specs.mjs and flattens them onto the base photos (pack PNG + review JPG).
//   node collateral/images/build/render.mjs id[,id]
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const D = (p) => path.join(ROOT, 'collateral', p);
const { SPECS } = await import(pathToFileURL(path.join(ROOT, 'collateral/images/build/det-specs.mjs')).href + '?' + Date.now());
for (const p of ['images/detections', 'images/pack', 'review/images-det']) fs.mkdirSync(D(p), { recursive: true });
const { THUMBS } = await import(pathToFileURL(path.join(ROOT, 'collateral/images/build/det-thumbs.mjs')).href + '?' + Date.now());
const thumbMode = process.argv.includes('--thumbs');
const ids = thumbMode ? Object.keys(THUMBS) : process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : Object.keys(SPECS);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text'] });
const page = await browser.newPage();
await page.setViewport({ width: 2400, height: 1350, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.error(m.text()));
for (const id of ids) {
  const svg = (thumbMode ? THUMBS : SPECS)[id]().toString();
  fs.writeFileSync(D(`images/detections/${id}${thumbMode ? '-thumb' : ''}.svg`), svg);
  await page.goto(`http://localhost:4510/collateral/images/build/flatten.html?id=${id}${thumbMode ? '&ov=thumb' : ''}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready');
  const bad = await page.evaluate('window.__bad');
  const el = await page.$('#f');
  if (thumbMode) {
    const buf = await el.screenshot();
    await sharp(buf).resize(800).jpeg({ quality: 82 }).toFile(D(`review/images-det/${id}-thumb.jpg`));
  } else {
    const png = D(`images/pack/${id}.png`);
    await el.screenshot({ path: png });
    await sharp(png).resize(1600).jpeg({ quality: 82 }).toFile(D(`review/images-det/${id}.jpg`));
  }
  console.log(id, bad.length ? 'OUTSIDE SAFE AREA: ' + bad.slice(0, 6).join(' | ') : 'ok');
}
await browser.close();
