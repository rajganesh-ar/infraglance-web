# Infraglance collateral: shared contract

Three sessions build the company collateral at the same time, in this folder of the website repo:

| Session | Owns (writes only here) | Delivers |
|---|---|---|
| **Images** | `collateral/images/**`, `collateral/assets/raw/**` | 17 detection images (graded base photo + vector overlay + flattened PNG), 9 app screens (plain, laptop, phone), credits, `images/manifest.json` |
| **Profile** | `collateral/profile/**`, `collateral/out/infraglance-company-profile.pdf` | A4 portrait company profile, about 16 pages |
| **Deck** | `collateral/deck/**`, `collateral/out/infraglance-presentation.pdf` | 16:9 presentation, about 20 slides |

The coordinating session owns `collateral/CONTRACT.md`, `collateral/brand/**` and `collateral/tools/**`. Read them, don't edit them. If you need a change there, say so in your report.

**Never** edit anything outside your folders: not `src/`, `public/`, `package.json`, `astro.config.mjs` or `.gitignore`. Don't commit, don't switch branches, don't run `npm install`, `astro build` or `astro dev`. Another session may be using the folder.

## Ports (one static server each)

```bash
node collateral/tools/serve.mjs <port>     # serves the project root, no cache
```

Images 4510 · Profile 4512 · Deck 4513 · coordinator 4509. The server serves the **project root**, so pages use absolute paths: `/collateral/...`, `/public/media/p/...`, `/node_modules/...`.

## Rendering

```bash
node collateral/tools/pdf.mjs http://localhost:4512/collateral/profile/ collateral/out/infraglance-company-profile.pdf --shots=collateral/review/profile --scale=1.5
```

- `pdf.mjs` waits for fonts and for `det.js`, prints with the page's CSS `@page` size and saves one review PNG per `.page` / `.slide`. Open those PNGs with the Read tool to check your work.
- It exits 1 and lists the problem if any request fails or the page logs an error.
- `collateral/review/` is gitignored scratch space.
- **Final deliverables** (coordinator): `node collateral/tools/build.mjs [profile|deck]` renders each document to `collateral/out/<name>-print.pdf` (full resolution, for print) and `collateral/out/<name>.pdf` (images downsampled for email, under about 10 MB). Both get document properties and one bookmark per page: `data-bookmark` on the `.page`/`.slide`, else its eyebrow, else its first heading. Needs PyMuPDF (`pip install pymupdf`).
- Uses system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` and `puppeteer-core` from the project.

## Brand

- Include `<link rel="stylesheet" href="/collateral/brand/brand.css">` and `<script type="module" src="/collateral/brand/det.js"></script>`.
- **Fonts:** IBM Plex Sans (variable) and IBM Plex Mono.
- **Colours:**
  - Ink `#05070b`, navy `#0a1422`, mist `#eaeff4`, paper `#f5f7fa`.
  - Cyan accent `#22d3ee` on dark, `#0a7187` on light.
  - Pillar colours: Guard amber, Inspect cyan, Sense teal, Flow blue, Infra green. Each has a dark-background value and an `-l` light-background value in brand.css.
- **Shape:** radii 2 px (4 px panels, 6 px app windows). No drop-shadow-heavy or glossy styling.
- **Logo:** `<img data-inline-svg src="/collateral/brand/logo-on-dark.svg" alt="Infraglance">`, or `logo-on-light.svg`. `det.js` inlines it so its text uses Plex.
- **Look:** the same as the website, with dark ink covers and feature pages, mist/paper body pages, mono uppercase eyebrows ("— GLANCE GUARD · SAFETY"), thin hairlines and lots of air. It should read sharp, compact and expensive, not template-like.
- **House style:** en-GB spelling (colour, programme, centre); "analog" is the one exception. Use curly quotes and apostrophes (’ “ ”), en dashes for ranges, and a non-breaking space before units (6.4 bar, 3.5 mm).

## Detection images (owned by Images; used by Profile and Deck)

Markup:

```html
<figure class="det" data-det="guard-ppe-crew" style="aspect-ratio: 16 / 9"></figure>
```

