/**
 * Shared station props (not a scene): the press, racking, conveyor, pipe rack,
 * bridge, drone, cars, robot cell and vapour used by Journey and the pillar
 * scenes, so every 3D view is built from the same parts and reads as one
 * product. Metres; origin at floor level unless noted.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  ExtrudeGeometry,
  DoubleSide,
  Fog,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Stage } from '../core/stage';
import { M, bake, concreteMat, damp, beam, blobShadow, led, overlayMat, paint, slab, softDot, solid } from '../core/kit';

let rackBlueMat: MeshStandardMaterial | null = null;
let wrapMat: MeshStandardMaterial | null = null;
let darkGlassMat: MeshStandardMaterial | null = null;
const rackBlue = () => (rackBlueMat ??= paint(0x2e5a87, 0.5));
const stretchWrap = () => (wrapMat ??= paint(0xe4e8ea, 0.3));
const darkGlass = () => (darkGlassMat ??= new MeshStandardMaterial({ color: 0x27323c, roughness: 0.08, metalness: 0 }));

const rbox = (w: number, h: number, d: number, mat: Material, r = 0.03) => solid(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.3)), mat);
const at = <T extends Object3D>(o: T, x: number, y: number, z: number) => (o.position.set(x, y, z), o);

// ============================================================== press
/** Four-column hydraulic press (4.2 × 3.2 m, 6.5 m tall) with a light curtain and an operator console at (−3.7, 1.2), facing +Z. */
export function hydraulicPress() {
  const g = new Group();
  const fixed = new Group();
  fixed.add(at(rbox(4.2, 1.1, 3.2, M.body2()), 0, 0.55, 0));
  fixed.add(at(rbox(4.2, 1.2, 3.2, M.body2()), 0, 5.1, 0));
  fixed.add(at(solid(new CylinderGeometry(0.55, 0.55, 0.8, 24), M.body2()), 0, 6.1, 0));
  fixed.add(at(rbox(3.2, 0.25, 2.4, M.steel(), 0.02), 0, 1.225, 0));
  const col = new CylinderGeometry(0.2, 0.2, 3.4, 20);
  for (const [x, z] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) fixed.add(at(solid(col, M.steel()), x, 2.8, z));
  // Hydraulic power pack and a yellow guard rail on the crown
  fixed.add(at(rbox(1.3, 1.1, 0.9, M.body()), 2.95, 0.55, -1.0));
  for (const x of [-2.05, 2.05]) fixed.add(at(solid(new BoxGeometry(0.05, 0.05, 3.2), M.yellow()), x, 5.95, 0));
  // Light curtain (emitter / receiver posts) at the front opening
  for (const x of [-2.25, 2.25]) {
    fixed.add(at(solid(new BoxGeometry(0.07, 1.9, 0.07), M.yellow()), x, 1.05, 1.85));
    fixed.add(at(solid(new BoxGeometry(0.03, 1.7, 0.02), M.dark()), x + (x < 0 ? 0.035 : -0.035), 1.1, 1.85));
    fixed.add(at(solid(new BoxGeometry(0.24, 0.02, 0.24), M.dark()), x, 0.01, 1.85));
  }
  // Operator console on a pedestal, left of the opening
  fixed.add(at(solid(new BoxGeometry(0.12, 1.05, 0.12), M.body2()), -3.7, 0.52, 1.2));
  fixed.add(at(rbox(0.56, 0.36, 0.26, M.body()), -3.7, 1.2, 1.2));
  bake(fixed);
  g.add(fixed);
  const estop = at(solid(new CylinderGeometry(0.045, 0.045, 0.04, 14), M.red()), -3.82, 1.25, 1.35);
  estop.rotation.x = Math.PI / 2;
  const go = at(new Mesh(new CylinderGeometry(0.03, 0.03, 0.03, 12), M.greenLed()), -3.6, 1.25, 1.34);
  go.rotation.x = Math.PI / 2;
  g.add(estop, go);
  const ram = at(rbox(3.0, 0.8, 2.2, M.steel(), 0.03), 0, 3.6, 0);
  g.add(ram);
  return Object.assign(g, { ram });
}

// ============================================================== racking
/** Selective pallet racking: blue uprights, orange beams, wrapped and boxed loads. Baked. Spans x 0..bays*bay, z 0..depth. */
export function palletRacking(bays = 4, bay = 2.8, depth = 1.1, levels = [0.15, 1.85, 3.55], height = 5.4) {
  const g = new Group();
  const up = new BoxGeometry(0.09, height, 0.07);
  for (let b = 0; b <= bays; b++) for (const z of [0, depth]) g.add(at(solid(up, rackBlue()), b * bay, height / 2, z));
  // Diagonal bracing on each frame
  for (let b = 0; b <= bays; b++) for (let y = 0.3; y < height - 1; y += 1.2) g.add(beam(new Vector3(b * bay, y, 0), new Vector3(b * bay, y + 1.1, depth), 0.035, rackBlue()));
  const bm = new BoxGeometry(bay - 0.09, 0.12, 0.05);
  const pal = new BoxGeometry(1.2, 0.144, 1.0);
  for (let b = 0; b < bays; b++) {
    for (const y of levels.slice(1)) for (const z of [0, depth]) g.add(at(solid(bm, M.orange()), b * bay + bay / 2, y, z));
    for (const [li, y] of levels.entries()) {
      for (const k of [0, 1]) {
        if ((b * 3 + li * 2 + k) % 5 === 4) continue; // a few empty slots
        const x = b * bay + 0.75 + k * 1.3;
        const top = y + (li === 0 ? 0 : 0.06);
        g.add(at(solid(pal, M.pallet()), x, top + 0.072, depth / 2));
        const h = 0.8 + ((b + li + k) % 3) * 0.22;
        const wrapped = (b + k + li) % 2 === 0;
        g.add(at(rbox(1.12, h, 0.96, wrapped ? stretchWrap() : M.card(), 0.04), x, top + 0.144 + h / 2, depth / 2));
      }
    }
  }
  return bake(g);
}

