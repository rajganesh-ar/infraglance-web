// Detection layouts, part 5: walkway spill, tower insulators, robot zone, blister packs.
import { Overlay } from './det-lib.mjs';
const P = (label, value, sev) => [[label, 'main'], [' · ' + value, sev ? sev : 'dim']];
const ring = (o, [x, y], r, c) => o.raw(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgb(5 7 11 / 0.45)" stroke-width="7"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="3"/>`);

export const SPECS_E = {
  'sense-walkway-spill': () => {
    const o = new Overlay('sense-walkway-spill');
    o.hud({ at: [316, 76], text: 'CAM-09 · Charging bay · housekeeping' });
    o.zone({ points: [[1172, 560], [1214, 560], [1262, 700], [1394, 1286], [974, 1286], [1136, 700]], sev: 'info', fillOpacity: 0.08 });
    o.chip({ at: [1250, 560], anchor: 'bl', parts: [['Walkway W2', 'main'], [' · keep clear', 'dim']], sev: 'info' });
    // oil drips on the walkway (real marks on the floor)
    o.zone({ points: [[984, 1206], [1030, 1194], [1084, 1210], [1096, 1250], [1070, 1282], [1000, 1284], [978, 1250]], sev: 'bad', dash: '10 7', fillOpacity: 0.18 });
    const s = o.chip({ at: [1430, 1186], parts: [['Spill', 'main'], [' · walkway W2', 'bad']], sev: 'bad', sub: 'oil · 0.94 · clean-up task sent' });
    o.leader({ from: s.l, to: [1092, 1236], sev: 'bad' });
    o.box({ x: 1070, y: 812, w: 92, h: 90, sev: 'warn', tick: 14 });
    o.chip({ at: [1172, 812], parts: P('Drips', '0.71', 'warn'), sev: 'warn' });
    o.chip({ at: [316, 1274], anchor: 'bl', parts: [['5S score', 'main'], [' · 87', 'ok']], sev: 'ok' });
    return o;
  },

  'infra-tower': () => {
    const o = new Overlay('infra-tower');
    o.hud({ at: [316, 76], text: 'Survey · Tower T-118 · zoom 4×' });
    for (const b of [[620, 160, 90, 210], [524, 440, 140, 200], [736, 440, 100, 200], [610, 730, 166, 260], [1640, 380, 120, 180], [1450, 140, 100, 180]]) o.box({ x: b[0], y: b[1], w: b[2], h: b[3], sev: 'ok', fillOpacity: 0.03, tick: 16 });
    o.box({ x: 1570, y: 590, w: 130, h: 200, sev: 'warn', tick: 16 });
    o.chip({ at: [1580, 800], anchor: 'tl', parts: [['INS-B2', 'main'], [' · corrosion', 'warn']], sev: 'warn', sub: 'cap 4 · 0.71' });
    o.box({ x: 1360, y: 980, w: 180, h: 190, sev: 'bad', tick: 18 });
    o.chip({ at: [1552, 1176], parts: [['INS-C3', 'main'], [' · broken disc', 'bad']], sev: 'bad', sub: 'disc 9 of 14 · 0.87' });
    o.chip({ at: [2084, 76], anchor: 'tr', parts: [['Strings', 'main'], [' · 6/8 ok', 'ok']], sev: 'ok' });
    return o;
  },

  'guard-restricted-zone': () => {
    const o = new Overlay('guard-restricted-zone');
    o.hud({ at: [2016, 76], anchor: 'tr', text: 'CAM-07 · Cell R-07 · 25 fps', live: true });
    o.zone({ points: [[330, 1282], [330, 560], [520, 150], [1330, 150], [1380, 520], [1380, 1282]], sev: 'warn' });
    o.chip({ at: [1392, 1282], anchor: 'bl', parts: [['Zone R-07', 'main'], [' · armed', 'warn']], sev: 'warn', sub: 'robot reach + 1.0 m' });
    o.box({ x: 400, y: 72, w: 900, h: 1176, sev: 'info', fillOpacity: 0.02, label: { parts: [['Robot R-07', 'main'], [' · running', 'info']], pos: 'in-bottom' } });
    o.box({ x: 1400, y: 500, w: 690, h: 540, sev: 'info', fillOpacity: 0.02, label: { parts: P('Press P-07', 'cycle 14 s', 'info'), pos: 'top-r' } });
    o.chip({ at: [2016, 142], anchor: 'tr', parts: [['Persons in zone', 'main'], [' · 0', 'ok']], sev: 'ok' });
    return o;
  },

  'inspect-pack-label': () => {
    const o = new Overlay('inspect-pack-label');
    o.hud({ at: [2016, 76], anchor: 'tr', text: 'CAM-12 · Pack line 3 · 120 packs/min' });
    const A = [[450, 120], [560, 340], [650, 540], [760, 760], [850, 970], [410, 650], [530, 870], [630, 1090]];
    const B = [[1670, 660], [1510, 830], [1830, 830], [1660, 1000], [1980, 1000], [1820, 1170]];
    for (const p of A) ring(o, p, 56, '#22c55e');
    for (const p of B) ring(o, p, 56, '#22c55e');
    o.chip({ at: [880, 1150], parts: [['Strip A', 'main'], [' · 8/8 in view · match', 'ok']], sev: 'ok' });
    o.chip({ at: [1500, 1270], anchor: 'bl', parts: [['Strip B', 'main'], [' · 6/6 in view · match', 'ok']], sev: 'ok' });
    o.box({ x: 1222, y: 232, w: 180, h: 176, sev: 'bad', tick: 22 });
    o.chip({ at: [1414, 232], parts: [['Pocket C-7', 'main'], [' · crushed', 'bad']], sev: 'bad', sub: 'tray C · 0.91 · reject' });
    return o;
  },
};
