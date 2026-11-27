// Source and 16:9 crop per detection image. cx/cy: crop centre (0–1 of the source), w: crop width (0–1).
export const BASES = {
  'guard-ppe-crew': { src: 'assets/raw/photos/ppe-site-workers.jpg', cy: 0.4 },
  'inspect-surface-defect': { src: 'assets/raw/photos/cnc-parts.jpg' },
  'sense-gauge': { src: 'collateral/assets/raw/sense-gauge/pexels-462394-retouched.jpg', w: 1, cy: 0.525, grade: 'cool', desatRed: true },
  'sense-steam-leak': { src: 'assets/raw/photos/steam-valve.jpg', cy: 0.55 },
  'flow-conveyor': { src: 'assets/raw/photos/conveyor-rollers.jpg', grade: 'cool' },
  'infra-pier-crack': { src: 'assets/raw/photos/concrete-crack.jpg', cy: 0.5 },
  'guard-work-at-height': { src: 'assets/raw/photos/harness-worker.jpg', cx: 0.4, cy: 0.34, w: 0.8, flip: true },
  'guard-restricted-zone': { src: 'assets/raw/photos/robot-cell.jpg' },
  'inspect-pcb': { src: 'assets/raw/photos/pcb-inspection.jpg', retouch: [{ mode: 'epoxy', poly: [[1050,671],[1146,570],[1266,646],[1170,744]], dimple: [1238, 648, 9], keepOut: [[[896,520],[946,500],[1114,728],[1098,744]], [[1158,496],[1196,496],[1238,600],[1222,606]]] }] },
  'inspect-colour': { src: 'assets/raw/photos/tiles-production.jpg', grade: 'cool' },
  'inspect-pack-label': { src: 'assets/raw/photos/pharma-packs.jpg' },
  'sense-thermal-panel': { src: 'assets/raw/photos/electrical-panel.jpg', retouch: [{ mode: 'fill', poly: [[1000,560],[1028,560],[1028,576],[1000,576]] }, { mode: 'fill', poly: [[1068,557],[1096,557],[1096,574],[1068,574]] }, { mode: 'fill', poly: [[1099,556],[1127,556],[1127,577],[1099,577]] }, { mode: 'fill', poly: [[1350,536],[1378,536],[1378,550],[1350,550]] }, { mode: 'fill', poly: [[1214,1021],[1248,1021],[1248,1039],[1214,1039]] }, { mode: 'fill', poly: [[1293,1043],[1317,1043],[1317,1068],[1293,1068]] }] },
};
Object.assign(BASES, {
  'cover-site': { src: 'collateral/assets/raw/cover-site/pexels-36696522.jpg', w: 0.9, cx: 0.515, cy: 0.597, retouch: [{ mode: 'fill', poly: [[1127,686],[1145,686],[1145,768],[1127,768]], lumaMax: 70, sigma: 10 }, { mode: 'fill', poly: [[1697,769],[1743,769],[1743,788],[1697,788]], lumaMax: 95, sigma: 10 }, { mode: 'fill', poly: [[736,576],[766,576],[766,674],[736,674]] }, { mode: 'fill', poly: [[1500,585],[1516,585],[1516,635],[1500,635]], lumaMax: 70, sigma: 10 }] },
  'guard-forklift-proximity': { src: 'collateral/assets/raw/guard-forklift-proximity/pexels-29988955.jpg' },
  'flow-conveyor': { src: 'collateral/assets/raw/flow-conveyor/pexels-17320030.jpg', cy: 0.45 },
  'infra-road-defects': { src: 'collateral/assets/raw/infra-road-defects/pexels-20518249.jpg', cy: 0.62 },
});
Object.assign(BASES, {
  'sense-walkway-spill': { src: 'assets/raw/photos/floor-markings.jpg', cy: 0.66, retouch: [{ mode: 'fill', poly: [[318,274],[362,274],[362,430],[318,430]], lumaMax: 120, lumaMin: 22, sigma: 14 }, { mode: 'fill', poly: [[748,572],[808,572],[808,630],[748,630]] }, { mode: 'fill', poly: [[2351,834],[2385,834],[2385,920],[2351,920]], lumaMax: 70, sigma: 10 }, { mode: 'fill', poly: [[1790,584],[1816,584],[1816,680],[1790,680]], lumaMax: 70, sigma: 10 }, { mode: 'fill', poly: [[104,902],[152,902],[152,932],[104,932]] }, { mode: 'fill', poly: [[794,342],[816,342],[816,416],[794,416]], lumaMax: 75, sigma: 9 }, { mode: 'fill', poly: [[879,352],[901,352],[901,416],[879,416]], lumaMax: 75, sigma: 9 }, { mode: 'fill', poly: [[1199,362],[1221,362],[1221,426],[1199,426]], lumaMax: 75, sigma: 9 }, { mode: 'fill', poly: [[2049,632],[2071,632],[2071,706],[2049,706]], lumaMax: 75, sigma: 9 }] },
  'infra-tower': { src: 'assets/raw/photos/transmission-tower.jpg', w: 0.72, cx: 0.64, cy: 0.5 },
});
Object.assign(BASES, {
  'inspect-closures': { src: 'collateral/assets/raw/inspect-closures/pexels-3735204.jpg', w: 1, cy: 0.47 },
  'inspect-capping-line': { src: 'assets/raw/photos/bottling-line.jpg', w: 0.72, cx: 0.5, cy: 0.62 },
  'guard-moulding-cell': { src: 'assets/raw/photos/robot-cell.jpg', w: 0.62, cx: 0.69, cy: 0.55 },
});
