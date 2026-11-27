// Fills detection figures, app screens and inline SVGs from /collateral/images/manifest.json.
// Include it with <script type="module" src="/collateral/brand/det.js"></script>.
//
//   <figure class="det" data-det="guard-ppe-crew" style="aspect-ratio: 16 / 9"></figure>
//       → graded base photo + inlined vector overlay (once the image session marks it "ready"),
//         or the fallback photo with a small "pending" tag until then.
//       Add data-overlay="thumb" on small figures to use the entry's "thumb" overlay (fewer, larger chips)
//       when the manifest has one; otherwise the full overlay is used.
//   <img data-screen="hub-overview" data-variant="laptop" alt="…">
//       → /collateral/images/screens/… PNG (variant: "plain" (default), "laptop" or "phone").
//   <img data-inline-svg src="/collateral/brand/logo-on-dark.svg" alt="Infraglance">
//       → replaced by the SVG itself, so its text uses the page's IBM Plex fonts.
//
// window.__collateralReady resolves when everything is in place and decoded (tools/pdf.mjs waits for it).
const MANIFEST = '/collateral/images/manifest.json';

async function svgText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}
function toSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}
const decode = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined));

async function run() {
  const m = await (await fetch(MANIFEST, { cache: 'no-store' })).json();
  const waits = [];

  for (const fig of document.querySelectorAll('[data-det]')) {
    const id = fig.dataset.det;
    const e = m.detections?.[id];
    fig.replaceChildren();
    if (!e) {
      fig.insertAdjacentHTML('beforeend', `<span class="det-pending">unknown detection id: ${id}</span>`);
      continue;
    }
    const ready = e.status === 'ready';
    const img = new Image();
    img.className = 'det-base';
    img.alt = fig.dataset.alt ?? e.alt ?? '';
    img.src = ready ? e.base : e.fallback;
    fig.append(img);
    waits.push(decode(img));
    if (ready) {
      const wrap = document.createElement('div');
      wrap.className = 'det-overlay';
      // data-overlay="thumb" picks the Images session's simplified overlay (fewer, larger chips) for small figures.
      const useThumb = fig.dataset.overlay === 'thumb' && e.thumb;
      const svg = toSvg(await svgText(useThumb ? e.thumb : e.overlay));
      // Crop exactly like object-fit: cover, centred, so photo and overlay stay registered at any aspect.
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      wrap.append(svg);
      fig.append(wrap);
    } else {
      fig.insertAdjacentHTML('beforeend', `<span class="det-pending">${id} · detections pending</span>`);
    }
  }

  for (const img of document.querySelectorAll('img[data-screen]')) {
    const e = m.screens?.[img.dataset.screen];
    const variant = img.dataset.variant ?? 'plain';
    const src = e?.status === 'ready' ? e[variant] : null;
    if (src) {
      img.src = src;
      img.classList.add('screen');
      waits.push(decode(img));
    } else {
      const box = document.createElement('div');
      box.className = 'screen-pending ' + img.className;
      box.style.cssText = img.style.cssText;
      box.textContent = `screen pending: ${img.dataset.screen} (${variant})`;
      img.replaceWith(box);
    }
  }

  for (const img of document.querySelectorAll('img[data-inline-svg]')) {
    const svg = toSvg(await svgText(img.getAttribute('src')));
    if (img.className) svg.setAttribute('class', img.className);
    if (img.getAttribute('style')) svg.setAttribute('style', img.getAttribute('style'));
    svg.setAttribute('role', 'img');
    if (img.alt) svg.setAttribute('aria-label', img.alt);
    img.replaceWith(svg);
  }

  await Promise.all(waits);
  await document.fonts.ready;
}

window.__collateralReady = run().catch((err) => {
  console.error('[det.js]', err);
  throw err;
});
