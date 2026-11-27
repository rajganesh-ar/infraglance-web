// Deck helper: fills the compact photo-credits line on the last slide.
// Runs after det.js and chains onto window.__collateralReady, so tools/pdf.mjs waits for it too.
const detReady = window.__collateralReady ?? Promise.resolve();

async function json(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function fillCredits() {
  await detReady;
  const box = document.getElementById('credits');
  if (!box) return;
  const [m, lib] = await Promise.all([json('/collateral/images/manifest.json'), json('/assets/credits.json')]);
  const byKey = new Map(lib.map((c) => [c.key, c]));
  const fromManifest = Array.isArray(m.credits) ? m.credits : Object.values(m.credits ?? {});
  const find = (k) => byKey.get(k) ?? fromManifest.find((c) => c.key === k || c.id === k);
  const list = [];
  const add = (c) => c && c.author && list.push(c);

  // Plain photos placed directly on slides.
  for (const el of document.querySelectorAll('[data-credit]')) add(find(el.dataset.credit));
  // Detection figures and app screens on these slides: the image session's credits list names them in
  // "usedBy" ("guard-ppe-crew", "screens: guard-camera, ask-chat"). Until an image is ready, credit its fallback photo.
  const used = new Set([...document.querySelectorAll('[data-det]')].map((el) => el.dataset.det));
  for (const el of document.querySelectorAll('[data-screen]')) used.add(el.dataset.screen);
  // det.js replaces pending screens with a box; their ids stay in the manifest check below.
  for (const id of Object.keys(m.screens ?? {})) if (document.querySelector(`[data-screen="${id}"]`)) used.add(id);
  const credited = new Set();
  for (const c of fromManifest) {
    const ids = String(c.usedBy ?? '').split(/[^a-z0-9-]+/).filter((x) => used.has(x));
    if (ids.length) { add(c); ids.forEach((x) => credited.add(x)); }
  }
  for (const fig of document.querySelectorAll('[data-det]')) {
    const id = fig.dataset.det;
    const e = m.detections?.[id];
    if (e && !credited.has(id)) add(find(e.baseKey));
  }

  const seen = new Set();
  const groups = new Map();
  for (const c of list) {
    const id = c.url ?? `${c.author}|${c.source}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const src = (c.source ?? 'Other').replace(/\s*\(.*\)$/, '');
    if (!groups.has(src)) groups.set(src, new Set());
    groups.get(src).add(c.author.replace(/\s*\((Mixkit|Pexels|Pixabay|Unsplash)\)$/, ''));
  }
  const order = ['Unsplash', 'Pexels', 'Pixabay', 'Mixkit'];
  const srcs = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  box.textContent = 'Photo credits. ' + srcs.map((s) => `${s}: ${[...groups.get(s)].join(', ')}.`).join(' ');
}

window.__collateralReady = Promise.all([detReady, fillCredits()]);
