// 16:10 captures of the wide, short mockups for the laptop frame (so the app fills the display).
// The window is laid out at 944×590 CSS px and its main panes stretch (lane, photo, canvas, chart).
//   node collateral/images/build/capture-laptop.mjs [id,id]     → collateral/images/build/laptop/<id>.png
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'collateral/images/build/laptop');
fs.mkdirSync(OUT, { recursive: true });
const W = 944, H = 590;
const S = {
  'inspect-hmi': { page: '/solutions/inspect', sel: '.mock.hmi', css: '.hw{align-items:stretch !important} .side{grid-template-rows:minmax(0,1fr) auto auto !important; align-content:stretch !important} .side > :first-child{display:grid; align-content:center}' },
  'infra-report': { page: '/solutions/infra', sel: '.mock.infra-rep', css: '.rep{align-items:stretch !important; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) !important} .reg{grid-template-rows:auto auto minmax(0,1fr) !important; align-content:stretch !important} .reg > :last-child{align-self:end !important}' },
  'studio-rules': { page: '/platform', sel: '.mock.studio', css: '.st{align-items:stretch !important}' },
  'flow-timeline': { page: '/solutions/flow', sel: '.mock.flowtl', css: '.fl{grid-template-rows:minmax(0,1fr) auto auto} .top{align-items:stretch} .top > *{min-height:0} .spark{height:100%} .plot{flex:1 1 auto; display:flex; min-height:0} .plot svg{height:100% !important}' },
};
const BASE_CSS = `
  .ui-demo, figcaption.ui-demo { display: none !important; }
  [data-reveal] { opacity: 1 !important; translate: none !important; transform: none !important; }
  html, body { background: transparent !important; }
  #cap-stage { position: absolute; left: 0; top: 0; z-index: 2147483647; }
  body > *:not(#cap-stage) { visibility: hidden !important; }
  #cap-stage, #cap-stage * { visibility: visible; }
  .mock.ui-win { box-shadow: none !important; }
  #cap-stage > .mock { width: ${W}px !important; height: ${H}px !important; max-width: none !important; margin: 0 !important; display: flex !important; flex-direction: column !important; }
  #cap-stage > .mock > .ui-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  #cap-stage > .mock > .ui-body > * { flex: 1 1 auto; min-height: 0; }
`;
const only = process.argv[2]?.split(',');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text'] });
for (const [id, s] of Object.entries(S)) {
  if (only && !only.includes(id)) continue;
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 3 });
  await page.goto('http://localhost:4511' + s.page, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.addStyleTag({ content: BASE_CSS + s.css });
  const info = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    for (const img of el.querySelectorAll('img')) { img.loading = 'eager'; }
    const stage = document.createElement('div'); stage.id = 'cap-stage'; document.body.append(stage); stage.append(el);
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode()); ) if (/demo|illustrative/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\s*·\s*demo report/i, '').replace(/demo data/gi, '');
    window.scrollTo(0, 0);
    await Promise.all([...el.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 500));
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, scroll: el.scrollHeight };
  }, s.sel);
  const el = await page.$('#cap-stage > *');
  await el.screenshot({ path: path.join(OUT, `${id}.png`), omitBackground: true });
  console.log(id, JSON.stringify(info));
  await page.close();
}
await browser.close();
