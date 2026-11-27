// Prints a collateral page to PDF with system Chrome, after det.js has placed every image and the
// fonts are loaded. Page size comes from the page's CSS @page rule.
//   node collateral/tools/pdf.mjs <url> <out.pdf> [--shots=<dir>] [--sel=.page] [--scale=1] [--toc=<file.json>]
//     --shots  also saves one PNG per element matching --sel (default ".page, .slide") for review.
//     --scale  device scale factor for the review PNGs (default 1).
//     --toc    writes one bookmark title per page/slide, for finish.py --toc.
// For the finished deliverables use build.mjs, which runs this and then finish.py for both documents.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node collateral/tools/pdf.mjs <url> <out.pdf> [--shots=<dir>] [--sel=.page] [--scale=1]');
  process.exit(2);
}
const opt = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--font-render-hinting=none'] });
try {
  const page = await browser.newPage();
  const problems = [];
  // The browser's automatic /favicon.ico request is noise, not a page problem.
  const noise = (s) => /favicon\.ico/.test(s);
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('requestfailed', (r) => !noise(r.url()) && problems.push(`failed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && !noise(r.url()) && problems.push(`${r.status()}: ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && problems.push(m.text()));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: Number(opt.scale ?? 1) });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.evaluate(async () => {
    if (window.__collateralReady) await window.__collateralReady;
    await document.fonts.ready;
  });

  if (opt.shots) {
    fs.mkdirSync(opt.shots, { recursive: true });
    const els = await page.$$(opt.sel ?? '.page, .slide');
    for (const [i, el] of els.entries()) await el.screenshot({ path: path.join(opt.shots, `${String(i + 1).padStart(2, '0')}.png`) });
    console.log(`${els.length} review PNGs → ${opt.shots}`);
  }

  await page.emulateMediaType('print');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (opt.toc) {
    // One bookmark per page/slide for finish.py: data-bookmark, else the eyebrow (minus "Pillar 01 · " style
    // numbering), with a short "Glance X" product heading put in front of it, else the first heading.
    const toc = await page.evaluate(() =>
      [...document.querySelectorAll('.page, .slide')].map((el, i) => {
        const clean = (s) => s?.replace(/\s+/g, ' ').trim() || '';
        const eyebrow = clean(el.querySelector('.eyebrow')?.textContent).replace(/^(—\s*)?(Pillar\s+)?\d+\s*·\s*/i, '');
        const head = clean(el.querySelector('h1, h2')?.innerText);
        const product = /^Glance \w+$/.test(head) && !eyebrow.startsWith(head) ? `${head} · ` : '';
        return { page: i + 1, title: el.dataset.bookmark || (eyebrow ? product + eyebrow : head) || `Page ${i + 1}` };
      }),
    );
    fs.mkdirSync(path.dirname(path.resolve(opt.toc)), { recursive: true });
    fs.writeFileSync(opt.toc, JSON.stringify(toc, null, 1));
  }
  // tagged: accessible structure. Bookmarks come from --toc via finish.py (Chrome's own outline lists every h1–h3).
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, tagged: true, timeout: 300000 });
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`PDF → ${out} (${kb} KB)`);
  if (problems.length) {
    console.log(`${problems.length} problem(s):\n  ` + [...new Set(problems)].join('\n  '));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
