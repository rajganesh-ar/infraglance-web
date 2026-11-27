// Renders the laptop and phone variants of each captured screen through frame.html (served on :4510).
//   node collateral/images/build/frames.mjs [id,id]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'collateral/images/screens');
// phone: 'full' = the screen is already a phone screen; a tab name = phone-width layout + tab bar; null = reuse plain
const IDS = {
  'hub-overview': { phone: 'home' }, 'hub-sense': { phone: 'home' }, 'studio-rules': { phone: null }, 'ask-chat': { phone: 'ask' },
  'guard-camera': { phone: null }, 'guard-phone': { phone: 'full', laptop: 'phone' }, 'inspect-hmi': { phone: null },
  'flow-timeline': { phone: null }, 'infra-report': { phone: 'events' },
};
const only = process.argv[2]?.split(',');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text'] });
async function render(id, v, dsf, file, extra = '') {
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && console.error(id, v, m.text()));
  await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: dsf });
  await page.goto(`http://localhost:4510/collateral/images/build/frame.html?id=${id}&v=${v}&dsf=${dsf}${extra}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready', { timeout: 30000 });
  if ((await page.evaluate('window.__ready')) === 'error') throw new Error(id + ' ' + v);
  const el = await page.$('#dev > *');
  await el.screenshot({ path: file, omitBackground: true });
  await page.close();
}
for (const [id, c] of Object.entries(IDS)) {
  if (only && !only.includes(id)) continue;
  const plainDsf = id === 'guard-phone' ? 4 : 3;
  if (c.laptop === 'phone') {
    await render(id, 'phone-full', 4, path.join(OUT, `${id}-phone.png`));
    fs.copyFileSync(path.join(OUT, `${id}-phone.png`), path.join(OUT, `${id}-laptop.png`));
  } else {
    const l16 = fs.existsSync(path.join(ROOT, 'collateral/images/build/laptop', `${id}.png`));
    await render(id, 'laptop', plainDsf, path.join(OUT, `${id}-laptop.png`), l16 ? '&src=laptop' : '');
    if (c.phone === 'full') await render(id, 'phone-full', plainDsf, path.join(OUT, `${id}-phone.png`));
    else if (c.phone) await render(id, 'phone', 3, path.join(OUT, `${id}-phone.png`), `&tab=${c.phone}`);
    else fs.copyFileSync(path.join(OUT, `${id}.png`), path.join(OUT, `${id}-phone.png`));
  }
  console.log('framed', id);
}
await browser.close();
