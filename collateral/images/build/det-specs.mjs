// Per-image detection layouts (coordinates in the 2400×1350 base frame; safe area x 300–2100, y 60–1290).
import { Overlay } from './det-lib.mjs';
const P = (label, value, sev) => [[label, 'main'], [' · ' + value, sev ? sev : 'dim']];

export const SPECS = {
  'guard-ppe-crew': () => {
    const o = new Overlay('guard-ppe-crew');
    // Recognisable faces: only "ok" results.
    const h1 = o.box({ x: 618, y: 98, w: 396, h: 394, sev: 'ok' });
    o.chip({ at: [606, 98], anchor: 'tr', parts: P('Helmet', '0.97'), sev: 'ok' });
    const h2 = o.box({ x: 1404, y: 300, w: 198, h: 168, sev: 'ok' });
    o.chip({ at: [1394, 300], anchor: 'tr', parts: P('Helmet', '0.93'), sev: 'ok' });
    const h3 = o.box({ x: 1508, y: 64, w: 458, h: 232, sev: 'ok' });
    o.chip({ at: [1496, 64], anchor: 'tr', parts: P('Helmet', '0.98'), sev: 'ok' });
    const v1 = o.chip({ at: [316, 560], parts: P('Hi-vis', '0.96'), sev: 'ok' });
    o.leader({ from: v1.b, to: [362, 836], sev: 'ok', elbow: 'v' });
    const v3 = o.chip({ at: [1470, 1010], anchor: 'tr', parts: P('Hi-vis', '0.95'), sev: 'ok' });
    o.leader({ from: v3.r, to: [1660, 860], sev: 'ok' });
    o.chip({ at: [800, 1276], anchor: 'bl', parts: [['PPE check', 'main'], [' · 3/3 compliant', 'ok']], sev: 'ok' });
    return o;
  },

  'inspect-surface-defect': () => {
    const o = new Overlay('inspect-surface-defect');
    o.hud({ at: [316, 76], text: 'CAM 2 · Line 4 · Recipe FLG-220' });
    o.heat({ cx: 1590, cy: 832, rx: 92, ry: 40, rotate: -6 });
    const a = o.box({ x: 600, y: 410, w: 800, h: 705, sev: 'ok', fillOpacity: 0.03, label: { parts: [['Pass', 'ok'], [' · anomaly 0.12', 'dim']], pos: 'bottom' } });
    const b = o.box({ x: 1100, y: 262, w: 792, h: 696, sev: 'bad', fillOpacity: 0.03, label: { parts: [['Reject', 'bad'], [' · anomaly 0.91', 'main']], pos: 'top-r' } });
    o.box({ x: 1530, y: 805, w: 115, h: 55, sev: 'bad', fillOpacity: 0, tick: 14 });
    const c = o.chip({ at: [1640, 1040], parts: P('Scratch', '0.91', 'bad'), sev: 'bad', sub: 'L 24 mm · w 0.4 mm' });
    o.leader({ from: [c.x + 40, c.y], to: [1590, 862], sev: 'bad', elbow: [[c.x + 40, 940]] });
    return o;
  },

  'sense-steam-leak': () => {
    const o = new Overlay('sense-steam-leak');
    o.box({ x: 1040, y: 690, w: 740, h: 430, sev: 'warn', label: { parts: P('Vapour', '0.89'), pos: 'top-r' } });
    o.box({ x: 460, y: 1070, w: 400, h: 214, sev: 'warn', label: { parts: P('Vapour', '0.81'), pos: 'top' } });
    const v = o.chip({ at: [1096, 560], anchor: 'bl', parts: [['V-12', 'main'], [' · leak suspected', 'warn']], sev: 'warn', sub: 'steam main · 4.0 bar' });
    o.leader({ from: [1152, 560], to: [1152, 812], sev: 'warn' });
    // trend panel: vapour area, last 60 min
    const X = 384, Y = 76, W = 470, H = 170;
    const pts = [0, 2, 1, 3, 2, 4, 6, 9, 13, 18, 24, 31, 38].map((v, i, a) => [X + 24 + (i / (a.length - 1)) * (W - 48), Y + H - 28 - (v / 38) * 70]);
    o.raw(`<g class="panel"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="4" fill="rgb(5 7 11 / 0.86)" stroke="#263244" stroke-width="2"/>` +
      `<text x="${X + 24}" y="${Y + 40}" font-size="25" font-weight="500" fill="#9ba7b5">VAPOUR AREA · 1 H</text>` +
      `<text x="${X + W - 24}" y="${Y + 40}" font-size="25" font-weight="600" fill="#f59e0b" text-anchor="end">+38 %</text>` +
      `<line x1="${X + 24}" y1="${Y + H - 28}" x2="${X + W - 24}" y2="${Y + H - 28}" stroke="#263244" stroke-width="2"/>` +
      `<path d="M${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L')}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round"/>` +
      `<circle cx="${pts.at(-1)[0].toFixed(1)}" cy="${pts.at(-1)[1].toFixed(1)}" r="6" fill="#f59e0b"/></g>`, 'front');
    return o;
  },

  'infra-pier-crack': () => {
    const o = new Overlay('infra-pier-crack');
    // Same trace and measurement as the website's InfraReport (points in % of the 3:2 photo), mapped to this 16:9 crop.
    const crack = [[46.2, 13.3], [46.7, 16], [48, 17.7], [48.7, 20], [48.9, 24], [48.4, 28], [48.2, 32], [48.7, 37.3], [49.1, 41.3], [50.2, 44], [51.1, 46.7], [51.5, 50.7], [52, 53.3],
      [54.5, 55.5], [57.5, 58], [60, 61.5], [62.2, 63.8], [64.4, 66.5], [66.7, 68.7], [68.9, 69.5], [71.1, 68.7], [73.3, 68.2], [75.6, 66.7], [77.8, 67.2], [80, 68.2], [84.4, 68.7], [87.2, 68.6]];
    const M = ([x, y]) => [x * 24, y * 16 - 124.8];
    o.trace({ points: crack.map(M), sev: 'bad', width: 4 });
    o.box({ x: 480, y: 372, w: 840, h: 878, sev: 'warn', fillOpacity: 0.03, label: { parts: [['D-015', 'main'], [' · vegetation', 'dim']], pos: 'top' } });
    const g1 = M([74, 67.3]), g2 = M([74, 69.0]);
    o.dim({ a: [g1[0], g1[1] - 6], b: [g2[0], g2[1] + 6], sev: '#ffffff', bar: 22 });
    const c = o.chip({ at: [2016, 700], anchor: 'tr', parts: [['D-014', 'main'], [' · w 3.5 ± 0.2 mm', 'bad']], sev: 'bad', sub: 'crack · L 1.8 m · +0.4 mm vs 2025' });
    o.leader({ from: [g1[0], c.y + c.h], to: [g1[0], g1[1] - 12], sev: 'bad' });
    o.hud({ at: [2016, 76], anchor: 'tr', text: 'Drone-02 · zoom · 0.1 mm/px · 21 Oct 10:14' });
    // 50 mm scale bar: 0.1 mm/px (as the chip says) = 500 px
    o.raw(`<g class="scale"><path d="M1520,1262 H2020 M1520,1250 V1274 M2020,1250 V1274" stroke="rgb(5 7 11 / 0.5)" stroke-width="7" fill="none"/><path d="M1520,1262 H2020 M1520,1250 V1274 M2020,1250 V1274" stroke="#eef3f8" stroke-width="3" fill="none"/><text x="1770" y="1236" text-anchor="middle" font-size="28" font-weight="500" fill="#eef3f8" stroke="rgb(5 7 11 / 0.6)" stroke-width="5" paint-order="stroke">50 mm</text></g>`, 'front');
    return o;
  },
};

import { SPECS_B } from './det-specs-b.mjs';
Object.assign(SPECS, SPECS_B);
import { SPECS_C } from './det-specs-c.mjs';
Object.assign(SPECS, SPECS_C);
import { SPECS_D } from './det-specs-d.mjs';
Object.assign(SPECS, SPECS_D);
import { SPECS_E } from './det-specs-e.mjs';
Object.assign(SPECS, SPECS_E);
import { SPECS_F } from './det-specs-f.mjs';
Object.assign(SPECS, SPECS_F);
