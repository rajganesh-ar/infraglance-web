// Detection layouts, part 2 (coordinates in the 2400×1350 base frame; safe area x 300–2100, y 60–1290).
import { Overlay } from './det-lib.mjs';
const P = (label, value, sev) => [[label, 'main'], [' · ' + value, sev ? sev : 'dim']];

export const SPECS_B = {
  'guard-work-at-height': () => {
    const o = new Overlay('guard-work-at-height');
    o.hud({ at: [316, 76], text: 'CAM-11 · Tank T-2 east · 25 fps', live: true });
    o.box({ x: 1586, y: 410, w: 340, h: 296, sev: 'ok' });
    o.chip({ at: [1572, 410], anchor: 'tr', parts: P('Helmet', '0.98'), sev: 'ok' });
    o.box({ x: 1574, y: 760, w: 446, h: 520, sev: 'ok', fillOpacity: 0.03 });
    o.chip({ at: [1560, 760], anchor: 'tr', parts: P('Harness', '0.96'), sev: 'ok' });
    const k = o.chip({ at: [1500, 1000], anchor: 'mr', parts: [['Lanyard', 'main'], [' · on dorsal D-ring', 'ok']], sev: 'ok' });
    o.leader({ from: k.r, to: [1722, 930], sev: 'ok' });
    o.chip({ at: [384, 1274], anchor: 'bl', parts: [['Tie-off', 'main'], [' · anchor out of view', 'info']], sev: 'info', sub: 'Permit WAH-118 · confirm at anchor' });
    return o;
  },

  'inspect-pcb': () => {
    const o = new Overlay('inspect-pcb');
    o.hud({ at: [316, 76], text: 'AOI-1 · Board 220-14 · pre-reflow' });
    o.quad({ points: [[1380, 284], [1794, 516], [880, 1284], [462, 984]], sev: 'info', dashed: true, fillOpacity: 0.02 });
    o.chip({ at: [920, 1210], parts: [['Board', 'main'], [' · fiducials 3/3', 'dim']], sev: 'info' });
    o.quad({ points: [[1108, 548], [1288, 642], [1166, 762], [1020, 670]], sev: 'warn', fillOpacity: 0.04, tick: 26 });
    const u = o.chip({ at: [940, 520], anchor: 'br', parts: [['U1', 'main'], [' · Δθ 2.1°', 'warn']], sev: 'warn', sub: 'offset 0.21 mm · re-seat' });
    o.leader({ from: [u.x + u.w - 30, u.y + u.h], to: [1040, 662], sev: 'warn', elbow: 'v' });
    o.box({ x: 1262, y: 532, w: 112, h: 98, sev: 'info', tick: 16, fillOpacity: 0 });
    o.chip({ at: [1300, 380], anchor: 'bl', parts: [['Y1', 'main'], [' · pads clear · next to place', 'info']], sev: 'info' });
    o.leader({ from: [1318, 380], to: [1318, 524], sev: 'info' });
    const p1 = o.chip({ at: [1500, 860], parts: [['Pin 1', 'main'], [' · polarity ok', 'ok']], sev: 'ok' });
    o.leader({ from: p1.l, to: [1252, 650], sev: 'ok', elbow: [[1400, 887]] });
    return o;
  },

  'inspect-colour': () => {
    const o = new Overlay('inspect-colour');
    const A = [[372, 806], [1080, 798], [1096, 1104], [312, 1146]];
    const B = [[1086, 762], [1702, 706], [1996, 984], [1226, 1100]];
    o.quad({ points: A, sev: 'ok', fillOpacity: 0.03 });
    o.quad({ points: B, sev: 'bad', fillOpacity: 0.04 });
    const lerp = (q, u, v) => {
      const t = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
      const b = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
      return [t[0] + (b[0] - t[0]) * v, t[1] + (b[1] - t[1]) * v];
    };
    const samples = (q, c) => {
      for (const u of [0.2, 0.5, 0.8]) for (const v of [0.3, 0.7]) {
        const [x, y] = lerp(q, u, v);
        o.raw(`<rect x="${(x - 13).toFixed(1)}" y="${(y - 13).toFixed(1)}" width="26" height="26" fill="none" stroke="rgb(5 7 11 / 0.6)" stroke-width="6"/><rect x="${(x - 13).toFixed(1)}" y="${(y - 13).toFixed(1)}" width="26" height="26" fill="none" stroke="${c}" stroke-width="2.5"/>`);
      }
    };
    samples(A, '#22c55e');
    samples(B, '#ef4444');
    o.chip({ at: [372, 794], anchor: 'bl', parts: [['Lot 24-117', 'main'], [' · ΔE 0.8', 'ok']], sev: 'ok' });
    o.chip({ at: [1702, 694], anchor: 'br', parts: [['Lot 24-118', 'main'], [' · ΔE 2.4', 'bad']], sev: 'bad', sub: 'limit 1.5 · hold lot' });
    // per-lot legend panel
    const X = 384, Y = 76, W = 560;
    const rows = [['24-116', '#26386a', '0.6', 'ok'], ['24-117', '#24356a', '0.8', 'ok'], ['24-118', '#33477e', '2.4', 'bad']];
    let s = `<g class="panel"><rect x="${X}" y="${Y}" width="${W}" height="${64 + rows.length * 58}" rx="4" fill="rgb(5 7 11 / 0.86)" stroke="#263244" stroke-width="2"/>`;
    s += `<text x="${X + 24}" y="${Y + 42}" font-size="25" font-weight="500" fill="#9ba7b5">ΔE2000 VS MASTER · LIMIT 1.5</text>`;
    rows.forEach(([lot, sw, de, sev], i) => {
      const y = Y + 64 + i * 58;
      const c = sev === 'ok' ? '#22c55e' : '#ef4444';
      const lim = X + 300 + (1.5 / 3) * 170;
      s += `<rect x="${X + 24}" y="${y + 8}" width="38" height="38" rx="2" fill="${sw}" stroke="#46566a" stroke-width="2"/>`;
      s += `<text x="${X + 82}" y="${y + 38}" font-size="29" font-weight="500" fill="#eef3f8">Lot ${lot}</text>`;
      s += `<rect x="${X + 300}" y="${y + 21}" width="${((Math.min(3, +de) / 3) * 170).toFixed(1)}" height="12" rx="2" fill="${c}"/>`;
      s += `<line x1="${lim}" y1="${y + 12}" x2="${lim}" y2="${y + 42}" stroke="#c3cdd8" stroke-width="2"/>`;
      s += `<text x="${X + W - 24}" y="${y + 38}" font-size="29" font-weight="600" fill="${c}" text-anchor="end">${de}</text>`;
    });
    o.raw(s + '</g>', 'front');
    return o;
  },

  'sense-thermal-panel': () => {
    const o = new Overlay('sense-thermal-panel');
    o.hud({ at: [316, 76], text: 'TH-03 · MCC-2 · ε 0.95' });
    o.heat({ cx: 1452, cy: 236, rx: 80, ry: 118, stops: [[0, '#fff7c2', 0.95], [0.22, '#fbbf24', 0.85], [0.5, '#ef4444', 0.55], [1, '#7c3aed', 0]] });
    o.heat({ cx: 1764, cy: 1098, rx: 74, ry: 58, stops: [[0, '#fde68a', 0.8], [0.4, '#f59e0b', 0.55], [1, '#ef4444', 0]] });
    o.box({ x: 1402, y: 138, w: 100, h: 212, sev: 'bad', tick: 18 });
    const h = o.chip({ at: [1366, 400], anchor: 'tr', parts: [['K14', 'main'], [' · 84 °C', 'bad']], sev: 'bad', sub: 'limit 70 °C · +14 °C' });
    o.leader({ from: h.r, to: [1452, 352], sev: 'bad', elbow: 'h' });
    o.box({ x: 1716, y: 1050, w: 96, h: 96, sev: 'warn', tick: 16 });
    o.chip({ at: [1704, 1050], anchor: 'tr', parts: [['X4.7', 'main'], [' · 63 °C', 'warn']], sev: 'warn' });
    o.box({ x: 768, y: 524, w: 632, h: 256, sev: 'ok', fillOpacity: 0.02, label: { parts: [['PLC', 'main'], [' · 41 °C', 'ok']], pos: 'bottom' } });
    // temperature scale
    const X = 384, Y = 1162;
    o.defs.push(`<linearGradient id="tscale"><stop offset="0" stop-color="#1e1b4b"/><stop offset="0.3" stop-color="#7c3aed"/><stop offset="0.55" stop-color="#ef4444"/><stop offset="0.8" stop-color="#fbbf24"/><stop offset="1" stop-color="#fff7c2"/></linearGradient>`);
    const mx = (X + 24 + ((84 - 20) / 70) * 420).toFixed(1);
    o.raw(`<g class="panel"><rect x="${X}" y="${Y}" width="468" height="112" rx="4" fill="rgb(5 7 11 / 0.86)" stroke="#263244" stroke-width="2"/>` +
      `<text x="${X + 24}" y="${Y + 38}" font-size="25" font-weight="500" fill="#9ba7b5">MAX</text><text x="${X + 444}" y="${Y + 38}" font-size="25" font-weight="600" fill="#ef4444" text-anchor="end">84 °C</text>` +
      `<rect x="${X + 24}" y="${Y + 56}" width="420" height="14" rx="2" fill="url(#tscale)"/><path d="M${mx},${Y + 50} v26" stroke="#eef3f8" stroke-width="3"/>` +
      `<text x="${X + 24}" y="${Y + 100}" font-size="23" fill="#9ba7b5">20 °C</text><text x="${X + 444}" y="${Y + 100}" font-size="23" fill="#9ba7b5" text-anchor="end">90 °C</text></g>`, 'front');
    return o;
  },
};
