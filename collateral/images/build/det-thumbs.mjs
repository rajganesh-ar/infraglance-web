// Thumb overlays for small figures (~60 mm wide): same viewBox and registration as the full overlays,
// key boxes only, one short chip per object at ~2.4× text size, chips inside x 380–2020.
import { Overlay } from './det-lib.mjs';
const T = (id) => new Overlay(id + '-thumb', { k: 2.4, sw: 2 });

export const THUMBS = {
  'guard-forklift-proximity': () => {
    const o = T('guard-forklift-proximity');
    o.ring({ cx: 1170, cy: 1190, rx: 560, ry: 92, sev: 'info', fillOpacity: 0.05 });
    o.box({ x: 690, y: 232, w: 242, h: 154, sev: 'ok', tick: 26 });
    o.chip({ at: [690, 216], anchor: 'bl', parts: [['Helmet ok', 'main']], sev: 'ok' });
    o.box({ x: 934, y: 418, w: 470, h: 792, sev: 'info', fillOpacity: 0.03 });
    o.chip({ at: [1112, 300], parts: [['Forklift', 'main'], [' · parked', 'dim']], sev: 'info' });
    o.dim({ a: [880, 1268], b: [1372, 1214], sev: 'info' });
    o.chip({ at: [1430, 1210], anchor: 'bl', parts: [['2.4 m', 'main']], sev: 'info' });
    return o;
  },

  'guard-work-at-height': () => {
    const o = T('guard-work-at-height');
    o.box({ x: 1586, y: 410, w: 340, h: 296, sev: 'ok' });
    o.chip({ at: [1560, 420], anchor: 'tr', parts: [['Helmet ok', 'main']], sev: 'ok' });
    o.box({ x: 1574, y: 760, w: 446, h: 520, sev: 'ok', fillOpacity: 0.03 });
    o.chip({ at: [1550, 770], anchor: 'tr', parts: [['Harness ok', 'main']], sev: 'ok' });
    const k = o.chip({ at: [1550, 1010], anchor: 'tr', parts: [['Lanyard ok', 'main']], sev: 'ok' });
    o.leader({ from: k.r, to: [1722, 930], sev: 'ok' });
    return o;
  },

  'inspect-colour': () => {
    const o = T('inspect-colour');
    o.quad({ points: [[372, 806], [1080, 798], [1096, 1104], [312, 1146]], sev: 'ok', fillOpacity: 0.04, tick: 40 });
    o.quad({ points: [[1086, 762], [1702, 706], [1996, 984], [1226, 1100]], sev: 'bad', fillOpacity: 0.06, tick: 40 });
    o.chip({ at: [380, 786], anchor: 'bl', parts: [['ΔE 0.8', 'main']], sev: 'ok' });
    o.chip({ at: [1702, 690], anchor: 'br', parts: [['ΔE 2.4', 'bad']], sev: 'bad' });
    return o;
  },

  'sense-gauge': () => {
    const o = T('sense-gauge');
    const hub = [1350, 679], tip = [1584, 390];
    const TK = [[0, 940, 470, 460], [2, 1030, 350, 459], [4, 1304, 240, 441], [6, 1546, 356, 470], [8, 1790, 500, 475], [10, 1840, 780, 500], [12, 1710, 1040, 510], [14, 1436, 1160, 489], [16, 1150, 1100, 466]]
      .map(([v, x, y, r]) => ({ v, a: Math.atan2(y - hub[1], x - hub[0]), r }));
    for (let i = 1; i < TK.length; i++) while (TK[i].a < TK[i - 1].a) TK[i].a += 2 * Math.PI;
    const at = (v, k) => { const i = Math.min(TK.length - 2, Math.floor(v / 2)); const t = (v - TK[i].v) / 2; const a = TK[i].a + (TK[i + 1].a - TK[i].a) * t, r = (TK[i].r + (TK[i + 1].r - TK[i].r) * t) * k; return [hub[0] + Math.cos(a) * r, hub[1] + Math.sin(a) * r]; };
    const arc = (v0, v1) => { const p = []; for (let v = v0; v <= v1 + 1e-6; v += 0.1) p.push(at(v, 1.085)); return 'M' + p.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' L'); };
    o.raw(`<g class="bands"><path d="${arc(0, 16)}" fill="none" stroke="rgb(5 7 11 / 0.55)" stroke-width="26"/><path d="${arc(4, 8)}" fill="none" stroke="#22c55e" stroke-width="16"/><path d="${arc(8, 10)}" fill="none" stroke="#f59e0b" stroke-width="16"/><path d="${arc(10, 16)}" fill="none" stroke="#ef4444" stroke-width="16"/></g>`, 'back');
    o.raw(`<g class="needle"><path d="M${hub.join(',')} L${tip.join(',')}" stroke="rgb(5 7 11 / 0.4)" stroke-width="12"/><path d="M${hub.join(',')} L${tip.join(',')}" stroke="#22d3ee" stroke-width="6" stroke-dasharray="18 12"/><circle cx="${hub[0]}" cy="${hub[1]}" r="50" fill="none" stroke="#22d3ee" stroke-width="5"/></g>`, 'mid');
    const c = o.chip({ at: [2004, 76], anchor: 'tr', parts: [['PI-204', 'main'], [' 6.4 bar', 'info']], sev: 'info' });
    o.leader({ from: [1620, c.y + c.h], to: tip, sev: 'info', elbow: 'v' });
    return o;
  },

  'infra-tower': () => {
    const o = T('infra-tower');
    const thin = new Overlay('infra-tower-thumb-ok', { sw: 1.4 });
    for (const b of [[620, 160, 90, 210], [524, 440, 140, 200], [736, 440, 100, 200], [610, 730, 166, 260], [1640, 380, 120, 180], [1450, 140, 100, 180]]) thin.box({ x: b[0], y: b[1], w: b[2], h: b[3], sev: 'ok', fillOpacity: 0.03, tick: 18 });
    o.mid.push(...thin.mid);
    o.box({ x: 1570, y: 590, w: 130, h: 200, sev: 'warn', tick: 20 });
    o.chip({ at: [1500, 808], parts: [['Corrosion', 'main']], sev: 'warn' });
    o.box({ x: 1360, y: 980, w: 180, h: 190, sev: 'bad', tick: 22 });
    o.chip({ at: [1346, 1010], anchor: 'tr', parts: [['Broken disc', 'main']], sev: 'bad' });
    return o;
  },
};

