/**
 * Real UI screens of the Infraglance desktop apps (D:/claude/infraglance-desktop, WPF) for the website.
 *
 * Source: the apps' own `--capture` output at 2x (2880×1800 PNG, 192 dpi), screenshots/<set>/<name>@2x.png.
 * Output: public/media/app/<id>-<w>.<hash>.{avif,jpg} at 2880 (2x), 1440 (1x), 960 (3D monitor texture)
 * and 480 (thumbnail), plus src/data/app-screens.json (the manifest the site reads).
 *
 *   node scripts/app-screens.mjs [path/to/infraglance-desktop/screenshots]
 *
 * The screens are pixel-exact UI (text, 1 px chart lines): no grading, no sharpening, high encode quality.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(process.argv[2] ?? 'D:/claude/infraglance-desktop/screenshots');
const OUT = join(ROOT, 'public/media/app');
const MANIFEST = join(ROOT, 'src/data/app-screens.json');
const WIDTHS = [2880, 1440, 960, 480];

/** [id, app, source set, file, title, caption] — captions say what the screen shows, nothing more. */
const SCREENS = [
  ['guard-live', 'guard', 'ppe', '01-live', 'Live cameras', 'Annotated feeds per camera with PPE boxes, zone occupancy and the live violation list.'],
  ['guard-focus', 'guard', 'ppe', '02-live-focus', 'Camera focus', 'One camera full size, with its event timeline and the open violation in context.'],
  ['guard-alerts', 'guard', 'ppe', '03-alerts', 'Alerts', 'Every violation with severity, camera, zone, duration and status; acknowledge and resolve in place.'],
  ['guard-alert-detail', 'guard', 'ppe', '04-alert-detail', 'Alert evidence', 'Evidence photo, person handle, corrective-action checklist and notes for the shift log.'],
  ['guard-analytics', 'guard', 'ppe', '05-analytics', 'Analytics', 'Compliance trend, violations by PPE type, by hour and by zone, from the API datapoints.'],
  ['guard-zones', 'guard', 'ppe', '06-zones', 'Zones & cameras', 'Zones with their mandatory PPE rules, camera health and credentials.'],
  ['guard-reports', 'guard', 'ppe', '08-reports', 'Reports', 'Compliance summary PDF, alert log and zone audit CSVs, and scheduled reports.'],
  ['inspect-station', 'inspect', 'anomaly', '01-station', 'Inspection station', 'Live part feed with the anomaly heatmap, the score against the threshold and the decision.'],
  ['inspect-review', 'inspect', 'anomaly', '02-review-queue', 'Review queue', 'Parts in the review band or rejected, ready to confirm or release as good.'],
  ['inspect-review-detail', 'inspect', 'anomaly', '03-review-detail', 'Defect review', 'The part, its heatmap, score and ΔE, with confirm and release that feed the training set.'],
  ['inspect-spc', 'inspect', 'anomaly', '04-trends-spc', 'Trends & SPC', 'X̄ control chart with limits and run rules, a defect Pareto and reject rate by hour and shift.'],
  ['inspect-colour', 'inspect', 'anomaly', '05-colour-deltae', 'Colour ΔE2000', 'Each lot measured against its reference under D65, scored with CIEDE2000 against the tolerance.'],
  ['inspect-lots', 'inspect', 'anomaly', '06-lots', 'Lots & traceability', 'Every part traced to its lot, station, model version and decision; hold or release a lot.'],
  ['inspect-model', 'inspect', 'anomaly', '07-model-threshold', 'Model & threshold', 'Good-part model versions and threshold tuning with false-reject, escape and review-load rates.'],
];

const hashOf = (file) => createHash('sha1').update(readFileSync(file)).update(WIDTHS.join()).digest('hex').slice(0, 8);

mkdirSync(OUT, { recursive: true });
const keep = new Set();
const manifest = {};
for (const [id, app, set, file, title, caption] of SCREENS) {
  const src = join(SRC, set, `${file}@2x.png`);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const h = hashOf(src);
  const meta = await sharp(src).metadata();
  const { dominant } = await sharp(src).stats();
  const avif = [];
  const jpg = [];
  for (const w of WIDTHS) {
    const base = `${id}-${w}.${h}`;
    const a = join(OUT, `${base}.avif`);
    const j = join(OUT, `${base}.jpg`);
    keep.add(`${base}.avif`).add(`${base}.jpg`);
    if (!existsSync(a) || !existsSync(j)) {
      // Lanczos down-scaling keeps 1 px lines and small text crisp; 4:4:4 chroma keeps coloured text clean.
      const pipe = sharp(src).flatten({ background: '#05070b' }).resize(w, null, { kernel: 'lanczos3' });
      await pipe.clone().avif({ quality: w >= 1440 ? 62 : 58, effort: 5, chromaSubsampling: '4:4:4' }).toFile(a);
      await pipe.clone().jpeg({ quality: w >= 1440 ? 86 : 82, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' }).toFile(j);
    }
    avif.push([w, `/media/app/${base}.avif`]);
    jpg.push([w, `/media/app/${base}.jpg`]);
  }
  manifest[id] = {
    app,
    title,
    caption,
    w: meta.width,
    h: meta.height,
    color: `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`,
    avif,
    jpg,
  };
  console.log(id, h);
}
// Drop files from earlier runs that no screen uses any more.
for (const f of readdirSync(OUT)) if (!keep.has(f)) rmSync(join(OUT, f));
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${SCREENS.length} screens → ${OUT}`);
