// Detection layouts, part 3.
import { Overlay } from './det-lib.mjs';
const P = (label, value, sev) => [[label, 'main'], [' · ' + value, sev ? sev : 'dim']];
const path = (pts) => 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L');

export const SPECS_C = {
  'sense-gauge': () => {
    const o = new Overlay('sense-gauge');
    const hub = [1350, 679], tip = [1584, 390];
    // measured tick directions (bar → angle about the hub) and outer tick radii on this crop (dial seen at an angle)
    const T = [[0, 940, 470, 460], [2, 1030, 350, 459], [4, 1304, 240, 441], [6, 1546, 356, 470], [8, 1790, 500, 475], [10, 1840, 780, 500], [12, 1710, 1040, 510], [14, 1436, 1160, 489], [16, 1150, 1100, 466]]
      .map(([v, x, y, r]) => { let a = Math.atan2(y - hub[1], x - hub[0]); return { v, a, r }; });
    for (let i = 1; i < T.length; i++) while (T[i].a < T[i - 1].a) T[i].a += 2 * Math.PI;
    const at = (v, k) => { let i = Math.min(T.length - 2, Math.floor(v / 2)); const t = (v - T[i].v) / 2; const a = T[i].a + (T[i + 1].a - T[i].a) * t, r = (T[i].r + (T[i + 1].r - T[i].r) * t) * k; return [hub[0] + Math.cos(a) * r, hub[1] + Math.sin(a) * r]; };
    const arc = (v0, v1, k) => { const pts = []; for (let v = v0; v <= v1 + 1e-6; v += 0.1) pts.push(at(v, k)); return pts; };
    const K = 1.085;
    o.raw(`<g class="bands"><path d="${path(arc(0, 16, K))}" fill="none" stroke="rgb(5 7 11 / 0.55)" stroke-width="18" stroke-linecap="butt"/>` +
      `<path d="${path(arc(4, 8, K))}" fill="none" stroke="#22c55e" stroke-width="10"/>` +
      `<path d="${path(arc(8, 10, K))}" fill="none" stroke="#f59e0b" stroke-width="10"/>` +
      `<path d="${path(arc(10, 16, K))}" fill="none" stroke="#ef4444" stroke-width="10"/></g>`, 'back');
    // needle read-out
    o.raw(`<g class="needle"><path d="M${hub.join(',')} L${tip.join(',')}" stroke="rgb(5 7 11 / 0.4)" stroke-width="8"/><path d="M${hub.join(',')} L${tip.join(',')}" stroke="#22d3ee" stroke-width="3" stroke-dasharray="12 8"/><circle cx="${hub[0]}" cy="${hub[1]}" r="46" fill="none" stroke="#22d3ee" stroke-width="2.5"/></g>`, 'mid');
    o.box({ x: 760, y: 178, w: 1172, h: 1024, sev: 'info', fillOpacity: 0, label: { parts: [['Gauge', 'main'], [' · 0–16 bar · 0.99', 'dim']], pos: 'top' } });
    const c = o.chip({ at: [2004, 76], anchor: 'tr', parts: [['PI-204', 'main'], [' · 6.4 bar', 'info']], sev: 'info', sub: 'normal 4.0–8.0 · 14:32:11' });
    o.leader({ from: [1620, c.y + c.h], to: tip, sev: 'info', elbow: 'v' });
    const h = at(8, 1.15), hh = at(10, 1.13);
    o.chip({ at: [h[0] + 8 - 40, h[1] - 6], anchor: 'ml', parts: [['H', 'main'], [' 8.0', 'warn']], sev: 'warn', dot: false });
    o.chip({ at: [hh[0] + 6 - 80, hh[1]], anchor: 'ml', parts: [['HH', 'main'], [' 10.0', 'bad']], sev: 'bad', dot: false });
    // 24 h trend
    const X = 384, Y = 1070, W = 420, H = 200;
    const vals = [6.2, 6.3, 6.1, 6.2, 6.4, 6.5, 6.3, 6.2, 6.3, 6.4, 6.6, 6.5, 6.4, 6.3, 6.4, 6.5, 6.4, 6.3, 6.4, 6.5, 6.4, 6.3, 6.4, 6.4];
    const py = (v) => Y + H - 30 - ((v - 4) / 4) * (H - 90);
    const pts = vals.map((v, i) => [X + 24 + (i / (vals.length - 1)) * (W - 48), py(v)]);
    o.raw(`<g class="panel"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="4" fill="rgb(5 7 11 / 0.86)" stroke="#263244" stroke-width="2"/>` +
      `<text x="${X + 24}" y="${Y + 40}" font-size="25" font-weight="500" fill="#9ba7b5">PI-204 · 24 h</text><text x="${X + W - 24}" y="${Y + 40}" font-size="25" font-weight="600" fill="#22d3ee" text-anchor="end">6.4 bar</text>` +
      `<rect x="${X + 24}" y="${py(8).toFixed(1)}" width="${W - 48}" height="${(py(4) - py(8)).toFixed(1)}" fill="#22c55e" fill-opacity="0.08"/>` +
      `<line x1="${X + 24}" y1="${py(8).toFixed(1)}" x2="${X + W - 24}" y2="${py(8).toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6 6"/>` +
      `<path d="${path(pts)}" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0].toFixed(1)}" cy="${pts.at(-1)[1].toFixed(1)}" r="6" fill="#22d3ee"/></g>`, 'front');
    return o;
  },
};