import { CAPS, CAP_WARN, CAP_BAD } from './det-specs-f.mjs';
const ringT = (o, [x, y], r, c, w) => o.raw(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgb(5 7 11 / 0.45)" stroke-width="${w + 5}"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`);
Object.assign(THUMBS, {
  'inspect-closures': () => {
    const o = T('inspect-closures');
    ringT(o, [560, 480], 236, '#ef4444', 6);
    o.chip({ at: [396, 226], anchor: 'bl', parts: [['ΔE 2.4', 'bad']], sev: 'bad' });
    ringT(o, [1130, 365], 262, '#22c55e', 6);
    o.chip({ at: [1290, 600], parts: [['ok', 'main']], sev: 'ok' });
    o.box({ x: 1496, y: 900, w: 62, h: 62, sev: 'warn', tick: 14, fillOpacity: 0 });
    o.chip({ at: [1480, 990], anchor: 'tr', parts: [['Inclusion', 'main']], sev: 'warn' });
    return o;
  },
  'inspect-capping-line': () => {
    const o = T('inspect-capping-line');
    for (const c of CAPS) ringT(o, c, 24, '#22c55e', 4);
    o.box({ x: CAP_WARN[0] - 32, y: CAP_WARN[1] - 30, w: 64, h: 60, sev: 'warn', tick: 14, fillOpacity: 0 });
    o.box({ x: CAP_BAD[0] - 32, y: CAP_BAD[1] - 30, w: 64, h: 60, sev: 'bad', tick: 14, fillOpacity: 0 });
    o.chip({ at: [1400, 600], parts: [['Cap high', 'main']], sev: 'warn' });
    o.leader({ from: [1400, 664], to: [CAP_WARN[0] + 32, CAP_WARN[1] - 20], sev: 'warn' });
    o.chip({ at: [960, 640], anchor: 'br', parts: [['Band open', 'main']], sev: 'bad' });
    o.leader({ from: [900, 640], to: [CAP_BAD[0] - 32, CAP_BAD[1] - 10], sev: 'bad', elbow: [[900, 760], [1040, 760]] });
    return o;
  },
  'guard-moulding-cell': () => {
    const o = T('guard-moulding-cell');
    o.zone({ points: [[842, 520], [2084, 520], [2084, 1010], [1640, 1060], [842, 1060]], sev: 'warn' });
    o.chip({ at: [860, 1076], parts: [['Zone armed', 'main']], sev: 'warn' });
    o.chip({ at: [2016, 140], anchor: 'tr', parts: [['0 in zone', 'main']], sev: 'ok' });
    return o;
  },
});
