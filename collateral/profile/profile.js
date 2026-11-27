// Profile helpers: fills <img data-photo="key"> from the site's media library and builds the
// photo-credit list on the back page. Chains onto det.js's window.__collateralReady so
// tools/pdf.mjs waits for both.
const prev = window.__collateralReady;

const j = async (url) => (await fetch(url, { cache: 'no-store' })).json();
const decode = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined));

async function run() {
  const [media, manifest] = await Promise.all([j('/src/data/media.json'), j('/collateral/images/manifest.json')]);
  const credits = [];
  const add = (c) => c && typeof c === 'object' && credits.push(c);

  // Plain photos from the site library.
  const waits = [];
  for (const img of document.querySelectorAll('img[data-photo]')) {
    const e = media[img.dataset.photo];
    const p = e?.type === 'video' ? e.poster : e;
    if (!p?.jpg) { console.error(`[profile] unknown photo: ${img.dataset.photo}`); continue; }
    const want = Number(img.dataset.w ?? 1920);
    const jpg = p.jpg.find(([w]) => w === want) ?? p.jpg.find(([w]) => w === 1920) ?? p.jpg.at(-1);
    img.src = '/public' + jpg[1];
    if (!img.hasAttribute('alt')) img.alt = p.alt ?? '';
    waits.push(decode(img));
    add(e.credit);
  }

  // Detection base photos: the image session's own credits, else the library photo behind the fallback.
  for (const c of manifest.credits ?? []) add(c);
  for (const fig of document.querySelectorAll('[data-det]')) {
    const d = manifest.detections?.[fig.dataset.det];
    if (!d) continue;
    if (d.status === 'ready' && d.credit) add(d.credit);
    else add(media[d.baseKey]?.credit ?? media[d.baseKey]?.poster?.credit);
  }

  const seen = new Set();
  const rows = [];
  for (const c of credits) {
    const author = c.author ?? c.name ?? '';
    const source = c.source ?? '';
    const key = `${author}|${source}`.toLowerCase();
    if (!author || seen.has(key)) continue;
    seen.add(key);
    rows.push({ author, source });
  }
  rows.sort((a, b) => a.author.localeCompare(b.author, 'en-GB'));
  const box = document.getElementById('credits');
  if (box) box.innerHTML = rows.map((r) => `<span><em>${r.author}</em> · ${r.source}</span>`).join('');

  await Promise.all(waits);
}

window.__collateralReady = (async () => {
  await Promise.all([prev, run()]);
  await document.fonts.ready;
})().catch((err) => {
  console.error('[profile]', err);
  throw err;
});
