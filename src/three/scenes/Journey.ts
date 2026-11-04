import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, Fog, Group, Mesh, Object3D, PlaneGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createStage } from '../core/stage';
import { createLabels, type Label, type LabelOptions, type LabelTone, type SafeArea } from '../core/labels';
import { C, M, SUN_DIR, SUN_DIST, addEnvironment, bake, cctv, crack, damp, detectionBox, forklift, hazardZone, led, overlayMat, paint, solid, thermalSpot, wrapPi } from '../core/kit';
import { INFRA_CREW, INSPECT_CREW, SENSE_CREW, type WorkerSpec } from './crew';
import { avoidCrew, createCast, type CastMember, type Crew } from './cast';
import {
  car,
  drone,
  flangeGeometry,
  floorLine,
  hmiStand,
  hydraulicPress,
  pad,
  palletRacking,
  pipeRack,
  siteRoad,
  stockpile,
  troughedConveyor,
  trussBridge,
  vapour,
  zebra,
} from './props';

/** Station centres along X (metres). */
const GX = -52, IX = -23, FX = 6, SX = 38, BX = 92;
const SLAB = 0.12;
const at = <T extends Object3D>(o: T, x: number, y: number, z: number) => (o.position.set(x, y, z), o);

/**
 * ── People ── Rocketbox avatars (see cast.ts), in station-local metres
 * (floor = slab top). Routes were checked against the footprints with at
 * least 0.3 m of body clearance: press base x 2.9–7.1, z −3.1–0.1 (console at
 * x 1.0–1.6, light-curtain posts at z 0.35); armed zone x 1.6–9.4, z −4.4–1.4
 * (w1 walks in front of the press inside it for ~3 s, on purpose); forklift
 * lane z 4.85–7.95 (w4 crosses at the zebra and gives way). w2 has no hard hat
 * (the one PPE violation); w3 stands at the press console. Order = priority
 * on the low tier (two people).
 */
export const GUARD_CREW: WorkerSpec[] = [
  { id: 'w1', helmet: true, variant: 'm2', speed: 1.2, phase: 0.1, route: [[-6.4, 3.8], [-1.6, 3.95], [2.8, 3.4], [4.9, 2.0], [4.6, 0.95], [3.0, 0.9], [1.9, 1.9], [-1.4, 2.4], [-5.4, 2.3]] },
  { id: 'w2', helmet: false, variant: 'm1', speed: 1.15, phase: 0.55, route: [[-7, -6.2], [-4, -6.2], [-1.4, -6.2], [-0.1, -5.55], [-1.4, -4.9], [-4, -4.9], [-7, -4.9], [-8.1, -5.55]] },
  { id: 'w3', helmet: true, variant: 'f1', speed: 0, route: [[1.3, 0.55]], face: Math.PI },
  { id: 'w4', helmet: true, variant: 'm1', speed: 1.3, phase: 0.3, route: [[-9.6, -2.6], [-9.6, 3], [-9.6, 8.4], [-8.8, 9.0], [-8.0, 8.4], [-8.0, 3], [-8.0, -2.6], [-8.8, -3.4]] },
];
const ZONE = { x: 5.5, z: -1.5, w: 7.8, d: 5.8 };
const inZone = (x: number, z: number) => Math.abs(x - ZONE.x) < ZONE.w / 2 && Math.abs(z - ZONE.z) < ZONE.d / 2;
const AISLE = [4.6, 8.2];