// ============================================================== conveyor
export interface ConveyorOptions {
  length?: number;
  angle?: number;
  /** Index of the idler set that runs hot (thermal story); -1 for none. */
  hot?: number;
  ore?: number;
  /** Belt width scale (1 ≈ 1.2 m belt). */
  width?: number;
}

/**
 * Troughed bulk conveyor on trestles: stringers, idler sets (centre + wings),
 * belt, head pulley house, drive, walkway handrail, and an instanced ore stream.
 * The returned `conv` group is the inclined frame (local +X runs up the belt).
 */
export function troughedConveyor(o: ConveyorOptions = {}) {
  const L = o.length ?? 24;
  const ANG = o.angle ?? 0.2;
  const hotIdx = o.hot ?? 9;
  const g = new Group();
  const conv = new Group();
  conv.rotation.z = ANG;
  conv.position.set(0, 3.0, 0);
  g.add(conv);
  const struct = new Group();
  for (const z of [-1.1, 1.1]) struct.add(at(solid(new BoxGeometry(L, 0.28, 0.12), M.body2()), 0, -0.35, z));
  // Walkway grating and handrail on the +Z side
  struct.add(at(solid(new BoxGeometry(L, 0.04, 0.8), M.galv()), 0, -0.48, 1.6));
  for (let x = -L / 2; x <= L / 2 + 0.01; x += 2) struct.add(at(solid(new BoxGeometry(0.05, 1.05, 0.05), M.yellow()), x, 0.05, 1.98));
  struct.add(at(solid(new BoxGeometry(L, 0.05, 0.05), M.yellow()), 0, 0.55, 1.98));
  struct.add(at(solid(new BoxGeometry(L, 0.04, 0.04), M.yellow()), 0, 0.08, 1.98));
  const roll = new CylinderGeometry(0.13, 0.13, 0.62, 14);
  roll.rotateX(Math.PI / 2);
  const hotRolls: Mesh[] = [];
  const n = Math.floor((L - 1.6) / 1.6) + 1;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + 0.8 + i * 1.6;
    struct.add(at(solid(new BoxGeometry(0.08, 0.1, 2.2), M.body2()), x, -0.22, 0));
    const c = at(solid(roll, M.galv()), x, -0.1, 0);
    const w1 = at(solid(roll, M.galv()), x, 0.05, -0.62);
    w1.rotation.x = 0.5;
    const w2 = at(solid(roll, M.galv()), x, 0.05, 0.62);
    w2.rotation.x = -0.5;
    if (i === hotIdx) hotRolls.push(c, w1, w2);
    else struct.add(c, w1, w2);
  }
  conv.add(bake(struct));
  hotRolls.forEach((m) => conv.add(m));
  // Troughed belt
  const beltMid = at(solid(new BoxGeometry(L, 0.03, 0.66), M.rubber()), 0, 0.045, 0);
  const beltL = at(solid(new BoxGeometry(L, 0.03, 0.6), M.rubber()), 0, 0.19, -0.6);
  beltL.rotation.x = 0.5;
  const beltR = at(solid(new BoxGeometry(L, 0.03, 0.6), M.rubber()), 0, 0.19, 0.6);
  beltR.rotation.x = -0.5;
  const belt = new Group();
  belt.add(beltMid, beltL, beltR);
  conv.add(belt);
  // Head pulley house and drive
  const head = new Group();
  head.add(at(rbox(1.8, 2.0, 2.8, M.body()), L / 2 + 0.6, 0.3, 0));
  head.add(at(rbox(0.9, 0.7, 0.8, M.body2()), L / 2 + 0.6, -0.3, 1.9));
  const motor = at(solid(new CylinderGeometry(0.34, 0.34, 0.9, 20), M.body()), L / 2 + 0.6, -0.3, 2.75);
  motor.rotation.x = Math.PI / 2;
  head.add(motor);
  head.add(at(solid(new BoxGeometry(0.9, 0.06, 2.2), M.yellow()), L / 2 + 0.6, -0.68, 2.2));
  conv.add(bake(head));
  // Trestles from the stringers down to the ground (world-aligned)
  const trestles = new Group();
  const cos = Math.cos(ANG), sin = Math.sin(ANG);
  for (let i = 0; i < 4; i++) {
    const lx = -L / 2 + 3 + i * 6;
    const wx = lx * cos + 0.45 * sin;
    const wy = 3.0 + lx * sin - 0.45 * cos;
    for (const z of [-1.1, 1.1]) {
      trestles.add(beam(new Vector3(wx, wy, z), new Vector3(wx, 0, z), 0.16, M.body2()));
      trestles.add(at(solid(new BoxGeometry(0.4, 0.04, 0.4), M.galv()), wx, 0.02, z));
    }
    trestles.add(beam(new Vector3(wx, wy * 0.5, -1.1), new Vector3(wx, wy * 0.5, 1.1), 0.09, M.body2()));
    trestles.add(beam(new Vector3(wx, wy * 0.5, -1.1), new Vector3(wx, wy, 1.1), 0.07, M.body2()));
  }
  g.add(bake(trestles));

  // Ore stream (instanced)
  const N = o.ore ?? 150;
  const ore = new InstancedMesh(new DodecahedronGeometry(0.17, 0), M.aggregate(), N);
  ore.castShadow = true;
  ore.receiveShadow = true;
  conv.add(ore);
  const oreT = Array.from({ length: N }, (_, i) => i / N);
  const oreZ = Array.from({ length: N }, () => (Math.random() - 0.5) * 0.85);
  const oreS = Array.from({ length: N }, () => 0.7 + Math.random() * 0.8);
  const dummy = new Object3D();
  const hotLocal = new Vector3(-L / 2 + 0.8 + hotIdx * 1.6, -0.1, 0);
  const tick = (_t: number, dt: number) => {
    for (let k = 0; k < N; k++) {
      oreT[k] = (oreT[k] + dt * 0.05) % 1;
      const z = oreZ[k];
      dummy.position.set(-L / 2 + oreT[k] * L, 0.14 + Math.abs(z) * 0.32, z);
      dummy.rotation.set(k, k * 1.7, k * 0.3);
      dummy.scale.setScalar(oreS[k]);
      dummy.updateMatrix();
      ore.setMatrixAt(k, dummy.matrix);
    }
    ore.instanceMatrix.needsUpdate = true;
  };
  tick(0, 0);
  return Object.assign(g, { conv, belt, ore, hotLocal, length: L, angle: ANG, tick });
}

