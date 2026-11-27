// Captures the website's app mockups (hero frame) from dist/ via serve-dist.mjs on :4511.
//   node collateral/images/build/capture-screens.mjs [id,id]
// Writes collateral/images/screens/<id>.png (plain, transparent outside the window) and
// collateral/review/images-screens/<id>-narrow.png (phone-width layout, used by frames.mjs).
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'collateral/images/screens');
const NARROW = path.join(ROOT, 'collateral/images/build/narrow');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(NARROW, { recursive: true });
const BASE = 'http://localhost:4511';
// sel: element on the page; nth: which match; w: layout width in CSS px for the plain capture
const SCREENS = {
  'hub-overview': { page: '/platform', sel: '.mock.hubdash', w: 960 },
  'hub-sense': { page: '/solutions/sense', sel: '.mock.hubdash', w: 960 },
  'studio-rules': { page: '/platform', sel: '.mock.studio', w: 900 },
  'ask-chat': { page: '/platform', sel: '.mock.ask', w: 860 },
  'guard-camera': { page: '/solutions/guard', sel: '.mock.camfeed', w: 900 },
  'guard-phone': { page: '/platform', sel: '.phone-wrap', shot: '.phone .screen', w: null, dsf: 4 },
  'inspect-hmi': { page: '/solutions/inspect', sel: '.mock.hmi', w: 960 },
  'flow-timeline': { page: '/solutions/flow', sel: '.mock.flowtl', w: 960 },
  'infra-report': { page: '/solutions/infra', sel: '.mock.infra-rep', w: 960 },
};
const only = process.argv[2]?.split(',');
const CSS = `
  .ui-demo, figcaption.ui-demo { display: none !important; }
  [data-reveal] { opacity: 1 !important; translate: none !important; transform: none !important; }
  html, body { background: transparent !important; }
  #cap-stage { position: absolute; left: 0; top: 0; z-index: 2147483647; padding: 0; background: transparent; }
  #cap-stage > * { margin: 0 !important; max-width: none !important; }
  body > *:not(#cap-stage) { visibility: hidden !important; }
  #cap-stage, #cap-stage * { visibility: visible; }
  .ui-device { box-shadow: none !important; }
  .mock.ui-win { box-shadow: none !important; }
`;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text'] });
async function shot(id, s, width, file, dsf) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: dsf });
  await page.goto(BASE + s.page, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.addStyleTag({ content: CSS });
  const info = await page.evaluate(async (sel, width) => {
    const el = document.querySelector(sel);
    if (!el) return { err: 'not found ' + sel };
    const onsite = el.getBoundingClientRect().width;
    // load lazy pictures
    for (const img of el.querySelectorAll('img')) { img.loading = 'eager'; img.decoding = 'sync'; }
    const stage = document.createElement('div');
    stage.id = 'cap-stage';
    document.body.append(stage);
    stage.append(el);
    if (width) el.style.width = width + 'px';
    // strip any demo/illustrative wording from the visible text
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n; (n = tw.nextNode()); ) if (/demo|illustrative/i.test(n.nodeValue)) { hits.push(n.nodeValue); n.nodeValue = n.nodeValue.replace(/\s*·\s*demo report/i, '').replace(/demo data/ig, ''); }
    window.__hits = hits;
    window.scrollTo(0, 0);
    await Promise.all([...el.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 400));
    const r = el.getBoundingClientRect();
    return { onsite, w: r.width, h: r.height, hits: window.__hits };
  }, s.sel, width);
  if (info.err) throw new Error(id + ': ' + info.err);
  const el = await page.$(s.shot ? '#cap-stage > * ' + s.shot : '#cap-stage > *');
  await el.screenshot({ path: file, omitBackground: true });
  await page.close();
  return info;
}
for (const [id, s] of Object.entries(SCREENS)) {
  if (only && !only.includes(id)) continue;
  const info = await shot(id, s, s.w, path.join(OUT, `${id}.png`), s.dsf ?? 3);
  console.log(id, JSON.stringify(info));
  if (s.w) {
    const n = await shot(id, s, 390, path.join(NARROW, `${id}.png`), 3);
    console.log('  narrow', JSON.stringify(n));
  }
}
await browser.close();