/**
 * Home-page journey: one daylight site, five stations. setProgress(k) takes a
 * key index (0 = overview, 1..5 = chapters, 6 = outro), fractional between keys.
 */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 26, ao: 1.2, far: 1200 });
  const { scene, camera, isMobile } = stage;
  type Tick = (t: number, dt: number) => void;
  let guardTick: Tick = () => {};
  let inspectTick: Tick = () => {};
  let flowTick: Tick = () => {};
  let senseTick: Tick = () => {};
  let infraTick: Tick = () => {};
  let guardLabels = () => {};
  let zoneBusy = false;
  const { sun } = addEnvironment(stage, { fog: [140, 520], shadowSize: 22 });
  // Labels show with their chapter only, so no distance fade: phones pull the camera back up to 2.8x.
  const labels = createLabels(el, camera, 600);
  const cast = createCast(stage);
  const chapterLabels: Label[][] = Array.from({ length: 7 }, () => []);
  /** Person labels: shown with their chapter, and only once the person has faded in. */
  const crewLabels: { label: Label; m: CastMember; ch: number; quiet: boolean }[] = [];
  /** Crews by chapter: hidden while their station is far from the camera. */
  const crews: [number, Crew][] = [];
  /** True while the camera is settled on a chapter (its labels show). */
  const onChapter = (ch: number) => Math.abs(current - ch) < 0.3;
  const lbl = (ch: number, text: string, target: Object3D | Vector3, offset = new Vector3(), tone: LabelTone = 'info', opts?: LabelOptions) => {
    const l = labels.add(text, target, offset, tone, opts);
    chapterLabels[ch].push(l);
    return l;
  };

  // Site road linking the stations
  // Starts well behind the overview camera, so no cut-off road end shows in the wide shots.
  const road = siteRoad(-190, BX - 16);
  road.position.z = -22; // well behind the stations, so chapter foregrounds stay clean and the road does not lead the eye
  scene.add(road);

  // =============================================================== 01 GUARD
  const guard = new Group();
  guard.position.x = GX;
  scene.add(guard);
  {
    guard.add(pad(28, 20));
    const floor = new Group();
    floor.position.y = SLAB;
    guard.add(floor);
    const racks = palletRacking(4, 2.8, 1.1);
    racks.position.set(-12.6, 0, -8.8);
    floor.add(racks);
    for (const z of AISLE) {
      const l = floorLine(15.8);
      l.position.set(-6.1, 0.004, z);
      floor.add(l);
    }
    const crossing = zebra(1.9, AISLE[1] - AISLE[0]);
    crossing.position.set(-8.8, 0, (AISLE[0] + AISLE[1]) / 2);
    floor.add(crossing);

    const press = hydraulicPress();
    press.position.set(5, 0, -1.5);
    floor.add(press);
    const zone = hazardZone(ZONE.w, ZONE.d, 'warn');
    zone.position.set(ZONE.x, 0, ZONE.z);
    floor.add(zone);
    // While someone is in the zone their own chip names it ("In press zone · 2.1 s"), so the zone's chip steps aside.
    const zoneLabel = labels.add('Press zone · armed', press, new Vector3(0, 6.9, 0), 'warn');

    // People with PPE detection boxes sized to each person (green ok, red no hard hat, amber in the zone).
    const guardCrew = cast.add(floor, GUARD_CREW, { boxes: true });
    avoidCrew(labels, guardCrew); // chips (forklift proximity included) are never drawn over a person or their box
    const walkers = guardCrew.members.map((m) => {
      const label = labels.add(m.spec.helmet ? 'PPE ok · 0.98' : 'No helmet · 0.94', m.top, new Vector3(), m.spec.helmet ? 'ok' : 'bad');
      const k = { m, label, ch: 1, quiet: false, dwell: 0, inside: false };
      crewLabels.push(k);
      return k;
    });
    crews.push([1, guardCrew]);

    const fork = forklift();
    floor.add(fork);
    const forkLabel = lbl(1, 'Forklift · 8 km/h', fork, new Vector3(0, 2.9, 0), 'warn');
    // Midpoints keep the long straights straight (a 4-point Catmull-Rom loop bows ~0.5 m into the walkway).
    const forkPath = new CatmullRomCurve3(
      [[-12, 5.4], [-6, 5.4], [0, 5.4], [1.1, 6.4], [0, 7.4], [-6, 7.4], [-12, 7.4], [-13.1, 6.4]].map(([x, z]) => new Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    const forkLen = forkPath.getLength();
    let forkU = 0.1;
    let forkV = 2.2;
    let forkHeading = 0;
    const tan = new Vector3();
    const ahead = new Vector3();
    const cam = cctv(8, 11);
    cam.position.set(-13, 0, -9.6);
    cam.rotation.y = Math.atan2(18, 8);
    floor.add(cam);

    guardLabels = () => zoneLabel.setVisible(onChapter(1) && !zoneBusy);
    guardTick = (t, dt) => {
      press.ram.position.y = 2.85 + Math.abs(Math.sin(t * 0.8)) * 0.75;
      zone.fill.material.opacity = 0.08 + Math.sin(t * 2.4) * 0.03;
      // Forklift: closed loop at 2.2 m/s, slows when someone is close ahead.
      forkPath.getPointAt(forkU, fork.position);
      forkPath.getTangentAt(forkU, tan);
      forkHeading += wrapPi(Math.atan2(tan.x, tan.z) - forkHeading) * (1 - Math.exp(-6 * dt));
      fork.rotation.y = forkHeading;
      let nearest = 99;
      let blocked = false;
      for (const k of walkers) {
        if (!k.m.present) continue; // nobody to react to until the people have faded in
        const p = k.m.walker.pos;
        const d = Math.hypot(p.x - fork.position.x, p.z - fork.position.z);
        nearest = Math.min(nearest, d);
        const dx = p.x - fork.position.x, dz = p.z - fork.position.z;
        // Someone ahead and in the forklift's path: slow down.
        if (d < 4.5 && dx * tan.x + dz * tan.z > 0 && Math.abs(dx * tan.z - dz * tan.x) < 1.6) blocked = true;
      }
      forkV = damp(forkV, blocked ? 0.5 : 2.2, 2.5, dt);
      forkU = (forkU + (dt * forkV) / forkLen) % 1;
      fork.beacon.visible = Math.sin(t * 9) > -0.2;

      // Give way at the crossing while the forklift is near (eases to a stop, idles, walks on).
      for (const k of walkers) {
        const w = k.m.walker;
        if (w.spec.speed <= 0) continue;
        w.ahead(1.4, ahead);
        const entering = (w.pos.z < AISLE[0] || w.pos.z > AISLE[1]) && ahead.z > AISLE[0] - 0.2 && ahead.z < AISLE[1] + 0.2;
        const forkNear = Math.hypot(fork.position.x - w.pos.x, fork.position.z - 6.4) < 7.5;
        k.m.wait = entering && forkNear;
      }
      guardCrew.update(dt);
      for (const k of walkers) {
        const w = k.m.walker;
        const inside = inZone(w.pos.x, w.pos.z);
        // Dwell counts simulated time only: this station is frozen while the reader is on later chapters.
        if (inside && !k.inside) k.dwell = 0;
        if (inside) k.dwell += dt;
        k.inside = inside;
        // Chips for exceptions only; green boxes already say "compliant". w3 at the console keeps the one positive example.
        k.quiet = w.spec.helmet && !inside && w.spec.id !== 'w3';
        if (!w.spec.helmet) continue;
        k.m.box?.setColor(inside ? C.amber : C.green);
        k.label.setText(inside ? `In press zone · ${k.dwell.toFixed(1)} s` : 'PPE ok · 0.98');
        k.label.setTone(inside ? 'warn' : 'ok');
      }
      zoneBusy = walkers.some((k) => k.inside && k.m.present);
      const close = nearest < 4;
      forkLabel.setText(close ? `Proximity ${nearest.toFixed(1)} m` : 'Forklift · 8 km/h');
      forkLabel.setTone(close ? 'bad' : 'warn');
    };
  }

  // =============================================================== 02 INSPECT
  const inspect = new Group();
  inspect.position.x = IX;
  scene.add(inspect);
  {
    inspect.add(pad(22, 14));
    const line = new Group();
    line.position.y = SLAB;
    inspect.add(line);
    const fixed = new Group();
    fixed.add(at(solid(new RoundedBoxGeometry(18, 0.3, 1.8, 2, 0.03), M.body2()), 0, 0.88, 0));
    fixed.add(at(solid(new BoxGeometry(18, 0.05, 1.5), M.rubber()), 0, 1.055, 0));
    for (const x of [-8.4, -4.2, 0, 4.2, 8.4]) for (const z of [-0.75, 0.75]) fixed.add(at(solid(new BoxGeometry(0.1, 0.75, 0.1), M.galv()), x, 0.375, z));
    for (const z of [-0.92, 0.92]) fixed.add(at(solid(new BoxGeometry(18, 0.1, 0.05), M.galv()), 0, 1.17, z));
    // Inspection tunnel: white panels, roof camera, stack light
    for (const z of [-1.25, 1.25]) fixed.add(at(solid(new RoundedBoxGeometry(2.8, 2.3, 0.12, 2, 0.03), M.white()), 0, 2.0, z));
    fixed.add(at(solid(new RoundedBoxGeometry(2.8, 0.18, 2.62, 2, 0.03), M.white()), 0, 3.2, 0));
    fixed.add(at(solid(new RoundedBoxGeometry(0.46, 0.38, 0.4, 2, 0.05), M.white()), 0, 3.48, 0));
    fixed.add(at(solid(new CylinderGeometry(0.04, 0.04, 0.5, 10), M.galv()), 1.2, 3.55, 1.0));
    // Reject bin and chute
    fixed.add(at(solid(new RoundedBoxGeometry(1.3, 0.8, 1.3, 2, 0.04), M.yellow()), 5.5, 0.4, -2.0));
    bake(fixed);
    line.add(fixed);
    const lightBar = new Mesh(new BoxGeometry(2.4, 0.05, 0.1), led(0xffffff, 1.4));
    lightBar.position.set(0, 3.08, 0);
    const scan = new Mesh(new PlaneGeometry(1.6, 1.8), overlayMat(C.cyan, 0.12));
    scan.rotation.y = Math.PI / 2;
    scan.position.set(0, 2.0, 0);
    const stack = new Group();
    stack.position.set(1.2, 3.8, 1.0);
    const seg = new CylinderGeometry(0.07, 0.07, 0.12, 14);
    const greenL = new Mesh(seg, led(0x16a34a, 2.2));
    const amberL = new Mesh(seg, led(0x6b4a12, 0.2));
    const redLamp = new Mesh(seg, M.redAlert());
    amberL.position.y = 0.13;
    redLamp.position.y = 0.26;
    stack.add(greenL, amberL, redLamp);
    line.add(lightBar, scan, stack);
    const pusher = solid(new RoundedBoxGeometry(0.5, 0.26, 0.8, 2, 0.04), M.galv());
    pusher.position.set(5.5, 1.22, 1.35);
    line.add(pusher);
    const hmi = hmiStand('Inspect · Line 2', [['PASS', '1 184', '#15803d'], ['REVIEW', '12', '#b45309'], ['REJECT', '9', '#c62828']]);
    hmi.position.set(3.2, 0, 2.4);
    line.add(hmi);
    const operators = cast.add(line, INSPECT_CREW);
    avoidCrew(labels, operators);
    crews.push([2, operators]);

    const flange = flangeGeometry();
    const parts = Array.from({ length: 6 }, (_, i) => {
      const m = solid(flange, M.steel());
      m.position.y = 1.26;
      line.add(m);
      const box = detectionBox(1.3, 0.56, 1.3, C.green);
      box.visible = false;
      line.add(box);
      return { m, box, x: -8.5 + i * 3, bad: i === 2, z: 0 };
    });
    const rejectAnchor = new Object3D();
    const passAnchor = new Object3D();
    line.add(rejectAnchor, passAnchor);
    // Results are shown once a part has left the tunnel (it spans x ±1.4), pinned to that part.
    const EXIT = 1.7;
    // Not chapter labels: their visibility is set here (chapter gate AND a part to point at).
    const rejectLabel = labels.add('Reject · scratch 0.91', rejectAnchor, new Vector3(0, 0.75, 0), 'bad');
    const passLabel = labels.add('Pass · ΔE 0.6', passAnchor, new Vector3(0, 0.75, 0), 'ok');
    lbl(2, 'Inspection tunnel · 28 parts/min', new Vector3(IX, 3.9, 0), new Vector3(), 'info');

    inspectTick = (t, dt) => {
      operators.update(dt);
      let rejecting = false;
      let passX = Infinity;
      for (const p of parts) {
        if (p.z === 0) p.x += dt * 1.4;
        if (p.x > 5.5 && p.bad && p.z === 0) p.z = 0.0001;
        if (p.z > 0) p.z = Math.min(1.9, p.z + dt * 3);
        if (p.x > 9 || p.z >= 1.9) {
          p.x = -9;
          p.z = 0;
          p.bad = Math.random() < 0.3;
        }
        const y = p.z > 0 ? 1.26 - p.z * 0.3 : 1.26;
        p.m.position.set(p.x, y, -p.z);
        p.m.rotation.y += dt * 0.8;
        const scanned = p.x > EXIT && p.x < 8.6 && p.z < 1.2;
        p.box.visible = scanned;
        if (scanned) {
          p.box.position.set(p.x, y + 0.02, -p.z);
          p.box.setColor(p.bad ? C.red : C.green);
        }
        if (p.bad && p.x > EXIT) {
          rejectAnchor.position.set(p.x, y + 0.3, -p.z);
          rejecting = true;
        }
        // The newest good part out of the tunnel carries the pass result.
        if (!p.bad && scanned && p.x < passX) {
          passX = p.x;
          passAnchor.position.set(p.x, y + 0.3, -p.z);
        }
      }
      pusher.position.z = 1.35 - (parts.some((p) => p.z > 0 && p.z < 1) ? 0.55 : 0);
      passLabel.setVisible(passX < Infinity && onChapter(2));
      rejectLabel.setVisible(rejecting && onChapter(2));
      redLamp.visible = rejecting;
      scan.material.opacity = 0.1 + Math.sin(t * 14) * 0.04;
    };
  }

  // =============================================================== 03 FLOW
  const flow = new Group();
  flow.position.x = FX;
  scene.add(flow);
  {
    const conveyor = troughedConveyor({ length: 24, angle: 0.2, hot: 9, ore: isMobile ? 70 : 150 });
    flow.add(conveyor);
    const pile = stockpile(5.5, 4.4);
    pile.position.set(16.2, 0, 0);
    flow.add(pile);
    const hopper = new Group();
    hopper.add(at(solid(new RoundedBoxGeometry(2.6, 1.6, 3.0, 2, 0.04), M.body2()), 0, 1.7, 0));
    for (const [x, z] of [[-1.1, -1.3], [1.1, -1.3], [-1.1, 1.3], [1.1, 1.3]]) hopper.add(at(solid(new BoxGeometry(0.16, 0.9, 0.16), M.body2()), x, 0.45, z));
    bake(hopper);
    hopper.position.set(-12.6, 0, 0);
    flow.add(hopper);
    const cam = cctv(7, 9);
    cam.position.set(2, 0, -6.5);
    flow.add(cam);
    // On the camera side of the belt edge, so the hot idler is not hidden under the belt.
    const hot = thermalSpot(2.4);
    conveyor.conv.add(hot);
    hot.position.copy(conveyor.hotLocal).add(new Vector3(0, 0.05, 1.05));
    // The leader ends on the glow; the chip hangs below the belt, so it covers neither the belt nor the glow.
    const hotLabel = lbl(3, 'Idler 10 · 86 °C', hot, new Vector3(), 'warn', { below: true });
    // Drift and load are pinned to the belt (they move with it): drift at the near belt edge, load on the ore.
    const driftAt = at(new Object3D(), -6, 0.36, 0.92);
    const loadAt = at(new Object3D(), 4, 0.4, 0);
    conveyor.belt.add(driftAt, loadAt);
    const driftLabel = lbl(3, 'Belt drift +38 mm', driftAt, new Vector3(), 'warn');
    lbl(3, 'Load 1 180 t/h', loadAt, new Vector3(), 'info');

    flowTick = (t, dt) => {
      conveyor.tick(t, dt);
      const heat = 0.5 + Math.sin(t * 2.2) * 0.5;
      hot.scale.setScalar(0.95 + heat * 0.1);
      hotLabel.setText(`Idler 10 · ${(83 + heat * 6).toFixed(0)} °C`);
      const drift = Math.sin(t * 0.6);
      conveyor.belt.position.z = conveyor.ore.position.z = drift * 0.06;
      driftLabel.setText(`Belt drift ${drift > 0 ? '+' : ''}${(drift * 42).toFixed(0)} mm`);
    };
  }

  // =============================================================== 04 SENSE
  const sense = new Group();
  sense.position.x = SX;
  scene.add(sense);
  {
    sense.add(pad(22, 14));
    const plant = pipeRack();
    plant.position.y = SLAB;
    sense.add(plant);
    const plume = vapour(isMobile ? 140 : 280, plant.leak.clone());
    plant.add(plume);
    const plumeBox = detectionBox(2.4, 3.6, 2.6, C.red);
    plumeBox.position.copy(plant.leak).add(new Vector3(0, 1.75, 1.1));
    plant.add(plumeBox);
    const hot = thermalSpot(1.1);
    hot.position.copy(plant.motor).add(new Vector3(0.2, 0.15, 0.55));
    plant.add(hot);

    lbl(4, 'Vapour · valve V-12', plumeBox, new Vector3(0, 2.0, 0), 'bad');
    const gaugeLabel = lbl(4, 'PI-204 · 6.2 bar', plant.gauge, new Vector3(0, 0.75, 0), 'info');
    const hotLabel = lbl(4, 'Motor M-3 · 92 °C', hot, new Vector3(0, 1.0, 0), 'warn');
    const techs = cast.add(plant, SENSE_CREW);
    avoidCrew(labels, techs);
    crews.push([4, techs]);

    senseTick = (t, dt) => {
      techs.update(dt);
      plume.tick(t, dt);
      const reading = 6 + Math.sin(t * 0.7) * 0.6;
      plant.gauge.set(reading);
      gaugeLabel.setText(`PI-204 · ${reading.toFixed(1)} bar`);
      const h = 0.5 + Math.sin(t * 2) * 0.5;
      hot.scale.setScalar(1.05 + h * 0.1);
      hotLabel.setText(`Motor M-3 · ${(88 + h * 6).toFixed(0)} °C`);
    };
  }

  // =============================================================== 05 INFRA
  const infra = new Group();
  infra.position.x = BX;
  scene.add(infra);
  {
    const SPAN = 36;
    const bridge = trussBridge(SPAN);
    infra.add(bridge);
    const crackTops: Object3D[] = [];
    const cracks = bridge.piers.map((p, i) => {
      const pts: [number, number][] = i === 0 ? [[-0.3, 2.6], [0.1, 1.8], [-0.2, 1.0], [0.25, 0.2], [0.0, -0.8], [0.3, -1.6]] : [[0.4, 2.2], [0.0, 1.5], [0.3, 0.9], [-0.2, 0.1]];
      const c = crack(pts);
      c.position.set(p.x, 3.33, 2.315);
      infra.add(c);
      // Chips keep off the cracks (the drone's chip rides past them); the crack's own chip is pinned to its upper end.
      const [x0, y0] = pts[0];
      const len = y0 - Math.min(...pts.map(([, y]) => y));
      const reach = Math.max(...pts.map(([x]) => Math.abs(x - x0))) + 0.2;
      const top = at(new Object3D(), p.x + x0, 3.33 + y0, 2.4);
      infra.add(top);
      labels.avoid(top, () => len, () => true, reach);
      crackTops.push(top);
      return c;
    });
    const spall = new Mesh(new PlaneGeometry(1.3, 0.55), paint(0x9a9c9c, 1));
    spall.position.set(4, 6.95, 3.605);
    infra.add(spall);
    // As in the Infra report's register (D-014); the leader ends a little way down the crack, below the deck edge.
    lbl(5, 'Crack 3.5 ± 0.2 mm · +0.4 mm vs 2025', crackTops[0], new Vector3(0.14, -0.28, 0), 'bad');
    lbl(5, 'Spalling · 0.31 m²', spall, new Vector3(0, -0.7, 0.2), 'warn');

    const cars = [0xe9eaec, 0xaeb4b9, 0x2b3a55].map((color, i) => {
      const c = car(color);
      infra.add(c);
      return { c, off: i * 0.37, dir: i === 1 ? -1 : 1, lane: i === 1 ? -1.6 : 1.6 };
    });
    const uav = drone();
    uav.scale.setScalar(1.8); // a 1 m drone is a speck at survey-shot distance; scaled so its label points at something
    infra.add(uav);
    // The pilot and a bridge engineer on the near bank (same spots as the Infra pillar scene).
    const surveyors = cast.add(bridge, INFRA_CREW);
    avoidCrew(labels, surveyors);
    crews.push([5, surveyors]);
    lbl(5, 'Drone survey · 1 240 images', uav, new Vector3(0, 0.8, 0), 'info');
    const path = new CatmullRomCurve3(
      [new Vector3(-16, 5, 9), new Vector3(-9, 3.6, 7.5), new Vector3(-2, 4.2, 8.5), new Vector3(9, 3.6, 7.5), new Vector3(16, 5, 9), new Vector3(12, 14, 6), new Vector3(0, 15.5, 7), new Vector3(-12, 14, 6)],
      true,
    );
    const look = new Vector3();
    const pierPts = bridge.piers.map((p) => new Vector3(p.x, 3.4, 2.3));
    infraTick = (t, dt) => {
      surveyors.update(dt);
      const u = (t * 0.026) % 1;
      path.getPointAt(u, uav.position);
      look.set(uav.position.x, uav.position.y, 0);
      uav.lookAt(look);
      uav.rotors.forEach((r) => (r.rotation.y += dt * 30));
      cracks.forEach((c, i) => {
        const d = uav.position.distanceTo(pierPts[i]);
        const k = Math.max(0, Math.min(1, 1.8 - d / 5));
        // Red for D-014 (it grew), green for the stable crack, as in the Infra report's register.
        if (i === 0) c.material.color.setRGB(0.23 + k * 0.6, 0.2 - k * 0.12, 0.19 - k * 0.12);
        else c.material.color.setRGB(0.23 - k * 0.18, 0.2 + k * 0.22, 0.19 - k * 0.03);
        c.material.linewidth = 1.5 + k * 1.2;
      });
      cars.forEach((c) => {
        const p = ((t * 0.035 + c.off) % 1) * 2 - 1;
        const x = c.dir * p * 44;
        const { y, pitch } = bridge.surfaceAt(x);
        c.c.position.set(x, y, c.lane);
        c.c.rotation.set(0, c.dir > 0 ? 0 : Math.PI, c.dir > 0 ? -pitch : pitch);
        c.c.visible = Math.abs(x) < bridge.reach - 1;
      });
    };
  }

  // =============================================================== camera tour
  type Shot = { t: Vector3; az: number; el: number; d: number };
  /**
   * Overview and outro, per free-area shape (checked by projecting every station's footprint into the
   * free area beside the panel at 1440 × 900 and above it at 390 × 844):
   * - overview: a low look along the line from the guard end, so the nearest bay (people, boxes,
   *   forklift) is large and the other stations recede behind it; on a phone the bridge may run off the top;
   * - outro: pulled up and back until the whole site, bridge included, fits.
   */
  const OVERVIEW = {
    wide: { t: new Vector3(-28, 0, -7), az: -1.36, el: 0.3, d: 97 },
    phone: { t: new Vector3(-28, 0, -4), az: -1.4, el: 0.3, d: 85 },
  };
  const OUTRO = {
    wide: { t: new Vector3(-4, 0, -4), az: -1.12, el: 0.6, d: 222 },
    phone: { t: new Vector3(12, 0, -4), az: -1.08, el: 0.64, d: 254 },
  };
  const shots: Shot[] = [
    OVERVIEW.wide,
    // Whole guard bay in the free area beside the panel: press, racking aisle (w2, no hard hat), lane and zebra.
    { t: new Vector3(GX - 2.5, 1.2, 1.4), az: -0.5, el: 0.36, d: 38 },
    { t: new Vector3(IX + 2.4, 1.4, 0.4), az: -0.5, el: 0.34, d: 28 },
    { t: new Vector3(FX + 2.5, 3, 0), az: -0.5, el: 0.3, d: 46 },
    { t: new Vector3(SX + 2, 2.4, 1), az: -0.6, el: 0.34, d: 39 },
    { t: new Vector3(BX, 6.5, 0), az: -0.7, el: 0.2, d: 66 },
    OUTRO.wide,
  ];
  const N = shots.length - 1;
  let fit = 1;
  let safe: SafeArea | null = null;
  let posCurve: CatmullRomCurve3;
  let tgtCurve: CatmullRomCurve3;
  const posOf = (s: Shot) => {
    const d = s.d * fit;
    return new Vector3(s.t.x + Math.sin(s.az) * Math.cos(s.el) * d, s.t.y + Math.sin(s.el) * d, s.t.z + Math.cos(s.az) * Math.cos(s.el) * d);
  };
  const buildCurves = () => {
    posCurve = new CatmullRomCurve3(shots.map(posOf), false, 'centripetal');
    tgtCurve = new CatmullRomCurve3(shots.map((s) => s.t.clone()), false, 'centripetal');
  };

  /**
   * Frame the subject inside the free area (not under the text panel or rail):
   * shift the projection centre there, widen the lens on portrait, and pull the
   * camera back so the shot keeps the composition it has at 1440 × 900.
   */
  const refit = () => {
    const w = stage.size.width, h = stage.size.height;
    const r = safe ?? { left: 0, top: 0, right: w, bottom: h };
    const fw = Math.max(80, r.right - r.left), fh = Math.max(80, r.bottom - r.top);
    const fx = Math.max(0.25, fw / w), fy = Math.max(0.25, fh / h);
    const aspFree = fw / fh;
    const phone = fw < 600;
    shots[0] = phone ? OVERVIEW.phone : OVERVIEW.wide;
    shots[N] = phone ? OUTRO.phone : OUTRO.wide;
    camera.fov = aspFree < 1.2 ? 26 + Math.min(1, (1.2 - aspFree) / 0.7) * 12 : 26;
    const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * (w / h);
    const refTv = Math.tan((26 * Math.PI) / 360), refTh = refTv * 1.6;
    fit = Math.max(0.85, Math.min(2.8, Math.max((refTh * 0.55) / (th * fx), (refTv * 0.9) / (tv * fy))));
    const offX = (r.left + r.right) / 2 / w - 0.5, offY = (r.top + r.bottom) / 2 / h - 0.5;
    if (Math.abs(offX) > 0.004 || Math.abs(offY) > 0.004) camera.setViewOffset(w, h, -offX * w, -offY * h, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    buildCurves();
    labels.setSafeArea(safe);
  };
  stage.onResize(refit);

  let target = 0;
  let current = 0;
  const pos = new Vector3();
  const lookAt = new Vector3();
  const sunOffset = SUN_DIR.clone().multiplyScalar(SUN_DIST);
  const SPANS = [22, 32, 48, 70, 100];

  stage.onFrame((t, dt) => {
    current += (target - current) * (1 - Math.exp(-dt * 4.5));
    const u = Math.max(0, Math.min(1, current / N));
    posCurve.getPoint(u, pos);
    tgtCurve.getPoint(u, lookAt);
    camera.position.set(pos.x + stage.pointer.x * 0.8 + Math.sin(t * 0.2) * 0.4, pos.y + stage.pointer.y * 0.4, pos.z);
    camera.lookAt(lookAt);

    // Fog follows the camera distance: the far yard dissolves into the section colour (no horizon band)
    // while the station in view stays clear, at every zoom level and canvas size.
    const camDist = camera.position.distanceTo(lookAt);
    if (scene.fog instanceof Fog) {
      scene.fog.near = camDist * 1.15;
      scene.fog.far = camDist * 4.2;
    }

    // Shadow frustum follows the subject, in steps so the texel size does not swim.
    const want = camDist * 0.42;
    const span = SPANS.find((s) => s >= want) ?? 100;
    const sc = sun.shadow.camera;
    if (sc.right !== span) {
      sc.left = sc.bottom = -span;
      sc.right = sc.top = span;
      sc.far = span * 2 + 80;
      sc.updateProjectionMatrix();
    }
    sun.target.position.copy(lookAt);
    sun.position.copy(lookAt).add(sunOffset);

    // Only animate and label what is near the camera.
    const near = (ch: number) => Math.abs(current - ch) < 1.2 || current < 0.5 || current > N - 0.5;
    if (near(1)) guardTick(t, dt);
    if (near(2)) inspectTick(t, dt);
    if (near(3)) flowTick(t, dt);
    if (near(4)) senseTick(t, dt);
    if (near(5)) infraTick(t, dt);
    // Skinned people are never frustum-culled: only draw the crews near the camera.
    for (const [ch, crew] of crews) crew.setVisible(near(ch));
    cast.tick(dt);
    chapterLabels.forEach((list, ch) => {
      const on = onChapter(ch);
      list.forEach((l) => l.setVisible(on));
    });
    guardLabels();
    for (const c of crewLabels) c.label.setVisible(c.m.present && !c.quiet && onChapter(c.ch));
    labels.update(stage.size.width, stage.size.height);
  });

  // Settle every station once, then compile shaders before the first visible frame.
  for (const tick of [guardTick, inspectTick, flowTick, senseTick, infraTick]) tick(0, 1 / 60);
  await stage.warm();
  // People load after the first frame (the site never waits for them) and fade in.
  void cast.load();

  return {
    setProgress(k: number) {
      target = Math.max(0, Math.min(N, k));
    },
    /** Snap without easing (deep links, reduced-motion stills, screenshots). */
    jump(k: number) {
      target = current = Math.max(0, Math.min(N, k));
    },
    setSafeArea(r: SafeArea | null) {
      safe = r;
      refit();
    },
    destroy() {
      cast.dispose();
      labels.destroy();
      stage.destroy();
    },
  };
}