/** Stockpile of aggregate (flat-shaded cone with a slightly irregular base). */
export function stockpile(r = 5.5, h = 4.4) {
  const geo = new ConeGeometry(r, h, 28, 3);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < h / 2 - 0.01) {
      // Angle-based jitter so the duplicated seam vertices move together.
      const k = 1 + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 5 + y * 1.3) * 0.045;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
  }
  geo.computeVertexNormals();
  const m = solid(geo, M.aggregate());
  m.position.y = h / 2;
  return m;
}

// ============================================================== pipe rack, tank, pump, valve, gauge
/** Analogue pressure gauge face (0–10 bar, red band above 8). */
function gaugeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbfbf8';
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  g.lineWidth = 14;
  g.strokeStyle = '#d33a2c';
  g.beginPath();
  g.arc(128, 128, 96, a0 + (a1 - a0) * 0.8, a1);
  g.stroke();
  g.strokeStyle = '#1b2026';
  for (let i = 0; i <= 50; i++) {
    const a = a0 + ((a1 - a0) * i) / 50;
    const major = i % 5 === 0;
    g.lineWidth = major ? 4 : 2;
    const r0 = major ? 84 : 92;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
    g.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104);
    g.stroke();
    if (major) {
      g.fillStyle = '#1b2026';
      g.font = '600 20px "IBM Plex Mono", ui-monospace, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i / 5), 128 + Math.cos(a) * 66, 128 + Math.sin(a) * 66);
    }
  }
  g.font = '600 22px "IBM Plex Mono", ui-monospace, monospace';
  g.fillText('bar', 128, 170);
  g.font = '500 15px "IBM Plex Mono", ui-monospace, monospace';
  g.fillStyle = '#5b6570';
  g.fillText('PI-204', 128, 196);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Gauge on a short stand-off: `hand` is the needle's rotation group (z; 0 bar = +2.36 rad, 10 bar = −2.36 rad). */
export function pressureGauge(r = 0.4) {
  const g = new Group();
  const body = solid(new CylinderGeometry(r * 1.12, r * 1.12, r * 0.4, 32), M.steel());
  body.rotation.x = Math.PI / 2;
  const face = new Mesh(new CircleGeometry(r, 48), new MeshStandardMaterial({ map: gaugeTexture(), roughness: 0.35 }));
  face.position.z = r * 0.205;
  // Not named `pivot`: Object3D.pivot is a transform property in three r18x.
  const hand = new Group();
  hand.position.z = r * 0.23;
  const needle = new Mesh(new BoxGeometry(r * 0.05, r * 0.8, r * 0.02), M.red());
  needle.position.y = r * 0.32;
  hand.add(needle, new Mesh(new CylinderGeometry(r * 0.07, r * 0.07, r * 0.04, 12).rotateX(Math.PI / 2), M.dark()));
  g.add(body, face, hand);
  /** Sets the needle to a reading in bar (0–10). */
  const set = (bar: number) => void (hand.rotation.z = Math.PI * 0.75 - (Math.max(0, Math.min(10, bar)) / 10) * Math.PI * 1.5);
  set(6);
  return Object.assign(g, { hand, set });
}

/**
 * Pipe rack (22 m) with five painted lines and flanges, a vertical tank, a pump
 * skid and a gate valve with a red handwheel. Anchors are local positions.
 */
