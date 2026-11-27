// Detection layouts, part 4: cover, forklift proximity, conveyor, road.
import { Overlay } from './det-lib.mjs';
const P = (label, value, sev) => [[label, 'main'], [' · ' + value, sev ? sev : 'dim']];

export const SPECS_D = {
  'cover-site': () => {
    const o = new Overlay('cover-site');
    o.hud({ at: [316, 76], text: 'CAM-02 · Hall B · 6 tracks', live: true });
    // forklift lane: dashed zone on the floor between the racking and the roll stock
    o.zone({ points: [[640, 1000], [1000, 905], [1560, 880], [1960, 880], [1960, 930], [1500, 1010], [1180, 1130], [720, 1140]], sev: 'warn' });
    o.chip({ at: [660, 1150], parts: [['Zone', 'main'], [' · forklift lane', 'warn']], sev: 'warn' });
    o.box({ x: 806, y: 606, w: 656, h: 494, sev: 'info', fillOpacity: 0.03, label: { parts: [['Forklift', 'main'], [' · parked', 'dim']], pos: 'top' } });
    o.box({ x: 1470, y: 532, w: 412, h: 350, sev: 'info', fillOpacity: 0.03, label: { parts: P('Forklift', '4 km/h', 'info'), pos: 'top-r' } });
    // the one exception: pedestrian (seen from behind) inside the vehicle zone
    o.box({ x: 1488, y: 636, w: 96, h: 268, sev: 'bad', tick: 18 });
    o.chip({ at: [1486, 912], parts: [['Pedestrian in lane', 'main'], [' · 1.2 m', 'bad']], sev: 'bad' });
    return o;
  },

  'guard-forklift-proximity': () => {
    const o = new Overlay('guard-forklift-proximity');
    o.hud({ at: [316, 76], text: 'CAM-04 · Bay 3 · 25 fps', live: true });
    o.ring({ cx: 1170, cy: 1190, rx: 560, ry: 92, sev: 'info', fillOpacity: 0.05 });
    o.box({ x: 516, y: 236, w: 576, h: 1050, sev: 'info', fillOpacity: 0.02, label: { parts: [['Person', 'main'], [' · track 14', 'dim']], pos: 'in-bottom' } });
    o.box({ x: 690, y: 232, w: 242, h: 154, sev: 'ok', tick: 22 });
    o.chip({ at: [934, 224], anchor: 'br', parts: P('Helmet', '0.98'), sev: 'ok', sub: 'ear defenders ok' });
    o.box({ x: 934, y: 418, w: 470, h: 792, sev: 'info', fillOpacity: 0.03, label: { parts: [['Forklift', 'main'], [' · parked', 'dim']], pos: 'top-r' } });
    o.dim({ a: [880, 1268], b: [1372, 1214], sev: 'info' });
    o.chip({ at: [1420, 1150], parts: [['Distance', 'main'], [' · 2.4 m', 'info']], sev: 'info', sub: 'person to forklift · limit 3.0 m' });
    return o;
  },

  'flow-conveyor': () => {
    const o = new Overlay('flow-conveyor');
    o.hud({ at: [316, 76], text: 'CV-3 · head pulley · 25 fps' });
    // belt edge: actual (amber) vs nominal (dashed cyan) at the pulley end
    o.trace({ points: [[858, 548], [848, 650], [838, 762]], sev: 'warn', width: 4 });
    o.trace({ points: [[906, 540], [896, 650], [886, 762]], sev: 'info', width: 3, dash: '12 9', halo: true });
    o.dim({ a: [848, 650], b: [896, 650], sev: '#ffffff', bar: 12 });
    const d = o.chip({ at: [800, 470], anchor: 'tr', parts: [['Belt drift', 'main'], [' · +41 mm', 'warn']], sev: 'warn', sub: 'tracking alarm at +50 mm' });
    o.leader({ from: [d.x + d.w - 40, d.y + d.h], to: [852, 600], sev: 'warn', elbow: 'v' });
    const l = o.chip({ at: [1060, 420], anchor: 'bl', parts: [['Load', 'main'], [' · 412 t/h', 'info']], sev: 'info' });
    o.leader({ from: [1100, 420], to: [1200, 520], sev: 'info', elbow: 'v' });
    o.box({ x: 1122, y: 702, w: 56, h: 52, sev: 'bad', tick: 12 });
    const f = o.chip({ at: [1000, 900], anchor: 'tr', parts: P('Foreign object', '0.86', 'bad'), sev: 'bad' });
    o.leader({ from: f.r, to: [1128, 752], sev: 'bad' });
    o.heat({ cx: 1962, cy: 742, rx: 110, ry: 150, stops: [[0, '#fde68a', 0.75], [0.35, '#f59e0b', 0.5], [1, '#ef4444', 0]] });
    o.box({ x: 1880, y: 600, w: 166, h: 282, sev: 'warn', tick: 22, label: { parts: P('Bearing', '71 °C', 'warn'), pos: 'top-r' } });
    return o;
  },

  'infra-road-defects': () => {
    const o = new Overlay('infra-road-defects');
    o.hud({ at: [316, 76], text: 'Survey van · CAM-F · 38 km/h · km 4.215' });
    o.box({ x: 1036, y: 560, w: 458, h: 154, sev: 'bad' });
    o.chip({ at: [1276, 552], anchor: 'br', parts: P('Pothole', '2.8 × 1.2 m', 'bad'), sev: 'bad' });
    o.box({ x: 1494, y: 650, w: 312, h: 72, sev: 'bad', tick: 16, label: { parts: P('Pothole', '1.9 × 0.6 m', 'bad'), pos: 'bottom-r' } });
    o.trace({ points: [[1346, 424], [1330, 466], [1312, 506], [1296, 540], [1284, 566]], sev: 'warn', width: 4 });
    const c1 = o.chip({ at: [1380, 380], parts: [['Crack', 'main'], [' · longitudinal', 'warn']], sev: 'warn' });
    o.leader({ from: c1.l, to: [1340, 440], sev: 'warn', elbow: 'h' });
    o.trace({ points: [[904, 856], [1040, 860], [1180, 868], [1320, 878], [1460, 890]], sev: 'warn', width: 4 });
    o.trace({ points: [[1190, 902], [1400, 908], [1600, 915], [1760, 922], [1890, 928]], sev: 'warn', width: 4 });
    const c2 = o.chip({ at: [920, 980], parts: [['Crack', 'main'], [' · transverse · 3.1 m', 'warn']], sev: 'warn' });
    o.leader({ from: [c2.x + 60, c2.y], to: [1060, 861], sev: 'warn', elbow: 'v' });
    o.chip({ at: [316, 1274], anchor: 'bl', parts: [['Segment 4.2', 'main'], [' · PCI 41 · repair', 'bad']], sev: 'bad' });
    return o;
  },
};
