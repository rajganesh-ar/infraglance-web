// Detection layouts, part 6: closures, capping line, moulding cell (tailored deck).
import { Overlay } from './det-lib.mjs';
const P = (label, value, sev) => [[label, 'main'], [' · ' + value, sev ? sev : 'dim']];
const ring = (o, [x, y], r, c, w = 3) => o.raw(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgb(5 7 11 / 0.45)" stroke-width="${w + 4}"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`);

// Cap centres measured on base/inspect-capping-line.jpg (2400×1350).
export const CAPS = [[1103, 777], [1010, 800], [1180, 802], [993, 848], [1270, 777], [1272, 817], [1303, 853], [1237, 890], [1003, 895], [1077, 920], [1180, 930], [1092, 963], [988, 948], [910, 822], [937, 777], [833, 853], [885, 920], [899, 975], [1029, 750], [1190, 750], [1360, 791], [1357, 750]];
export const CAP_WARN = [1185, 842];
export const CAP_BAD = [1089, 867];

export const SPECS_F = {
  'inspect-closures': () => {
    const o = new Overlay('inspect-closures');
    o.hud({ at: [384, 76], text: 'CAM-05 · Closure sorter · 38 mm caps' });
    // colour off on a cap of the light-blue lot (a measured value; ΔE 2.4 is near the limit of what the eye sees)
    ring(o, [560, 480], 236, '#ef4444');
    o.chip({ at: [396, 226], anchor: 'bl', parts: [['Lot 24-118', 'main'], [' · ΔE 2.4', 'bad']], sev: 'bad', sub: 'limit 1.5 · divert' });
    ring(o, [1130, 365], 262, '#22c55e');
    o.chip({ at: [1330, 566], parts: [['Cap', 'main'], [' · ok · 0.98', 'ok']], sev: 'ok' });
    // real light inclusion on the green cap
    o.box({ x: 1508, y: 912, w: 38, h: 38, sev: 'warn', tick: 10, fillOpacity: 0 });
    const s = o.chip({ at: [1500, 1120], anchor: 'tr', parts: [['Inclusion', 'main'], [' · 0.6 mm', 'warn']], sev: 'warn', sub: '0.81 · review' });
    o.leader({ from: [s.x + s.w - 40, s.y], to: [1527, 952], sev: 'warn', elbow: 'v' });
    const d = o.chip({ at: [1180, 690], parts: [['Cap', 'main'], [' · ok · 0.99', 'ok']], sev: 'ok' });
    o.leader({ from: [d.x + 30, d.y + d.h], to: [1000, 860], sev: 'ok', elbow: [[d.x + 30, 760], [1000, 760]] });
    // shift tally: the defect classes the sorter counts (not drawn as visible defects on this frame)
    const X = 384, Y = 1012, W = 580;
    const rows = [['Short shot', '3', 'bad'], ['Flash', '5', 'warn'], ['Tamper-band bridge', '2', 'bad'], ['Black speck', '1', 'bad'], ['Colour ΔE > 1.5', '4', 'bad']];
    let p = `<g class="panel"><rect x="${X}" y="${Y}" width="${W}" height="${60 + rows.length * 38 + 12}" rx="4" fill="rgb(5 7 11 / 0.86)" stroke="#263244" stroke-width="2"/>`;
    p += `<text x="${X + 24}" y="${Y + 40}" font-size="25" font-weight="500" fill="#9ba7b5">SHIFT A · 12,480 CAPS · 15 OUT</text>`;
    rows.forEach(([n, v, sev], i) => {
      const y = Y + 82 + i * 38, c = sev === 'warn' ? '#f59e0b' : '#ef4444';
      p += `<circle cx="${X + 32}" cy="${y - 9}" r="6" fill="${c}"/><text x="${X + 52}" y="${y}" font-size="27" font-weight="500" fill="#eef3f8">${n}</text><text x="${X + W - 24}" y="${y}" font-size="27" font-weight="600" fill="${c}" text-anchor="end">${v}</text>`;
    });
    o.raw(p + '</g>', 'front');
    return o;
  },

  'inspect-capping-line': () => {
    const o = new Overlay('inspect-capping-line');
    o.hud({ at: [384, 76], text: 'CAM-03 · Capper exit · 380 bpm', live: true });
    o.box({ x: 800, y: 716, w: 596, h: 292, sev: 'info', dashed: true, fillOpacity: 0, tick: 24 });
    o.chip({ at: [1400, 1016], anchor: 'tr', parts: [['ROI', 'main'], [' · lane 2', 'dim']], sev: 'info', dot: false });
    for (const c of CAPS) ring(o, c, 25, '#22c55e', 3.5);
    o.box({ x: CAP_WARN[0] - 30, y: CAP_WARN[1] - 28, w: 60, h: 56, sev: 'warn', tick: 12, fillOpacity: 0 });
    o.box({ x: CAP_BAD[0] - 30, y: CAP_BAD[1] - 28, w: 60, h: 56, sev: 'bad', tick: 12, fillOpacity: 0 });
    const w = o.chip({ at: [1480, 600], parts: [['Cap height', 'main'], [' · +0.6 mm', 'warn']], sev: 'warn', sub: 'skew 2.1° · review' });
    o.leader({ from: w.l, to: [CAP_WARN[0] + 30, CAP_WARN[1] - 20], sev: 'warn', elbow: [[1320, w.l[1]]] });
    const b = o.chip({ at: [500, 560], parts: [['Tamper band', 'main'], [' · not engaged', 'bad']], sev: 'bad', sub: 'band gap 1.4 mm · reject' });
    o.leader({ from: [b.x + b.w - 40, b.y + b.h], to: [CAP_BAD[0] - 30, CAP_BAD[1] - 10], sev: 'bad', elbow: [[b.x + b.w - 40, 720], [1020, 720]] });
    const f = o.chip({ at: [1500, 1080], parts: [['Fill level', 'main'], [' · ok · 98 %', 'ok']], sev: 'ok' });
    o.leader({ from: f.l, to: [1310, 940], sev: 'ok', elbow: 'h' });
    o.chip({ at: [384, 1274], anchor: 'bl', parts: [['Caps seated', 'main'], [` · ${CAPS.length}/${CAPS.length + 2} in ROI`, 'ok']], sev: 'ok' });
    return o;
  },

  'guard-moulding-cell': () => {
    const o = new Overlay('guard-moulding-cell');
    o.hud({ at: [384, 76], text: 'CAM-04 · Cell 4 · 25 fps', live: true });
    o.zone({ points: [[842, 520], [2084, 520], [2084, 1010], [1640, 1060], [842, 1060]], sev: 'warn' });
    o.chip({ at: [860, 1072], parts: [['Zone', 'main'], [' · press 4 · armed while cycling', 'warn']], sev: 'warn' });
    o.box({ x: 868, y: 548, w: 1020, h: 320, sev: 'info', fillOpacity: 0.02, label: { parts: P('Press 4', 'cycling · 14 s', 'info'), pos: 'top' } });
    const l = o.chip({ at: [384, 452], parts: [['Light curtain', 'main'], [' · ok', 'ok']], sev: 'ok' });
    o.leader({ from: l.r, to: [958, 479], sev: 'ok' });
    o.chip({ at: [2016, 76], anchor: 'tr', parts: [['Persons in zone', 'main'], [' · 0', 'ok']], sev: 'ok' });
    return o;
  },
};