export function pipeRack() {
  const g = new Group();
  const rack = new Group();
  for (const x of [-9, -3, 3, 9]) {
    for (const z of [-2, 2]) rack.add(at(solid(new BoxGeometry(0.3, 6.1, 0.3), M.body2()), x, 3.05, z));
    for (const y of [3.75, 5.95]) rack.add(at(solid(new BoxGeometry(0.3, 0.3, 4.3), M.body2()), x, y, 0));
    for (const z of [-2, 2]) rack.add(at(solid(new BoxGeometry(0.6, 0.04, 0.6), M.galv()), x, 0.02, z));
  }
  for (const z of [-2, 2]) for (const y of [3.75, 5.95]) rack.add(at(solid(new BoxGeometry(18.3, 0.22, 0.22), M.body2()), 0, y, z));
  const pipes: [number, number, number, Material][] = [
    [4.28, -1.3, 0.36, M.galv()],
    [4.22, -0.2, 0.3, M.white()],
    [4.16, 0.8, 0.24, M.yellow()],
    [6.38, -0.8, 0.3, M.galv()],
    [6.5, 0.6, 0.42, M.white()],
  ];
  for (const [y, z, r, mat] of pipes) {
    rack.add(at(solid(new CylinderGeometry(r, r, 22, 24).rotateZ(Math.PI / 2), mat), 0, y, z));
    for (const x of [-7, 0, 7]) rack.add(at(solid(new CylinderGeometry(r * 1.32, r * 1.32, 0.1, 24).rotateZ(Math.PI / 2), M.steel()), x, y, z));
  }
  // Drop to the valve
  rack.add(at(solid(new CylinderGeometry(0.24, 0.24, 2.3, 18), M.galv()), 3, 2.75, -1.3));
  rack.add(at(solid(new TorusGeometry(0.36, 0.24, 12, 18, Math.PI / 2).rotateZ(Math.PI / 2), M.galv()), 3.36, 3.9, -1.3));
  // Vertical tank with ladder rails and stiffening rings
  rack.add(at(solid(new CylinderGeometry(2.2, 2.2, 5, 40), M.white()), -7, 2.5, -5.2));
  rack.add(at(solid(new SphereGeometry(2.2, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white()), -7, 5, -5.2));
  for (let i = 0; i < 4; i++) rack.add(at(solid(new TorusGeometry(2.215, 0.035, 6, 56).rotateX(Math.PI / 2), M.galv()), -7, 0.8 + i * 1.2, -5.2));
  for (const dx of [-0.22, 0.22]) rack.add(at(solid(new BoxGeometry(0.04, 6.4, 0.04), M.yellow()), -7 + dx, 3.2, -2.9));
  // Pump skid: base frame, pump casing, coupling guard, motor
  rack.add(at(rbox(3.6, 0.25, 1.4, M.body2()), 6, 0.125, 4));
  const pump = at(solid(new CylinderGeometry(0.5, 0.5, 0.9, 24).rotateZ(Math.PI / 2), M.steel()), 4.9, 0.85, 4);
  const guard = at(rbox(0.6, 0.5, 0.5, M.yellow()), 5.7, 0.75, 4);
  const motorM = at(solid(new CylinderGeometry(0.48, 0.48, 1.4, 24).rotateZ(Math.PI / 2), M.body()), 6.85, 0.8, 4);
  const fins = at(solid(new CylinderGeometry(0.5, 0.5, 1.2, 24, 1, true).rotateZ(Math.PI / 2), M.body2()), 6.85, 0.8, 4);
  rack.add(pump, guard, motorM, fins);
  // Valve body on the drop
  rack.add(at(rbox(0.62, 0.62, 0.62, M.steel(), 0.06), 3, 1.32, -1.3));
  rack.add(at(solid(new CylinderGeometry(0.05, 0.05, 0.5, 10), M.steel()), 3, 1.8, -1.3));
  g.add(bake(rack));
  const wheel = at(solid(new TorusGeometry(0.34, 0.035, 8, 28).rotateX(Math.PI / 2), M.red()), 3, 2.06, -1.3);
  g.add(wheel);
  const gauge = pressureGauge(0.38);
  gauge.position.set(-2, 1.85, 3.0);
  const post = at(solid(new BoxGeometry(0.08, 1.6, 0.08), M.galv()), -2, 0.8, 2.9);
  g.add(gauge, post);
  return Object.assign(g, {
    gauge,
    valve: new Vector3(3, 1.4, -1.3),
    leak: new Vector3(3, 1.62, -1.0),
    motor: new Vector3(6.85, 0.8, 4),
  });
}

// ============================================================== vapour
/** Steam / vapour plume from a point: soft white puffs, normal-blended, alpha fading with age. */
export function vapour(count: number, origin: Vector3, spread = 1) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  const life = Array.from({ length: count }, () => Math.random());
  const vel = Array.from({ length: count }, () => new Vector3());
  const reseed = (i: number) => vel[i].set((Math.random() - 0.3) * 1.3 * spread, 0.7 + Math.random() * 0.8, (0.35 + Math.random() * 0.8) * spread);
  vel.forEach((_, i) => reseed(i));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 4));
  const mat = new PointsMaterial({ size: 4, map: softDot(0.3), vertexColors: true, transparent: true, depthWrite: false, blending: NormalBlending });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  const tick = (_t: number, dt: number) => {
    for (let i = 0; i < count; i++) {
      life[i] += dt * 0.3; // a slower drift keeps more puffs in the plume, so it reads as a body of vapour
      if (life[i] > 1) {
        life[i] = 0;
        reseed(i);
      }
      const k = life[i];
      // Expands as it rises and drifts a little downwind (+X).
      pos[i * 3] = origin.x + vel[i].x * k * 3 + k * k * 1.2 + Math.sin(k * 6 + i) * 0.3 * k;
      pos[i * 3 + 1] = origin.y + vel[i].y * k * 3.2;
      pos[i * 3 + 2] = origin.z + vel[i].z * k * 2.6;
      // Shaded grey-blue near the leak, lightening as it rises, so steam reads against a light floor and sky
      // (pure white puffs vanish on this palette); denser near the leak, gone by the end of its life.
      col[i * 4] = 0.33 + k * 0.45;
      col[i * 4 + 1] = 0.39 + k * 0.42;
      col[i * 4 + 2] = 0.48 + k * 0.38;
      col[i * 4 + 3] = Math.min(1, k / 0.12) * Math.pow(1 - k, 1.3) * 0.92;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  tick(0, 0);
  return Object.assign(points, { tick });
}

// ============================================================== bridge
/**
 * Steel Pratt-truss bridge over a river: concrete piers and abutments, deck
 * with asphalt, lane markings and parapets, painted truss. Spans x −span/2..span/2.
 */
export function trussBridge(span = 36) {
  const g = new Group();
  const water = new Mesh(new PlaneGeometry(16, 160), M.water());
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.03;
  water.receiveShadow = true;
  g.add(water);
  // Riprap banks framing the river
  const banks = new Group();
  for (const s of [-1, 1]) {
    const b = at(solid(new BoxGeometry(2.4, 0.5, 160), paint(0x9b9890, 0.95)), s * 9.1, 0.12, 0);
    b.rotation.z = s * 0.18;
    banks.add(b);
  }
  g.add(bake(banks, { cast: false }));

  const conc = new Group();
  const deck = at(solid(new BoxGeometry(span, 0.7, 7.2), M.concrete()), 0, 7, 0);
  deck.castShadow = true;
  conc.add(deck);
  const piers = [-9, 9].map((x) => {
    const p = at(rbox(2.2, 6.65, 4.6, M.concrete(), 0.05), x, 3.33, 0);
    conc.add(p, at(rbox(2.8, 0.5, 6.4, M.concrete(), 0.04), x, 6.45, 0));
    return p.position.clone();
  });
  for (const x of [-span / 2, span / 2]) conc.add(at(rbox(3.4, 7, 8, M.concrete(), 0.05), x, 3.5, 0));
  // Parapets
  for (const z of [-3.5, 3.5]) conc.add(at(solid(new BoxGeometry(span, 0.5, 0.2), M.concrete()), 0, 7.6, z));
  g.add(bake(conc));
  // Asphalt and lane markings
  const road = at(new Mesh(new BoxGeometry(span, 0.04, 6.6), M.asphalt()), 0, 7.37, 0);
  road.receiveShadow = true;
  g.add(road);
  const marks = new Group();
  for (let x = -span / 2 + 1; x < span / 2 - 1; x += 6) marks.add(at(new Mesh(new BoxGeometry(3, 0.01, 0.12), M.white()), x + 1.5, 7.395, 0));
  for (const z of [-3.05, 3.05]) marks.add(at(new Mesh(new BoxGeometry(span, 0.01, 0.1), M.white()), 0, 7.395, z));
  g.add(bake(marks, { cast: false }));
  // Truss (painted steel)
  const truss = new Group();
  const top = 11.6, bot = 7.6, bays = 12, bw = span / bays;
  for (const z of [-3.3, 3.3]) {
    for (let i = 0; i < bays; i++) {
      const x0 = -span / 2 + i * bw, x1 = x0 + bw;
      truss.add(beam(new Vector3(x0, bot, z), new Vector3(x1, bot, z), 0.34, M.bridge()));
      if (i > 0 && i < bays - 1) truss.add(beam(new Vector3(x0, top, z), new Vector3(x1, top, z), 0.34, M.bridge()));
      if (i > 0) truss.add(beam(new Vector3(x0, bot, z), new Vector3(x0, top, z), 0.22, M.bridge()));
      // Pratt: diagonals slope down toward mid-span; end posts are inclined.
      if (i === 0) truss.add(beam(new Vector3(x0, bot, z), new Vector3(x1, top, z), 0.34, M.bridge()));
      else if (i === bays - 1) truss.add(beam(new Vector3(x0, top, z), new Vector3(x1, bot, z), 0.34, M.bridge()));
      else truss.add(i < bays / 2 ? beam(new Vector3(x0, top, z), new Vector3(x1, bot, z), 0.16, M.bridge()) : beam(new Vector3(x0, bot, z), new Vector3(x1, top, z), 0.16, M.bridge()));
    }
  }
  for (let i = 1; i < bays; i++) {
    const x = -span / 2 + i * bw;
    truss.add(beam(new Vector3(x, top, -3.3), new Vector3(x, top, 3.3), 0.16, M.bridge()));
    if (i % 2 && i < bays - 1) truss.add(beam(new Vector3(x, top, -3.3), new Vector3(x + bw, top, 3.3), 0.08, M.bridge()));
  }
  g.add(bake(truss));
  const deckY = 7.39;
  // Approach embankments with concrete retaining walls and asphalt ramps (1:3), so traffic has somewhere to go.
  const RAMP = 22;
  const x0 = span / 2 + 1.7;
  for (const s of [-1, 1]) {
    // Mirrored shape for the left side; ExtrudeGeometry fixes the winding itself.
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(s * RAMP, 0);
    shape.lineTo(0, 7.35);
    shape.closePath();
    const geo = new ExtrudeGeometry(shape, { depth: 7.2, bevelEnabled: false });
    geo.translate(0, 0, -3.6);
    const wedge = solid(geo, concreteMat(0xbdbebc, 3));
    wedge.position.x = s * x0;
    g.add(wedge);
    const top = new Mesh(new BoxGeometry(Math.hypot(RAMP, 7.35) + 0.4, 0.04, 6.6), M.asphalt());
    top.position.set(s * (x0 + RAMP / 2), 7.35 / 2 + 0.03, 0);
    top.rotation.z = -s * Math.atan2(7.35, RAMP);
    top.receiveShadow = true;
    g.add(top);
  }
  /** Road surface height and pitch at x (deck, then the ramps down to the ground). */
  const surfaceAt = (x: number) => {
    const a = Math.abs(x);
    if (a <= x0) return { y: deckY, pitch: 0 };
    const f = Math.min(1, (a - x0) / RAMP);
    return { y: Math.max(0, deckY * (1 - f)), pitch: f >= 1 ? 0 : Math.sign(x) * Math.atan2(7.35, RAMP) };
  };
  return Object.assign(g, { piers, deckY, surfaceAt, reach: x0 + RAMP });
}

/** Passenger car (~4.4 × 1.8 × 1.45 m), baked. Faces +X. */
export function car(color = 0xe9eaec) {
  const g = new Group();
  const bodyMat = paint(color, 0.32, 0.0);
  g.add(at(rbox(4.4, 0.68, 1.8, bodyMat, 0.12), 0, 0.58, 0));
  g.add(at(rbox(2.4, 0.56, 1.6, darkGlass(), 0.12), -0.15, 1.18, 0));
  g.add(at(rbox(2.1, 0.06, 1.5, bodyMat, 0.03), -0.15, 1.47, 0));
  const wheel = new CylinderGeometry(0.33, 0.33, 0.24, 18).rotateX(Math.PI / 2);
  for (const [x, z] of [[-1.35, -0.8], [1.35, -0.8], [-1.35, 0.8], [1.35, 0.8]]) g.add(at(solid(wheel, M.rubber()), x, 0.33, z));
  bake(g);
  g.add(blobShadow(4.8, 2.2, 0.42));
  return g;
}

/** Survey quadcopter (~1 m span): white body, dark arms, translucent rotor discs, gimbal camera, nav lights. */
export function drone() {
  const g = new Group();
  const frame = new Group();
  frame.add(rbox(0.42, 0.14, 0.52, M.white(), 0.05));
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
    frame.add(beam(new Vector3(0, 0, 0), new Vector3(x, 0.03, z), 0.045, M.dark()));
    frame.add(at(solid(new CylinderGeometry(0.05, 0.05, 0.08, 12), M.dark()), x, 0.06, z));
  }
  frame.add(at(solid(new SphereGeometry(0.07, 14, 10), M.dark()), 0, -0.12, 0.18));
  bake(frame);
  g.add(frame);
  const rotors: Mesh[] = [];
  const disc = new CylinderGeometry(0.27, 0.27, 0.008, 28);
  const rotorMat = overlayMat(0x2c3136, 0.28);
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
    const r = at(new Mesh(disc, rotorMat), x, 0.11, z);
    g.add(r);
    rotors.push(r);
  }
  g.add(at(new Mesh(new SphereGeometry(0.02, 8, 6), led(0x22c55e, 2)), 0.42, 0.02, 0.48), at(new Mesh(new SphereGeometry(0.02, 8, 6), led(0xef4444, 2)), -0.42, 0.02, 0.48));
  return Object.assign(g, { rotors });
}