- `det.js` fills it. Before the image is ready it shows the graded fallback photo with a small "pending" tag. Once the Images session marks it `"status": "ready"` in `images/manifest.json`, it shows `images/base/<id>.jpg` plus the inlined vector overlay `images/detections/<id>.svg`.
- Both are cropped like `object-fit: cover`, centred. Any aspect from 16:9 to 4:3 keeps every detection in frame.
- **Thumb overlays (small figures):** for figures under about 90 mm wide, add `data-overlay="thumb"`. `det.js` then uses the manifest entry's `"thumb"` path (`images/detections/<id>-thumb.svg`: same viewBox and registration, the key boxes only, one short chip per object at about 2.4× the normal text size) and falls back to the full overlay if there is none.
- **Edge margin:** keep chips at least 80 units inside the safe-area edge (x 380–2020) so 4:3 crops don't jam them against the frame.
- **Base:** 2400×1350 JPEG (16:9), graded cool like the site's media.
- **Overlay:** SVG, `viewBox="0 0 2400 1350"`, vector only (no embedded raster), text in IBM Plex Mono/Sans.
- **Safe area:** every box, chip and pointer stays inside x 300–2100 and y 60–1290.
- **Pack PNG:** `images/pack/<id>.png`, 2400×1350 flattened (photo + overlay), for proposals and social.
- **Overlay style** matches the app (see `src/components/mockups/CameraFeed.astro` and the 3D chips in `src/three/core/labels.ts`):
  - **Boxes:** 3 px strokes with corner ticks.
  - **Chips:** ink `rgb(5 7 11 / 0.86)` background, 1.5 px border in the severity colour, a severity dot, and IBM Plex Mono 500 text such as "No helmet · 0.94".
  - **Pointers:** 1.5 px leader lines that end on the object with a small dot.
  - **Zones:** dashed polygons with a 10% fill.
  - **Severity colours:** bad `#ef4444`, warn `#f59e0b`, ok `#22c55e`, info `#22d3ee`.
- **Demo values** must match the website's demo data: "No helmet · 0.94"; Belt drift +41 mm; Idler 11 · 86 °C; PI-204 6.4 bar; D-014 crack w 3.5 ± 0.2 mm, +0.4 mm vs 2025; Flow 7 stops = 11.9 min.

IDs (subjects and suggested base photos are in the manifest):

| Area | IDs |
|---|---|
| Cover | `cover-site` |
| Guard | `guard-ppe-crew`, `guard-forklift-proximity`, `guard-restricted-zone`, `guard-work-at-height` |
| Inspect | `inspect-surface-defect`, `inspect-pack-label`, `inspect-pcb`, `inspect-colour` |
| Sense | `sense-steam-leak`, `sense-gauge`, `sense-thermal-panel`, `sense-walkway-spill` |
| Flow | `flow-conveyor` |
| Infra | `infra-pier-crack`, `infra-road-defects`, `infra-tower` |

## App screens (owned by Images)

```html
<img data-screen="hub-overview" data-variant="laptop" alt="Glance Hub overview">
```

- Variants: `plain` (default), `laptop` or `phone`.
- IDs: `hub-overview`, `hub-sense`, `studio-rules`, `ask-chat`, `guard-camera`, `guard-phone`, `inspect-hmi`, `flow-timeline`, `infra-report`.
- They are captured from the website's own mockups at 3× scale, with the "Demo data" pills hidden. Transparent background around device frames.

## Content (Profile and Deck)

- **Sources:** take copy from the website, condensed. Pillars and capabilities are in `src/data/pillars.ts`, products and their phases (`Available` / `Early access` / `Roadmap`) in `src/data/products.ts`. Industries, use cases, FAQ and contact are in `src/data/{industries,usecases,faq,site}.ts`, and the engagement method and privacy positions are on the pages under `src/pages/`.
- **Contact:** infraglance.com, hello@infraglance.com, sales@infraglance.com (from `src/data/site.ts`). No street address or legal entity name; the owner will supply those later.

## Honesty rules (non-negotiable)

- No customer names or logos, testimonials, case studies, invented metrics or results, certifications, awards, office addresses or team members.
- Infraglance is built by a team with **8+ years of industrial experience** and runs a **design-partner programme** (the owner’s positioning: don’t call it a “new company”). Never claim existing customers or deployments. Product status must match `products.ts`: Infra has no Available product, so present it as Early access or Roadmap.
- Detection images and app screens carry **no "Illustrative" or "Demo data" tags** (the owner's decision). Instead, the back page of each document carries one fine-print line with the photo credits: "Photos: licensed stock (Unsplash, Pexels). Product visuals show representative detections and sample data."
- Violation labels (No helmet, Breach and so on) go **only** on people whose faces can't be recognised (from behind, far away or blurred). Recognisable people get only neutral or "ok" chips. Stock licences forbid showing identifiable people in a negative light.
- No stock photo of a person presented as Infraglance staff or as a customer's site.

## Coordination

- The **Images** session updates `images/manifest.json` as each item is finished (`"status": "ready"`) and sets `"complete": true` at the end. It adds every photo's credit to `"credits"`: author, source, URL and licence. For the existing library, copy them from `assets/credits.json`.
- **Profile** and **Deck** build with the fallbacks and placeholders straight away. They re-render once the manifest says `complete: true`, or when the coordinating session tells them to. Layouts must not depend on anything but the IDs and the 16:9-to-4:3 crop range.
- The owner prefers **fast turnaround**. Aim for about 1½ hours. No long self-review loops: render, look at the PNGs, fix what's visibly off, move on.