// ============================================================== robot cell
/** Six-axis industrial robot (~2.4 m reach) in safety orange. Animate with `pose(t)`. */
export function robotArm() {
  const g = new Group();
  const base = new Group();
  base.add(at(solid(new CylinderGeometry(0.5, 0.58, 0.3, 28), M.dark()), 0, 0.15, 0));
  bake(base);
  g.add(base);
  const turret = new Group();
  turret.position.y = 0.3;
  turret.add(at(solid(new CylinderGeometry(0.42, 0.46, 0.5, 28), M.orange()), 0, 0.25, 0));
  turret.add(at(rbox(0.5, 0.6, 0.6, M.orange(), 0.08), 0.12, 0.7, 0));
  g.add(turret);
  const shoulder = new Group();
  shoulder.position.set(0.15, 0.85, 0);
  turret.add(shoulder);
  shoulder.add(at(rbox(0.32, 1.25, 0.36, M.orange(), 0.1), 0, 0.6, 0));
  const elbow = new Group();
  elbow.position.y = 1.2;
  shoulder.add(elbow);
  elbow.add(at(solid(new CylinderGeometry(0.2, 0.2, 0.46, 20).rotateX(Math.PI / 2), M.dark()), 0, 0, 0));
  elbow.add(at(rbox(1.1, 0.24, 0.26, M.orange(), 0.08), 0.5, 0, 0));
  const wrist = new Group();
  wrist.position.x = 1.08;
  elbow.add(wrist);
  wrist.add(solid(new CylinderGeometry(0.1, 0.1, 0.3, 16).rotateZ(Math.PI / 2), M.dark()));
  wrist.add(at(rbox(0.16, 0.22, 0.32, M.steel(), 0.03), 0.22, -0.02, 0));
  g.add(blobShadow(1.6, 1.6, 0.25));
  const pose = (t: number) => {
    turret.rotation.y = Math.sin(t * 0.6) * 1.1;
    shoulder.rotation.z = -0.35 + Math.sin(t * 0.9) * 0.25;
    elbow.rotation.z = -0.6 + Math.sin(t * 0.9 + 1.2) * 0.35;
    wrist.rotation.z = -0.4 + Math.sin(t * 1.4) * 0.3;
  };
  pose(0);
  return Object.assign(g, { pose });
}

/** Perimeter guard fence: yellow posts and see-through dark mesh panels around w × d. */
export function guardFence(w: number, d: number, gap: [number, number] | null = null) {
  const g = new Group();
  const posts = new Group();
  const panelMat = new MeshStandardMaterial({ color: 0x2c3136, roughness: 0.6, transparent: true, opacity: 0.32, depthWrite: false, side: DoubleSide });
  const H = 1.9;
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      posts.add(at(solid(new BoxGeometry(0.06, H + 0.1, 0.06), M.yellow()), x0 + (x1 - x0) * f, (H + 0.1) / 2, z0 + (z1 - z0) * f));
    }
    const p = new Mesh(new PlaneGeometry(len, H - 0.25), panelMat);
    p.position.set((x0 + x1) / 2, 0.2 + (H - 0.25) / 2, (z0 + z1) / 2);
    p.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(p);
    const rail = at(solid(new BoxGeometry(len, 0.04, 0.04), M.yellow()), (x0 + x1) / 2, H, (z0 + z1) / 2);
    rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    posts.add(rail);
  };
  const hw = w / 2, hd = d / 2;
  side(-hw, -hd, hw, -hd);
  side(hw, -hd, hw, hd);
  side(-hw, hd, -hw, -hd);
  if (gap) {
    side(-hw, hd, gap[0], hd);
    side(gap[1], hd, hw, hd);
  } else side(hw, hd, -hw, hd);
  g.add(bake(posts));
  return g;
}

// ============================================================== yard details
/** Pale concrete site road with low kerbs, along X. */
export function siteRoad(x0: number, x1: number, width = 7) {
  const g = new Group();
  const len = x1 - x0;
  // Pale concrete pavement, one step darker than the yard, with kerbs and no centre dashes: a dark
  // asphalt band with white dashes was the strongest line in the wide shots and led the eye off the stations.
  const road = at(new Mesh(new BoxGeometry(len, 0.03, width), concreteMat(0xc4c9ce, 0)), (x0 + x1) / 2, 0.015, 0);
  road.receiveShadow = true;
  g.add(road);
  const marks = new Group();
  for (const z of [-width / 2 - 0.12, width / 2 + 0.12]) marks.add(at(new Mesh(new BoxGeometry(len, 0.1, 0.24), M.concrete()), (x0 + x1) / 2, 0.05, z));
  g.add(bake(marks, { cast: false }));
  return g;
}

/** Painted pedestrian crossing (white bars) across an aisle along Z. */
export function zebra(width: number, len: number) {
  const g = new Group();
  for (let z = -len / 2; z < len / 2; z += 0.9) g.add(at(new Mesh(new BoxGeometry(width, 0.006, 0.45), M.white()), 0, 0.004, z + 0.225));
  return bake(g, { cast: false });
}

/** A floor-painted line (aisle marking). */
export function floorLine(len: number, color: Material = M.yellow(), w = 0.12) {
  const m = new Mesh(new BoxGeometry(len, 0.006, w), color);
  m.receiveShadow = true;
  m.position.y = 0.004;
  return m;
}

/** Light-grey painted HMI screen texture with a simple demo dashboard. */
export function hmiTexture(title: string, rows: [string, string, string][]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f8fa';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#0f1b2a';
  g.fillRect(0, 0, 512, 44);
  g.fillStyle = '#ffffff';
  g.font = '600 20px "IBM Plex Sans", system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(title, 18, 23);
  g.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
  g.fillStyle = '#9fb0c2';
  g.textAlign = 'right';
  g.fillText('DEMO DATA', 494, 23);
  g.textAlign = 'left';
  rows.forEach(([k, val, tone], i) => {
    const y = 64 + i * 80;
    g.fillStyle = '#ffffff';
    g.fillRect(18, y, 476, 66);
    g.strokeStyle = '#d6dde5';
    g.lineWidth = 2;
    g.strokeRect(18, y, 476, 66);
    g.fillStyle = tone;
    g.fillRect(18, y, 6, 66);
    g.fillStyle = '#566679';
    g.font = '500 16px "IBM Plex Mono", ui-monospace, monospace';
    g.fillText(k, 40, y + 33);
    g.fillStyle = '#08111d';
    g.font = '600 30px "IBM Plex Sans", system-ui, sans-serif';
    g.textAlign = 'right';
    g.fillText(val, 476, y + 34);
    g.textAlign = 'left';
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** HMI panel on a stand: returns the screen mesh (MeshBasic, readable in daylight). */
export function hmiStand(title: string, rows: [string, string, string][]) {
  const g = new Group();
  const fixed = new Group();
  fixed.add(at(solid(new BoxGeometry(0.1, 1.45, 0.1), M.galv()), 0, 0.72, 0));
  fixed.add(at(rbox(1.24, 0.8, 0.08, M.dark(), 0.02), 0, 1.75, 0));
  fixed.add(at(solid(new BoxGeometry(0.4, 0.03, 0.4), M.galv()), 0, 0.015, 0));
  bake(fixed);
  const screen = new Mesh(new PlaneGeometry(1.12, 0.7), new MeshBasicMaterial({ map: hmiTexture(title, rows) }));
  screen.position.set(0, 1.75, 0.045);
  g.add(fixed, screen);
  return g;
}

/** A floor slab for a station (receives shadows only). */
export const pad = (w: number, d: number) => slab(w, 0.12, d, M.concrete());


/** Flange for the inspection line (machined steel). */
export function flangeGeometry() {
  return new LatheGeometry(
    [[0.0, -0.18], [0.55, -0.18], [0.58, -0.1], [0.58, 0.02], [0.3, 0.05], [0.28, 0.25], [0.18, 0.25], [0.18, -0.18]].map(([x, y]) => new Vector2(x, y)),
    48,
  );
}

export interface ShotOptions {
  /** Canvas aspect (width / free height) the shot is composed for. Default 2.1. */
  refAspect?: number;
  /** Fog near/far as multiples of the camera distance (default [1.05, 3.6]); false leaves the scene fog alone. */
  fog?: [number, number] | false;
  /** Extra downward look (radians) per unit of narrowing, capped at 0.22. Default 0.15. */
  lift?: number;
  /**
   * Half-width (metres, across the view at the target) of the part that must stay in frame on
   * narrow canvases, e.g. the machines but not the empty yard or the poles at the sides. The camera
   * then backs off only as far as that needs, so a phone shows the subject large. Default: backs
   * off by (narrowing)^0.8.
   */
  keep?: number;
  /** Target offset (metres) applied in full once the canvas is half as wide as the reference, e.g. to keep people at one side in frame on a phone. */
  pan?: Vector3;
}

/**
 * A fixed hero shot that stays readable at any canvas size:
 * - it is centred in `stage.frame`, the part of the canvas below any page
 *   chrome laid over its top (eyebrow, caption, mode toggle);
 * - on narrower canvases the camera backs off along its view line and looks
 *   down a little more, so the floor fills the height instead of fog;
 * - the fog follows the camera distance, so the far floor always dissolves
 *   into the section colour (no horizon band) without fogging the subject.
 * Call the returned function every frame (optional pointer parallax in metres).
 */
export function framedShot(stage: Stage, pos: Vector3, target: Vector3, opts: ShotOptions = {}) {
  const refAspect = opts.refAspect ?? 2.1;
  const fogK = opts.fog ?? [1.05, 3.6];
  const off = pos.clone().sub(target);
  const base = off.length();
  const az = Math.atan2(off.x, off.z);
  const el0 = Math.asin(off.y / base);
  const dir = off.clone().normalize();
  const aim = target.clone();
  const cur = new Vector3();
  const sp = { x: 0, y: 0 };
  let dist = base;
  stage.onResize((w, h) => {
    const f = stage.frame;
    const ratio = refAspect / (w / Math.max(1, f.bottom - f.top));
    // Back off a little less than the width needs (the sides may crop slightly) and look down more,
    // so a wide subject on a phone fills the band's height instead of leaving a strip of empty floor.
    const tanH = Math.tan((stage.camera.fov * Math.PI) / 360) * (w / Math.max(1, h));
    // With `keep`, never closer than a free area covering 85% of the full lens height at the reference
    // distance (what a desktop band below its caption shows), so a short band does not crop top and bottom.
    const back = opts.keep ? Math.max(opts.keep / (tanH * base), 0.85 / (Math.max(1, f.bottom - f.top) / h)) : Math.pow(ratio, 0.8);
    dist = base * Math.max(1, Math.min(2.6, back));
    const el = Math.min(1.3, el0 + Math.max(0, Math.min(0.22, (ratio - 1) * (opts.lift ?? 0.15))));
    aim.copy(target);
    if (opts.pan) aim.addScaledVector(opts.pan, Math.max(0, Math.min(1, ratio - 1)));
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const offY = (f.top + f.bottom) / 2 - h / 2;
    if (Math.abs(offY) >= 1) stage.camera.setViewOffset(w, h, 0, -offY, w, h);
    else stage.camera.clearViewOffset();
    stage.camera.updateProjectionMatrix();
    const fog = stage.scene.fog;
    if (fogK && fog instanceof Fog) {
      fog.near = dist * fogK[0];
      fog.far = dist * fogK[1];
    }
  });
  return (dt: number, parallax = 0) => {
    sp.x = damp(sp.x, stage.pointer.x, 3, dt);
    sp.y = damp(sp.y, stage.pointer.y, 3, dt);
    cur.copy(aim).addScaledVector(dir, dist);
    stage.camera.position.set(cur.x + sp.x * parallax, cur.y + sp.y * parallax * 0.4, cur.z);
    stage.camera.lookAt(aim);
  };
}
