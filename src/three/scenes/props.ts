/**
 * Shared station props (not a scene): racking, conveyor, pipe rack, building
 * backdrops, bridge, drone, cars, robot-cell fence and vapour used by Journey and the pillar
 * scenes (the press, forklift and robot arm are in machines.ts), so every 3D view is built from the same parts and reads as one
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
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../core/stage';
import { M, bake, concreteMat, damp, beam, blobShadow, led, overlayMat, paint, slab, softDot, solid } from '../core/kit';
import { isDark } from '../core/mood';
import screens from '../../data/app-screens.json';

let rackBlueMat: MeshStandardMaterial | null = null;
let wrapMat: MeshStandardMaterial | null = null;
let darkGlassMat: MeshStandardMaterial | null = null;
let cardBMat: MeshStandardMaterial | null = null;
let tapeMat: MeshStandardMaterial | null = null;
let slateMat: MeshStandardMaterial | null = null;
let motorMat: MeshStandardMaterial | null = null;
let houseCladMat: MeshStandardMaterial | null = null;
let meshPanelMat: MeshStandardMaterial | null = null;
const rackBlue = () => (rackBlueMat ??= paint(0x2e5a87, 0.5));
/** Stretch film over a load: milky, glossy. */
const stretchWrap = () => (wrapMat ??= paint(0xd9dfe3, 0.22));
const darkGlass = () => (darkGlassMat ??= new MeshStandardMaterial({ color: 0x27323c, roughness: 0.08, metalness: 0 }));
/** A second kraft tone, so a carton stack is not one flat colour. */
const cardB = () => (cardBMat ??= paint(0x9c7a4f, 0.88));
/** Brown parcel tape (a little glossier than the board). */
const tape = () => (tapeMat ??= paint(0xc2a273, 0.45));
/** Dark slate machine paint (pump casings, gearboxes). */
const slate = () => (slateMat ??= paint(0x4d5a64, 0.5));
/** Muted grey-blue motor paint. */
const motorPaint = () => (motorMat ??= paint(0x56687a, 0.5));
/** Profiled steel cladding for small buildings (head house): 1 m texture tile, so UVs are in metres. */
const houseClad = () => {
  if (houseCladMat) return houseCladMat;
  const t = claddingTexture().clone();
  t.needsUpdate = true;
  return (houseCladMat = new MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 2, color: 0xaab3bb, roughness: 0.5, metalness: 0 }));
};
/** 50 mm welded guard mesh (alpha texture; mipmaps average it to a see-through tint at distance). */
const guardMesh = () => {
  if (meshPanelMat) return meshPanelMat;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 16, 3);
  g.fillRect(0, 0, 3, 16);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return (meshPanelMat = new MeshStandardMaterial({ color: 0x4a5258, map: t, roughness: 0.6, metalness: 0, transparent: true, depthWrite: false, side: DoubleSide }));
};

const rbox = (w: number, h: number, d: number, mat: Material, r = 0.03) => solid(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.3)), mat);
/** Small rounded box: one bevel segment (a soft chamfer), for parts seen from a distance. */
const sbox = (w: number, h: number, d: number, mat: Material, r = 0.015) => solid(new RoundedBoxGeometry(w, h, d, 1, Math.min(r, Math.min(w, h, d) * 0.3)), mat);
const at = <T extends Object3D>(o: T, x: number, y: number, z: number) => (o.position.set(x, y, z), o);
type Axis = 'x' | 'y' | 'z';
/** Cylinder along an axis. */
function cyl(r: number, len: number, mat: Material, axis: Axis = 'y', seg = 16, rTop = r, open = false) {
  const g = new CylinderGeometry(rTop, r, len, seg, 1, open);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return solid(g, mat);
}
const hexCache = new Map<string, CylinderGeometry>();
/** Hex bolt head / nut with crisp flats (shared geometry per size and axis). */
function hexBolt(r: number, len: number, axis: Axis) {
  const key = `${r}${len}${axis}`;
  let g = hexCache.get(key);
  if (!g) {
    g = toCreasedNormals(new CylinderGeometry(r, r, len, 6), 0.5) as CylinderGeometry;
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    else if (axis === 'z') g.rotateX(Math.PI / 2);
    hexCache.set(key, g);
  }
  return solid(g, M.steel());
}
/** A flange pair with a bolt ring on a pipe along `axis`, centred at (x, y, z). */
function flangePair(parent: Object3D, axis: Axis, x: number, y: number, z: number, r: number, mat: Material = M.steel()) {
  const fr = r * 1.42 + 0.03, t = Math.max(0.035, r * 0.16);
  for (const s of [-1, 1]) {
    const f = cyl(fr, t, mat, axis, 28);
    const o = (t / 2 + 0.004) * s;
    parent.add(at(f, x + (axis === 'x' ? o : 0), y + (axis === 'y' ? o : 0), z + (axis === 'z' ? o : 0)));
  }
  const n = r > 0.3 ? 12 : 8;
  const rb = r * 1.2 + 0.02;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const u = Math.cos(a) * rb, v = Math.sin(a) * rb;
    const b = hexBolt(0.024, t * 2 + 0.07, axis);
    if (axis === 'x') parent.add(at(b, x, y + u, z + v));
    else if (axis === 'y') parent.add(at(b, x + u, y, z + v));
    else parent.add(at(b, x + u, y + v, z));
  }
}

// ============================================================== racking
/** One block pallet (1.2 × 1.0 m, 144 mm): bottom boards, nine blocks, stringer boards and five deck boards. */
function pallet(parent: Object3D, x: number, y: number, z: number) {
  const P = M.pallet();
  for (const dz of [-0.45, 0, 0.45]) parent.add(at(solid(new BoxGeometry(1.2, 0.022, 0.1), P), x, y + 0.011, z + dz));
  for (const dx of [-0.525, 0, 0.525]) {
    for (const dz of [-0.45, 0, 0.45]) parent.add(at(solid(new BoxGeometry(0.145, 0.078, dz === 0 ? 0.145 : 0.1), P), x + dx, y + 0.061, z + dz));
    parent.add(at(solid(new BoxGeometry(0.145, 0.022, 1.0), P), x + dx, y + 0.111, z));
  }
  for (const dz of [-0.43, -0.215, 0, 0.215, 0.43]) parent.add(at(solid(new BoxGeometry(1.2, 0.022, dz === 0 || Math.abs(dz) > 0.4 ? 0.145 : 0.1), P), x, y + 0.133, z + dz));
}

/** Selective pallet racking: blue uprights, orange beams, block pallets with taped carton stacks and one stretch-wrapped load per bay. Baked. Spans x 0..bays*bay, z 0..depth. */
export function palletRacking(bays = 4, bay = 2.8, depth = 1.1, levels = [0.15, 1.85, 3.55], height = 5.4) {
  const g = new Group();
  const up = new BoxGeometry(0.09, height, 0.07);
  for (let b = 0; b <= bays; b++) for (const z of [0, depth]) g.add(at(solid(up, rackBlue()), b * bay, height / 2, z));
  // Diagonal bracing on each frame, base plates
  for (let b = 0; b <= bays; b++) {
    for (let y = 0.3; y < height - 1; y += 1.2) g.add(beam(new Vector3(b * bay, y, 0), new Vector3(b * bay, y + 1.1, depth), 0.035, rackBlue()));
    for (const z of [0, depth]) g.add(at(solid(new BoxGeometry(0.16, 0.012, 0.14), M.galv()), b * bay, 0.006, z));
  }
  const bm = new BoxGeometry(bay - 0.09, 0.12, 0.05);
  // Deterministic jitter (the same racking every load).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let b = 0; b < bays; b++) {
    for (const y of levels.slice(1)) for (const z of [0, depth]) g.add(at(solid(bm, M.orange()), b * bay + bay / 2, y, z));
    const wrapLevel = b % levels.length;
    for (const [li, y] of levels.entries()) {
      for (const k of [0, 1]) {
        if ((b * 3 + li * 2 + k) % 5 === 4) continue; // a few empty slots
        const x = b * bay + 0.75 + k * 1.3;
        const top = y + (li === 0 ? 0 : 0.06);
        const zc = depth / 2;
        pallet(g, x, top, zc);
        const h = 0.8 + ((b + li + k) % 3) * 0.22;
        const base = top + 0.144;
        if (li === wrapLevel && k === (b % 2)) {
          // One stretch-wrapped load per bay: film over the stack, a little proud of the pallet edge.
          g.add(at(rbox(1.16, h, 0.98, stretchWrap(), 0.05), x, base + h / 2, zc));
          g.add(at(solid(new BoxGeometry(1.0, 0.006, 0.82), stretchWrap()), x, base + h + 0.003, zc));
          continue;
        }
        // Carton stack: 2 × 2 per layer, sizes and placing vary a little, tape over each top seam.
        const layers = Math.max(1, Math.round(h / 0.4));
        const lh = h / layers;
        for (let l = 0; l < layers; l++) {
          for (const cx of [-0.29, 0.29]) {
            for (const cz of [-0.24, 0.24]) {
              const w = 0.54 + rnd() * 0.04, d = 0.44 + rnd() * 0.03, hh = lh - 0.01 - rnd() * 0.03;
              const px = x + cx + (rnd() - 0.5) * 0.03, pz = zc + cz + (rnd() - 0.5) * 0.03;
              const py = base + l * lh + hh / 2;
              g.add(at(solid(new BoxGeometry(w, hh, d), rnd() > 0.5 ? M.card() : cardB()), px, py, pz));
              g.add(at(solid(new BoxGeometry(0.05, 0.004, d + 0.004), tape()), px, py + hh / 2 + 0.002, pz));
              // The tape runs down the front face a few centimetres.
              if (cz > 0) g.add(at(solid(new BoxGeometry(0.05, 0.07, 0.004), tape()), px, py + hh / 2 - 0.035, pz + d / 2 + 0.002));
            }
          }
        }
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
  // Walkway grating and handrail on the +Z side: from clear of the feed hopper up to the head house door.
  const w0 = -L / 2 + 3.2, w1x = L / 2 - 1.66, wl = w1x - w0, wc = (w0 + w1x) / 2;
  struct.add(at(solid(new BoxGeometry(wl, 0.04, 0.8), M.galv()), wc, -0.48, 1.6));
  for (let x = w0; x <= w1x + 0.01; x += wl / Math.round(wl / 2)) struct.add(at(solid(new BoxGeometry(0.05, 1.05, 0.05), M.yellow()), x, 0.05, 1.98));
  struct.add(at(solid(new BoxGeometry(wl, 0.05, 0.05), M.yellow()), wc, 0.55, 1.98));
  struct.add(at(solid(new BoxGeometry(wl, 0.04, 0.04), M.yellow()), wc, 0.08, 1.98));
  struct.add(at(solid(new BoxGeometry(wl, 0.1, 0.012), M.yellow()), wc, -0.41, 1.99)); // toe board
  const roll = new CylinderGeometry(0.13, 0.13, 0.62, 14);
  roll.rotateX(Math.PI / 2);
  const retRoll = new CylinderGeometry(0.075, 0.075, 1.5, 12).rotateX(Math.PI / 2);
  const hotRolls: Mesh[] = [];
  const n = Math.floor((L - 1.6) / 1.6) + 1;
  // Where the return strand is high enough above the floor (the tail end sits low).
  const xs = Math.max(-L / 2 + 0.6, (0.32 - 3.0 + 0.75 * Math.cos(ANG)) / Math.sin(ANG));
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + 0.8 + i * 1.6;
    struct.add(at(solid(new BoxGeometry(0.08, 0.1, 2.2), M.body2()), x, -0.22, 0));
    // Wing brackets of the idler frame.
    for (const s of [-1, 1]) struct.add(at(solid(new BoxGeometry(0.06, 0.34, 0.06), M.body2()), x, -0.02, s * 0.97));
    const c = at(solid(roll, M.galv()), x, -0.1, 0);
    const w1 = at(solid(roll, M.galv()), x, 0.05, -0.62);
    w1.rotation.x = 0.5;
    const w2 = at(solid(roll, M.galv()), x, 0.05, 0.62);
    w2.rotation.x = -0.5;
    if (i === hotIdx) hotRolls.push(c, w1, w2);
    else struct.add(c, w1, w2);
    // Return idler every other set: a flat roller on hanger brackets under the stringers.
    if (i % 2 === 1 && x < L / 2 - 2 && x > xs + 0.3) {
      struct.add(at(solid(retRoll, M.galv()), x, -0.66, 0));
      for (const s of [-1, 1]) struct.add(at(solid(new BoxGeometry(0.05, 0.22, 0.05), M.body2()), x, -0.58, s * 0.8));
    }
  }
  // Return strand of the belt under the return idlers, rising to the tail pulley where the tail sits low.
  struct.add(at(solid(new BoxGeometry(L / 2 - 0.2 - xs, 0.02, 1.22), M.rubber()), (xs + L / 2 - 0.2) / 2, -0.75, 0));
  if (xs > -L / 2 + 0.7) {
    const rise = at(solid(new BoxGeometry(Math.hypot(xs + L / 2, 0.25), 0.02, 1.22), M.rubber()), (xs - L / 2) / 2, -0.625, 0);
    rise.rotation.z = -Math.atan2(0.25, xs + L / 2);
    struct.add(rise);
  }
  // Tail pulley with plummer blocks and screw take-ups on the stringers.
  struct.add(at(cyl(0.26, 1.5, M.body2(), 'z', 20), -L / 2, -0.24, 0));
  for (const s of [-1, 1]) {
    struct.add(at(sbox(0.34, 0.16, 0.14, M.body2()), -L / 2, -0.24, s * 0.9));
    struct.add(at(cyl(0.022, 0.9, M.steel(), 'x', 8), -L / 2 + 0.5, -0.24, s * 0.9));
  }
  // Skirt boards with rubber seals along the loading zone under the feed hopper.
  for (const s of [-1, 1]) {
    struct.add(at(sbox(3.4, 0.34, 0.05, M.body2()), -L / 2 + 2.0, 0.32, s * 0.47));
    struct.add(at(solid(new BoxGeometry(3.4, 0.07, 0.03), M.rubber()), -L / 2 + 2.0, 0.13, s * 0.47));
    for (let k = 0; k < 4; k++) struct.add(at(solid(new BoxGeometry(0.05, 0.3, 0.12), M.body2()), -L / 2 + 0.6 + k * 0.95, 0.32, s * 0.53));
  }
  // Secondary belt scraper on the return strand just before the head house: blades pressing up on the dirty side.
  const sx = L / 2 - 2.3;
  struct.add(at(cyl(0.04, 2.3, M.galv(), 'z', 10), sx, -0.9, 0));
  for (let k = 0; k < 6; k++) {
    const blade = at(sbox(0.16, 0.12, 0.19, M.orange(), 0.01), sx, -0.81, -0.5 + k * 0.2);
    blade.rotation.z = 0.25;
    struct.add(blade);
  }
  for (const s of [-1, 1]) {
    struct.add(at(solid(new BoxGeometry(0.08, 0.5, 0.05), M.body2()), sx, -0.68, s * 1.1));
    struct.add(at(cyl(0.05, 0.22, M.yellow(), 'y', 10), sx + 0.12, -0.72, s * 1.17)); // tensioner spring housing
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
  const cos = Math.cos(ANG), sin = Math.sin(ANG);
  g.add(headHouse(L, ANG));
  // Trestles from the stringers down to the ground (world-aligned)
  const trestles = new Group();
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
  /** Belt surface at belt-local x (metres up the belt from its centre), in the conveyor group's frame. */
  const beltAt = (x: number) => new Vector3(x * cos - 0.045 * sin, 3.0 + x * sin + 0.045 * cos, 0);
  return Object.assign(g, { conv, belt, ore, hotLocal, length: L, angle: ANG, tick, beltAt });
}

/** Wall of profiled cladding from a 2D outline (metres; UVs are metres, so the ribs keep a 250 mm pitch). */
function cladPanel(pts: [number, number][]) {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  s.closePath();
  return solid(new ShapeGeometry(s), houseClad());
}

/**
 * Head house of a troughed conveyor (world-aligned, in the conveyor group's frame): a clad steel house
 * round the head pulley on a braced four-column tower, mono-pitch roof with flashings, a door at the end
 * of the belt walkway, an access stair with landing on the far side, a discharge chute, and the drive
 * outboard on the near side (shaft-mounted gearbox, coupling guard, finned motor on a swing base) on a
 * railed platform. Baked.
 */
function headHouse(L: number, ANG: number) {
  const g = new Group();
  const cos = Math.cos(ANG), sin = Math.sin(ANG);
  const hx = (L / 2) * cos, hy = 3.0 + (L / 2) * sin;
  const x0 = hx - 1.6, x1 = hx + 0.7, Z = 2.1;
  const yf = hy - 1.35; // house floor
  const hBack = 3.05, hFront = 2.75; // wall heights at the back (-X) and front (+X)
  const cx = (x0 + x1) / 2, lx = x1 - x0;
  // Walls (cladding)
  const back = at(cladPanel([[-Z, 0], [Z, 0], [Z, hBack], [-Z, hBack]]), x0, yf, 0);
  back.rotation.y = -Math.PI / 2;
  const front = at(cladPanel([[-Z, 0], [Z, 0], [Z, hFront], [-Z, hFront]]), x1, yf, 0);
  front.rotation.y = Math.PI / 2;
  const near = at(cladPanel([[-lx / 2, 0], [lx / 2, 0], [lx / 2, hFront], [-lx / 2, hBack]]), cx, yf, Z);
  const far = at(cladPanel([[-lx / 2, 0], [lx / 2, 0], [lx / 2, hBack], [-lx / 2, hFront]]), cx, yf, -Z);
  far.rotation.y = Math.PI;
  g.add(back, front, near, far);
  // Floor soffit, corner and base trims, roof with gutter
  g.add(at(solid(new BoxGeometry(lx + 0.1, 0.18, 2 * Z + 0.1), M.body2()), cx, yf - 0.09, 0));
  for (const x of [x0, x1]) for (const z of [-Z, Z]) g.add(at(solid(new BoxGeometry(0.09, x === x0 ? hBack : hFront, 0.09), M.body()), x, yf + (x === x0 ? hBack : hFront) / 2, z));
  const pitch = Math.atan2(hBack - hFront, lx);
  const roof = at(rbox(lx + 0.5, 0.1, 2 * Z + 0.4, M.galv(), 0.03), cx + 0.05, yf + (hBack + hFront) / 2 + 0.07, 0);
  roof.rotation.z = -pitch;
  g.add(roof);
  g.add(at(cyl(0.06, 2 * Z + 0.4, M.body(), 'z', 10), x1 + 0.3, yf + hFront - 0.02, 0));
  // Door at the walkway end (-X wall) with frame and handle; walkway level at the wall.
  const wy = 3.0 + (x0 / cos) * sin - 0.46;
  g.add(at(sbox(0.06, 2.12, 1.0, M.body2()), x0 - 0.02, wy + 1.06, 1.6));
  g.add(at(sbox(0.05, 2.0, 0.86, M.body()), x0 - 0.05, wy + 1.0, 1.6));
  g.add(at(solid(new BoxGeometry(0.06, 0.03, 0.14), M.steel()), x0 - 0.09, wy + 1.0, 1.28));
  // Louvre vent on the near wall
  g.add(at(sbox(0.7, 0.45, 0.05, M.body2()), cx - 0.3, yf + 2.1, Z + 0.03));
  for (let k = 0; k < 5; k++) g.add(at(solid(new BoxGeometry(0.62, 0.025, 0.06), M.dark()), cx - 0.3, yf + 1.94 + k * 0.08, Z + 0.06));
  // Tower: four columns, ring beams, X-bracing, base plates
  const cols: [number, number][] = [[x0 + 0.2, -1.9], [x1 - 0.2, -1.9], [x0 + 0.2, 1.9], [x1 - 0.2, 1.9]];
  for (const [x, z] of cols) {
    g.add(at(sbox(0.22, yf, 0.22, M.body2(), 0.02), x, yf / 2, z));
    g.add(at(solid(new BoxGeometry(0.5, 0.03, 0.5), M.galv()), x, 0.015, z));
  }
  const xa = x0 + 0.2, xb = x1 - 0.2;
  for (const y of [yf * 0.5, yf - 0.25]) {
    for (const z of [-1.9, 1.9]) g.add(beam(new Vector3(xa, y, z), new Vector3(xb, y, z), 0.12, M.body2()));
    for (const x of [xa, xb]) g.add(beam(new Vector3(x, y, -1.9), new Vector3(x, y, 1.9), 0.12, M.body2()));
  }
  for (const [ya, yb] of [[0.3, yf * 0.5], [yf * 0.5, yf - 0.25]]) {
    for (const z of [-1.9, 1.9]) {
      g.add(beam(new Vector3(xa, ya, z), new Vector3(xb, yb, z), 0.07, M.body2()));
      g.add(beam(new Vector3(xb, ya, z), new Vector3(xa, yb, z), 0.07, M.body2()));
    }
    for (const x of [xa, xb]) {
      g.add(beam(new Vector3(x, ya, -1.9), new Vector3(x, yb, 1.9), 0.07, M.body2()));
      g.add(beam(new Vector3(x, ya, 1.9), new Vector3(x, yb, -1.9), 0.07, M.body2()));
    }
  }
  // Discharge chute under the front, angled down toward the pile
  const chute = at(rbox(1.0, 1.3, 1.5, slate(), 0.03), x1 - 0.1, yf - 0.55, 0);
  chute.rotation.z = -0.35;
  g.add(chute);
  // Stair on the far (-Z) side: stringers, treads, handrails, landing with a door
  const sTop = new Vector3(x0 - 0.05, yf, 0), run = yf / Math.tan(0.72);
  const sBot = new Vector3(x0 - 0.05 - run, 0, 0);
  const zs = [-2.25, -2.95];
  for (const z of zs) {
    g.add(beam(new Vector3(sBot.x, 0.05, z), new Vector3(sTop.x, yf, z), 0.06, M.body2()));
    g.add(beam(new Vector3(sBot.x, 1.0, z), new Vector3(sTop.x, yf + 1.0, z), 0.045, M.yellow()));
    for (let f = 0; f <= 1.001; f += 0.25) {
      const px = sBot.x + (sTop.x - sBot.x) * f, py = yf * f;
      g.add(at(solid(new BoxGeometry(0.045, 1.0, 0.045), M.yellow()), px, py + 0.5, z));
    }
  }
  const steps = Math.round(yf / 0.2);
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    g.add(at(solid(new BoxGeometry(0.26, 0.035, 0.66), M.galv()), sBot.x + (sTop.x - sBot.x) * f, yf * f, -2.6));
  }
  g.add(at(solid(new BoxGeometry(1.3, 0.05, 0.95), M.galv()), x0 + 0.6, yf - 0.02, -2.6));
  g.add(at(solid(new BoxGeometry(1.3, 0.045, 0.045), M.yellow()), x0 + 0.6, yf + 1.0, -3.05));
  g.add(at(solid(new BoxGeometry(0.045, 1.0, 0.045), M.yellow()), x0 + 1.25, yf + 0.5, -3.05));
  g.add(at(sbox(0.86, 2.0, 0.05, M.body()), x0 + 0.65, yf + 1.0, -Z - 0.03));
  // Drive on the near side, on the head pulley shaft
  const px = hx + 0.35 * sin, py = hy - 0.35 * cos; // head pulley centre
  g.add(at(cyl(0.07, 0.5, M.steel(), 'z', 12), px, py, Z + 0.2));
  g.add(at(sbox(0.38, 0.22, 0.16, M.body2()), px, py - 0.08, Z + 0.1));
  g.add(at(rbox(0.72, 0.86, 0.38, slate(), 0.05), px - 0.08, py - 0.16, Z + 0.5));
  g.add(at(cyl(0.2, 0.06, slate(), 'z', 20), px, py, Z + 0.72));
  for (let k = 0; k < 4; k++) g.add(at(solid(new BoxGeometry(0.66, 0.02, 0.4), slate()), px - 0.08, py - 0.42 + k * 0.12, Z + 0.5)); // cooling ribs
  // Torque arm down to the platform
  g.add(at(solid(new BoxGeometry(0.08, 0.5, 0.08), M.body2()), px + 0.2, py - 0.8, Z + 0.5));
  const dy = py - 0.32; // drive line (gearbox input, coupling, motor) height
  g.add(at(rbox(0.5, 0.34, 0.34, M.yellow(), 0.08), px - 0.7, dy, Z + 0.5)); // coupling guard
  const mx = px - 1.35;
  g.add(at(cyl(0.25, 0.8, motorPaint(), 'x', 24), mx, dy, Z + 0.5));
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    if (Math.sin(a) < -0.6) continue; // no fins under the feet
    const fin = at(solid(new BoxGeometry(0.68, 0.05, 0.016), motorPaint()), mx, dy + Math.sin(a) * 0.265, Z + 0.5 + Math.cos(a) * 0.265);
    fin.rotation.x = Math.PI / 2 - a;
    g.add(fin);
  }
  g.add(at(cyl(0.255, 0.2, M.dark(), 'x', 24), mx - 0.5, dy, Z + 0.5)); // fan cowl
  g.add(at(sbox(0.2, 0.14, 0.22, motorPaint()), mx + 0.1, dy + 0.32, Z + 0.5)); // terminal box
  for (const s of [-1, 1]) g.add(at(solid(new BoxGeometry(0.12, 0.12, 0.42), motorPaint()), mx + s * 0.25, dy - 0.27, Z + 0.5)); // feet
  g.add(at(sbox(1.7, 0.08, 0.6, M.body2()), px - 0.95, dy - 0.37, Z + 0.5)); // swing base
  // Drive platform: grating, handrail, cantilever brackets
  const pyl = dy - 0.43;
  g.add(at(solid(new BoxGeometry(2.6, 0.04, 1.0), M.galv()), px - 0.85, pyl, Z + 0.55));
  for (let k = 0; k < 4; k++) g.add(at(solid(new BoxGeometry(0.045, 1.05, 0.045), M.yellow()), px - 2.1 + k * 0.83, pyl + 0.52, Z + 1.03));
  for (const y of [0.5, 1.05]) g.add(at(solid(new BoxGeometry(2.6, 0.045, 0.045), M.yellow()), px - 0.85, pyl + y, Z + 1.03));
  for (const x of [xa, xb]) {
    g.add(at(solid(new BoxGeometry(0.1, 0.12, 1.1), M.body2()), x, pyl - 0.08, Z + 0.5));
    g.add(beam(new Vector3(x, pyl - 1.0, 1.95), new Vector3(x, pyl - 0.1, Z + 0.95), 0.07, M.body2()));
  }
  return bake(g);
}

/**
 * Feed hopper over a belt's loading zone: a tapered steel bin (vertical upper section with ribs, a hopper
 * cone, top rim, a grizzly over the ore), an outlet chute down into the conveyor's skirt boards, on a
 * braced four-column frame that straddles the belt. Origin on the floor under the outlet; the belt runs
 * along X with its surface `beltY` above the floor. Baked.
 */
export function feedHopper(beltY = 0.85) {
  const g = new Group();
  const bin = M.bridge();
  const fr = M.body2();
  const y0 = beltY + 0.85; // outlet
  const y1 = y0 + 1.2; // top of the cone
  const y2 = y1 + 0.75; // top of the bin
  const TX = 1.45, TZ = 1.55, BX = 0.42, BZ = 0.36;
  // Cone: four flat trapezoids (non-indexed, so each face shades flat).
  const B = [[-BX, y0, -BZ], [BX, y0, -BZ], [BX, y0, BZ], [-BX, y0, BZ]];
  const T = [[-TX, y1, -TZ], [TX, y1, -TZ], [TX, y1, TZ], [-TX, y1, TZ]];
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    pos.push(...B[i], ...T[j], ...B[j], ...B[i], ...T[i], ...T[j]);
  }
  const cone = new BufferGeometry();
  cone.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  cone.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  cone.computeVertexNormals();
  g.add(solid(cone, bin));
  // Upper section, rim angle, ore and grizzly
  g.add(at(rbox(2 * TX, y2 - y1, 2 * TZ, bin, 0.03), 0, (y1 + y2) / 2, 0));
  for (const s of [-1, 1]) {
    g.add(at(solid(new BoxGeometry(2 * TX + 0.12, 0.12, 0.08), bin), 0, y2 + 0.04, s * (TZ + 0.02)));
    g.add(at(solid(new BoxGeometry(0.08, 0.12, 2 * TZ + 0.12), bin), s * (TX + 0.02), y2 + 0.04, 0));
    // Ring stiffener at the cone top
    g.add(at(solid(new BoxGeometry(2 * TX + 0.1, 0.1, 0.06), fr), 0, y1 + 0.05, s * (TZ + 0.03)));
    g.add(at(solid(new BoxGeometry(0.06, 0.1, 2 * TZ + 0.1), fr), s * (TX + 0.03), y1 + 0.05, 0));
  }
  // Vertical ribs on the upper section, sloped ribs on the cone
  for (const s of [-1, 1]) {
    for (const x of [-0.95, 0, 0.95]) {
      g.add(at(solid(new BoxGeometry(0.06, y2 - y1, 0.05), bin), x, (y1 + y2) / 2, s * (TZ + 0.025)));
      g.add(beam(new Vector3(x * (BX / TX), y0 + 0.05, s * (BZ + 0.03)), new Vector3(x, y1, s * (TZ + 0.03)), 0.05, bin));
    }
    for (const z of [-0.75, 0.75]) {
      g.add(at(solid(new BoxGeometry(0.05, y2 - y1, 0.06), bin), s * (TX + 0.025), (y1 + y2) / 2, z));
      g.add(beam(new Vector3(s * (BX + 0.03), y0 + 0.05, z * (BZ / TZ)), new Vector3(s * (TX + 0.03), y1, z), 0.05, bin));
    }
  }
  const ore = solid(new ConeGeometry(1.25, 0.32, 7, 1), M.aggregate());
  ore.scale.set(1.1, 1, 1.15);
  g.add(at(ore, 0.1, y2 + 0.13, -0.05));
  for (let k = -3; k <= 3; k++) g.add(at(solid(new BoxGeometry(0.06, 0.1, 2 * TZ), M.dark()), k * 0.4, y2 + 0.15, 0));
  for (const z of [-0.8, 0.8]) g.add(at(solid(new BoxGeometry(2 * TX, 0.1, 0.08), M.dark()), 0, y2 + 0.1, z));
  // Outlet chute into the skirt boards
  g.add(at(rbox(2 * BX + 0.04, y0 - beltY - 0.42, 2 * BZ + 0.04, bin, 0.02), 0, (y0 + beltY + 0.42) / 2, 0));
  // Frame: columns, ring beam under the cone top, side X-bracing, knee braces over the belt, base plates
  const CX = 1.3, CZ = 1.55;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(at(sbox(0.18, y1 + 0.1, 0.18, fr, 0.015), sx * CX, (y1 + 0.1) / 2, sz * CZ));
      g.add(at(solid(new BoxGeometry(0.4, 0.025, 0.4), M.galv()), sx * CX, 0.0125, sz * CZ));
    }
    g.add(at(solid(new BoxGeometry(2 * CX + 0.18, 0.16, 0.12), fr), 0, y1 - 0.08, sx * CZ));
    g.add(at(solid(new BoxGeometry(0.12, 0.16, 2 * CZ + 0.18), fr), sx * CX, y1 - 0.08, 0));
    const z = sx * CZ;
    g.add(beam(new Vector3(-CX, 0.25, z), new Vector3(CX, y1 - 0.2, z), 0.07, fr));
    g.add(beam(new Vector3(CX, 0.25, z), new Vector3(-CX, y1 - 0.2, z), 0.07, fr));
    for (const sz of [-1, 1]) g.add(beam(new Vector3(sx * CX, y1 - 0.9, sz * CZ), new Vector3(sx * CX, y1 - 0.15, sz * 0.7), 0.07, fr));
  }
  return bake(g);
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
    [4.22, -0.2, 0.3, M.clad()],
    [4.16, 0.8, 0.24, M.ochre()],
    [6.38, -0.8, 0.3, M.galv()],
    [6.5, 0.6, 0.42, M.clad()],
  ];
  const seam = (r: number) => new CylinderGeometry(r + 0.007, r + 0.007, 0.03, 24, 1, true).rotateZ(Math.PI / 2);
  for (const [y, z, r, mat] of pipes) {
    rack.add(at(solid(new CylinderGeometry(r, r, 22, 24).rotateZ(Math.PI / 2), mat), 0, y, z));
    for (const x of [-7, 0, 7]) flangePair(rack, 'x', x, y, z, r);
    // Insulation jacketing: overlapped seams every metre on the clad lines.
    if (mat === M.clad()) {
      const sg = seam(r);
      for (let x = -10.5; x <= 10.5; x += 1) if (Math.abs(x - 7) > 0.3 && Math.abs(x + 7) > 0.3 && Math.abs(x) > 0.3) rack.add(at(solid(sg, M.galv()), x, y, z));
    }
    // Pipe supports on every rack beam: shoe plate, lateral guides, U-bolt over the top.
    const beamTop = y < 5 ? 3.9 : 6.1;
    const ub = new TorusGeometry(r + 0.016, 0.011, 4, 14, Math.PI).rotateY(Math.PI / 2);
    for (const x of [-9, -3, 3, 9]) {
      rack.add(at(solid(new BoxGeometry(0.32, 0.02, r * 1.3), M.galv()), x, beamTop + 0.01, z));
      for (const s of [-1, 1]) rack.add(at(solid(new BoxGeometry(0.2, y - beamTop, 0.025), M.galv()), x, (y + beamTop) / 2, z + s * (r + 0.03)));
      rack.add(at(solid(ub, M.galv()), x, y, z));
    }
  }
  // Drop to the valve, and the pipe on from the valve down into a floor sleeve
  rack.add(at(solid(new CylinderGeometry(0.24, 0.24, 2.22, 18), M.galv()), 3, 2.79, -1.3));
  rack.add(at(solid(new TorusGeometry(0.36, 0.24, 12, 18, Math.PI / 2).rotateZ(Math.PI / 2), M.galv()), 3.36, 3.9, -1.3));
  rack.add(at(solid(new CylinderGeometry(0.24, 0.24, 0.9, 18), M.galv()), 3, 0.51, -1.3));
  rack.add(at(solid(new CylinderGeometry(0.36, 0.38, 0.12, 20), concreteMat(isDark() ? 0x5a6067 : 0xb9bdc0, 0)), 3, 0.06, -1.3));
  // Vertical tank with ladder rails and stiffening rings
  rack.add(at(solid(new CylinderGeometry(2.2, 2.2, 5, 40), M.clad()), -7, 2.5, -5.2));
  rack.add(at(solid(new SphereGeometry(2.2, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.clad()), -7, 5, -5.2));
  for (let i = 0; i < 4; i++) rack.add(at(solid(new TorusGeometry(2.215, 0.035, 6, 56).rotateX(Math.PI / 2), M.galv()), -7, 0.8 + i * 1.2, -5.2));
  for (const dx of [-0.22, 0.22]) rack.add(at(solid(new BoxGeometry(0.04, 6.4, 0.04), M.yellow()), -7 + dx, 3.2, -2.9));
  // Pump skid (x 4.2…7.8, z 3.3…4.7): concrete plinth, fabricated baseplate, end-suction pump (volute,
  // suction and discharge nozzles with flanges, bearing frame), coupling guard, finned TEFC motor.
  rack.add(at(new Mesh(new BoxGeometry(3.6, 0.12, 1.4), concreteMat(isDark() ? 0x565c63 : 0xbabdc0, 0)), 6, 0.06, 4));
  rack.add(at(sbox(3.4, 0.16, 1.1, M.body2(), 0.02), 6, 0.2, 4));
  for (const x of [4.45, 7.55]) for (const z of [3.55, 4.45]) rack.add(at(hexBolt(0.025, 0.05, 'y'), x, 0.3, z));
  // Volute: casing disc, a scroll bulge toward the discharge, cover bolts
  rack.add(at(cyl(0.42, 0.3, slate(), 'x', 32), 4.78, 0.8, 4));
  rack.add(at(cyl(0.3, 0.32, slate(), 'x', 24), 4.78, 0.95, 4.16));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    rack.add(at(hexBolt(0.02, 0.36, 'x'), 4.78, 0.8 + Math.sin(a) * 0.38, 4 + Math.cos(a) * 0.38));
  }
  rack.add(at(cyl(0.15, 0.26, slate(), 'x', 20), 4.5, 0.8, 4)); // suction nozzle
  flangePair(rack, 'x', 4.32, 0.8, 4, 0.15, slate());
  rack.add(at(cyl(0.12, 0.36, slate(), 'y', 18), 4.78, 1.32, 4.26)); // discharge nozzle
  flangePair(rack, 'y', 4.78, 1.52, 4.26, 0.12, slate());
  rack.add(at(cyl(0.12, 0.34, M.galv(), 'y', 18), 4.78, 1.75, 4.26)); // discharge spool
  rack.add(at(sbox(0.44, 0.24, 0.5, slate()), 4.78, 0.38, 4)); // casing foot
  rack.add(at(sbox(0.55, 0.34, 0.32, slate(), 0.03), 5.24, 0.74, 4)); // bearing frame
  rack.add(at(sbox(0.4, 0.3, 0.42, slate()), 5.24, 0.43, 4));
  rack.add(at(rbox(0.6, 0.4, 0.4, M.yellow(), 0.1), 5.82, 0.8, 4)); // coupling guard
  // Motor: body, radial cooling fins, fan cowl, terminal box, feet (centre (6.85, 0.8, 4))
  rack.add(at(cyl(0.4, 1.24, motorPaint(), 'x', 28), 6.85, 0.8, 4));
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    if (Math.sin(a) < -0.55) continue;
    const fin = at(solid(new BoxGeometry(1.1, 0.08, 0.02), motorPaint()), 6.85, 0.8 + Math.sin(a) * 0.43, 4 + Math.cos(a) * 0.43);
    fin.rotation.x = Math.PI / 2 - a;
    rack.add(fin);
  }
  rack.add(at(cyl(0.44, 0.26, M.dark(), 'x', 28), 7.6, 0.8, 4));
  rack.add(at(sbox(0.34, 0.24, 0.32, motorPaint(), 0.02), 6.7, 1.32, 4));
  for (const x of [6.4, 7.3]) rack.add(at(sbox(0.16, 0.12, 0.9, motorPaint()), x, 0.34, 4));
  // Gate valve on the drop: cast body, flanged both ends, horizontal bonnet and stem toward the walkway
  rack.add(at(rbox(0.5, 0.5, 0.5, M.body2(), 0.06), 3, 1.32, -1.3));
  flangePair(rack, 'y', 3, 1.62, -1.3, 0.24, M.body2());
  flangePair(rack, 'y', 3, 1.02, -1.3, 0.24, M.body2());
  rack.add(at(cyl(0.17, 0.22, M.body2(), 'z', 20), 3, 1.32, -0.95));
  flangePair(rack, 'z', 3, 1.32, -0.82, 0.12, M.body2());
  for (const s of [-1, 1]) rack.add(at(solid(new BoxGeometry(0.05, 0.05, 0.3), M.body2()), 3 + s * 0.11, 1.32, -0.6));
  rack.add(at(cyl(0.03, 0.62, M.steel(), 'z', 10), 3, 1.32, -0.55));
  // Handwheel: rim, four spokes, hub
  rack.add(at(solid(new TorusGeometry(0.3, 0.028, 8, 32), M.red()), 3, 1.32, -0.36));
  for (let k = 0; k < 2; k++) {
    const sp = at(solid(new BoxGeometry(0.58, 0.035, 0.03), M.red()), 3, 1.32, -0.36);
    sp.rotation.z = (k * Math.PI) / 2 + 0.3;
    rack.add(sp);
  }
  rack.add(at(cyl(0.06, 0.08, M.red(), 'z', 14), 3, 1.32, -0.36));
  g.add(bake(rack));
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
    const b = at(solid(new BoxGeometry(2.4, 0.5, 160), paint(isDark() ? 0x5e5d58 : 0x9b9890, 0.95)), s * 9.1, 0.12, 0);
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
    const wedge = solid(geo, concreteMat(isDark() ? 0x5c6166 : 0xbdbebc, 3));
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

/**
 * Machine guarding along straight runs [x0, z0, x1, z1]: 60 mm yellow posts on base plates every ≤ 1.4 m,
 * framed 50 mm welded-mesh panels (one merged, see-through mesh) with a kick strip. `height` to the top rail.
 */
export function meshGuarding(runs: [number, number, number, number][], height = 2.0) {
  const g = new Group();
  const fixed = new Group();
  const panels: BufferGeometry[] = [];
  for (const [x0, z0, x1, z1] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / 1.4));
    const yaw = -Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
      fixed.add(at(sbox(0.06, height + 0.05, 0.06, M.yellow(), 0.008), x, (height + 0.05) / 2, z));
      fixed.add(at(solid(new BoxGeometry(0.14, 0.012, 0.14), M.yellow()), x, 0.006, z));
    }
    const seg = len / n;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
      const pw = seg - 0.1, ph = height - 0.32;
      for (const y of [0.18, 0.18 + ph]) {
        const rail = at(solid(new BoxGeometry(pw, 0.03, 0.025), M.dark()), x, y, z);
        rail.rotation.y = yaw;
        fixed.add(rail);
      }
      for (const s of [-1, 1]) {
        const st = at(solid(new BoxGeometry(0.025, ph, 0.025), M.dark()), x + Math.cos(yaw) * s * (pw / 2), 0.18 + ph / 2, z - Math.sin(yaw) * s * (pw / 2));
        fixed.add(st);
      }
      const p = new PlaneGeometry(pw, ph);
      const uv = p.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (pw / 0.05), uv.getY(k) * (ph / 0.05));
      p.rotateY(yaw);
      p.translate(x, 0.18 + ph / 2, z);
      panels.push(p);
    }
  }
  bake(fixed);
  g.add(fixed);
  const mesh = new Mesh(mergeGeometries(panels, false)!, guardMesh());
  mesh.renderOrder = 1;
  g.add(mesh);
  return g;
}

// ============================================================== yard details
/** Pale concrete site road with low kerbs, along X. */
export function siteRoad(x0: number, x1: number, width = 7) {
  const g = new Group();
  const len = x1 - x0;
  // Pale concrete pavement, one step darker than the yard, with kerbs and no centre dashes: a dark
  // asphalt band with white dashes was the strongest line in the wide shots and led the eye off the stations.
  const road = at(new Mesh(new BoxGeometry(len, 0.03, width), concreteMat(isDark() ? 0x50565d : 0xc4c9ce, 0)), (x0 + x1) / 2, 0.015, 0);
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

// ============================================================== app monitors
type ScreenEntry = { jpg: [number, string][] };
const SCREENS = screens as unknown as Record<string, ScreenEntry | undefined>;
const screenMats = new Map<string, MeshBasicMaterial>();

/**
 * A real app screenshot (public/media/app, 960 px JPG) as an unlit screen material, shared per screen.
 * Dark navy (a panel that is on but still drawing) until the image arrives; a failed fetch keeps it so.
 */
function screenMaterial(id: string) {
  const hit = screenMats.get(id);
  if (hit) return hit;
  const mat = new MeshBasicMaterial({ color: 0x0b1424 });
  screenMats.set(id, mat);
  const jpg = SCREENS[id]?.jpg ?? [];
  const url = (jpg.find(([w]) => w === 960) ?? jpg[jpg.length - 1])?.[1];
  if (url) {
    try {
      new TextureLoader().load(
        url,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          tex.anisotropy = 8;
          tex.generateMipmaps = true;
          tex.minFilter = LinearMipmapLinearFilter;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        },
        undefined,
        () => {
          /* keep the dark screen */
        },
      );
    } catch {
      /* keep the dark screen */
    }
  }
  return mat;
}

export interface MonitorOptions {
  /** 'pole' floor pedestal (default), 'arm' VESA arm off a post or wall (origin at the wall plate), 'desk' desk foot (origin on the desk top). */
  mount?: 'pole' | 'arm' | 'desk';
  /** Visible screen width in metres (default 0.7, a 32" panel). The screen is 16:10. */
  width?: number;
  /** Screen centre above the origin (default: pole 1.5 m, desk 0.36 m, arm 0). */
  height?: number;
  /** Backward tilt in radians, so a screen seen from above faces the viewer. */
  tilt?: number;
  /** Pole only: a sloped keyboard shelf in front (an operator console). */
  shelf?: boolean;
}

/**
 * Industrial display showing a real Infraglance desktop app screen (`screenId` from app-screens.json):
 * thin dark bezel with a slightly deeper chin and a power LED, rounded rear housing and VESA plate, on a
 * floor pedestal, a VESA arm or a desk foot. The screen faces +Z. `top` is the top centre of the screen
 * (for labels.avoid), `centre` its middle. Static parts are baked; the screen is one extra draw call.
 */
export function appMonitor(screenId: string, o: MonitorOptions = {}) {
  const mount = o.mount ?? 'pole';
  const w = o.width ?? 0.7;
  const h = w * 0.625;
  const cy = o.height ?? (mount === 'pole' ? 1.5 : mount === 'desk' ? 0.36 : 0);
  const b = Math.max(0.012, w * 0.016); // bezel
  const chin = b * 0.9;
  const D = Math.max(0.035, w * 0.04);
  const g = new Group();
  const fixed = new Group();
  const head = new Group();
  head.position.set(0, cy, mount === 'arm' ? 0.42 : 0);
  head.rotation.x = -(o.tilt ?? 0);
  head.add(at(rbox(w + 2 * b, h + 2 * b + chin, D, M.dark(), Math.min(0.012, b * 0.8)), 0, -chin / 2, 0));
  head.add(at(rbox(w * 0.66, h * 0.66, D * 0.9, M.dark(), 0.03), 0, -h * 0.04, -D * 0.75));
  head.add(at(solid(new BoxGeometry(0.16, 0.16, 0.03), M.galv()), 0, 0, -D * 1.3));
  head.add(at(new Mesh(new BoxGeometry(Math.max(0.006, w * 0.008), 0.004, 0.004), M.greenLed()), w / 2 - 0.02, -h / 2 - b - chin / 2, D / 2 + 0.001));
  fixed.add(head);
  const back = -D * 1.3 - 0.03; // the stand sits behind the VESA plate
  if (mount === 'pole') {
    const bw = 0.35 + w * 0.3;
    fixed.add(at(sbox(bw, 0.035, bw * 0.72, M.body2(), 0.01), 0, 0.0175, back));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) fixed.add(at(hexBolt(0.018, 0.03, 'y'), sx * (bw / 2 - 0.05), 0.045, back + sz * (bw * 0.36 - 0.05)));
    fixed.add(at(sbox(0.09, cy - 0.1, 0.09, M.body2(), 0.01), 0, (cy - 0.1) / 2 + 0.03, back - 0.02));
    fixed.add(at(sbox(0.14, 0.18, 0.08, M.body2(), 0.01), 0, cy, back + 0.01));
    fixed.add(at(cyl(0.011, cy - 0.2, M.rubber(), 'y', 6), 0.055, cy / 2, back - 0.04)); // cable down the column
    if (o.shelf) {
      const sy = Math.min(1.02, cy - h / 2 - 0.1);
      const sh = at(sbox(Math.min(0.75, w * 0.6), 0.025, 0.32, M.body2(), 0.008), 0, sy, 0.24);
      sh.rotation.x = 0.22;
      fixed.add(sh);
      const kb = at(sbox(0.44, 0.02, 0.15, M.dark(), 0.006), -0.04, sy + 0.022, 0.25);
      kb.rotation.x = 0.22;
      fixed.add(kb, at(solid(new BoxGeometry(0.05, 0.05, 0.42), M.body2()), 0, sy - 0.05, back + 0.2));
    }
  } else if (mount === 'desk') {
    const foot = at(cyl(0.13, 0.02, M.dark(), 'y', 24), 0, 0.01, back);
    foot.scale.set(1.3, 1, 0.9);
    fixed.add(foot, at(sbox(0.06, cy, 0.04, M.dark(), 0.01), 0, cy / 2, back));
  } else {
    fixed.add(at(sbox(0.12, 0.2, 0.02, M.galv(), 0.006), 0, cy, 0.01));
    fixed.add(at(sbox(0.05, 0.05, 0.36, M.galv(), 0.01), 0, cy, 0.2), at(cyl(0.035, 0.08, M.galv(), 'y', 12), 0, cy, 0.38));
  }
  bake(fixed);
  const screen = new Mesh(new PlaneGeometry(w, h), screenMaterial(screenId));
  screen.position.z = D / 2 + 0.0015;
  head.add(screen);
  const top = at(new Object3D(), 0, h / 2 + b, D / 2);
  const centre = at(new Object3D(), 0, 0, D / 2);
  head.add(top, centre);
  g.add(fixed);
  return Object.assign(g, { screen, top, centre, screenHeight: h + 2 * b });
}

/** A floor slab for a station (receives shadows only). */
export const pad = (w: number, d: number) => slab(w, 0.12, d, M.concrete());

// ============================================================== building
let claddingTex: CanvasTexture | null = null;
let shutterTex: CanvasTexture | null = null;
/** Trapezoidal profiled sheet, one 1 m tile with four ribs (crest lit, web in shade, flat pan). */
function claddingTexture() {
  if (claddingTex) return claddingTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 8;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    const x = i * 64;
    g.fillStyle = '#7d858d'; // pan
    g.fillRect(x, 0, 64, 8);
    g.fillStyle = '#5a6168'; // shaded web
    g.fillRect(x + 36, 0, 6, 8);
    g.fillStyle = '#9aa2aa'; // crest
    g.fillRect(x + 42, 0, 14, 8);
    g.fillStyle = '#878f97'; // lit web
    g.fillRect(x + 56, 0, 5, 8);
  }
  claddingTex = new CanvasTexture(c);
  claddingTex.colorSpace = SRGBColorSpace;
  claddingTex.wrapS = claddingTex.wrapT = RepeatWrapping;
  claddingTex.anisotropy = 8;
  return claddingTex;
}
/** Horizontal slats of a roller shutter (one 1 m tile, ten slats). */
function shutterTexture() {
  if (shutterTex) return shutterTex;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 160;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 10; i++) {
    g.fillStyle = '#a3abb3';
    g.fillRect(0, i * 16, 8, 16);
    g.fillStyle = '#6c747c';
    g.fillRect(0, i * 16 + 13, 8, 3);
  }
  shutterTex = new CanvasTexture(c);
  shutterTex.colorSpace = SRGBColorSpace;
  shutterTex.wrapS = shutterTex.wrapT = RepeatWrapping;
  return shutterTex;
}

/**
 * Yard floodlight mast (galvanised pole, head frame with `heads` LED floods aimed down toward +Z).
 * The lit faces stay under the bloom threshold: they read as lamps, not as glowing toys.
 */
export function floodMast(height = 12, heads = 3) {
  const g = new Group();
  const fixed = new Group();
  fixed.add(at(solid(new CylinderGeometry(0.11, 0.2, height, 14), M.galv()), 0, height / 2, 0));
  fixed.add(at(solid(new CylinderGeometry(0.42, 0.42, 0.35, 16), concreteMat(0x6b7178, 0)), 0, 0.17, 0));
  fixed.add(at(solid(new BoxGeometry(heads * 0.7 + 0.3, 0.08, 0.08), M.galv()), 0, height - 0.1, 0.12));
  fixed.add(at(solid(new BoxGeometry(0.08, 0.6, 0.08), M.galv()), 0, height - 0.35, 0.06));
  const lamp = led(0xfff4e0, 2.3);
  for (let i = 0; i < heads; i++) {
    const x = (i - (heads - 1) / 2) * 0.7;
    const h = at(rbox(0.56, 0.12, 0.46, M.dark(), 0.02), x, height - 0.26, 0.38);
    h.rotation.x = 0.5;
    fixed.add(h);
    const face = at(new Mesh(new PlaneGeometry(0.48, 0.38), lamp), x, height - 0.33, 0.39);
    face.rotation.x = Math.PI / 2 + 0.5;
    face.position.y -= 0.035;
    g.add(face);
  }
  bake(fixed);
  g.add(fixed);
  return g;
}

/** Background storage tanks (aluminium-clad, ring stiffeners, a stair stringer): context, far from the action. */
export function tankFarm(tanks: [number, number, number, number][]) {
  const g = new Group();
  for (const [x, z, r, h] of tanks) {
    g.add(at(solid(new CylinderGeometry(r, r, h, 48), M.clad()), x, h / 2, z));
    g.add(at(solid(new CylinderGeometry(r * 1.002, r * 0.86, r * 0.18, 48), M.clad()), x, h + r * 0.09, z));
    for (let y = 2; y < h; y += 2.4) g.add(at(solid(new TorusGeometry(r + 0.02, 0.04, 6, 64).rotateX(Math.PI / 2), M.galv()), x, y, z));
    g.add(at(solid(new BoxGeometry(0.08, h, 0.08), M.galv()), x + r * 0.71, h / 2, z + r * 0.71));
    g.add(at(new Mesh(new BoxGeometry(r * 2.4, 0.5, r * 2.4), concreteMat(0x5d636a, 0)), x, 0.25, z));
  }
  return bake(g);
}

/**
 * Back wall of a production hall, facing +Z, centred on x = 0 at z = 0: profiled steel cladding over
 * a concrete upstand, painted portal columns every `bay` metres with an eaves beam, wall-pack LED lights,
 * a roller shutter with bollards (at `door` x, or none) and a green exit sign. Gives an indoor scene a
 * building around it, so machines stand in a plant rather than on a slab in a void.
 */
export function hallBackdrop(width = 64, height = 9.5, bay = 6, door: number | null = 9) {
  const g = new Group();
  const fixed = new Group();
  const tex = claddingTexture().clone();
  tex.repeat.set(width, 1);
  tex.needsUpdate = true;
  const sheet = new MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2.5, color: 0x8a939c, roughness: 0.55, metalness: 0.35 });
  const wall = new Mesh(new PlaneGeometry(width, height - 1.2), sheet);
  wall.position.set(0, 1.2 + (height - 1.2) / 2, 0);
  wall.receiveShadow = true;
  g.add(wall);
  fixed.add(at(new Mesh(new BoxGeometry(width, 1.2, 0.3), concreteMat(0x6b7178, 0)), 0, 0.6, 0.15));
  const colMat = M.bridge();
  const nCols = Math.floor(width / bay / 2);
  for (let i = -nCols; i <= nCols; i++) {
    const x = i * bay;
    // Universal column: flanges and web.
    fixed.add(at(new Mesh(new BoxGeometry(0.4, height + 0.4, 0.04), colMat), x, (height + 0.4) / 2, 0.36));
    fixed.add(at(new Mesh(new BoxGeometry(0.4, height + 0.4, 0.04), colMat), x, (height + 0.4) / 2, 0.04));
    fixed.add(at(new Mesh(new BoxGeometry(0.03, height + 0.4, 0.3), colMat), x, (height + 0.4) / 2, 0.2));
    fixed.add(at(new Mesh(new BoxGeometry(0.6, 0.04, 0.6), M.galv()), x, 0.02, 0.2));
  }
  fixed.add(at(new Mesh(new BoxGeometry(width, 0.55, 0.36), colMat), 0, height + 0.2, 0.2));
  // Cable tray along the wall at 4.2 m.
  fixed.add(at(new Mesh(new BoxGeometry(width, 0.08, 0.4), M.galv()), 0, 4.2, 0.5));
  for (let x = -width / 2 + 1.5; x < width / 2; x += 3) fixed.add(at(new Mesh(new BoxGeometry(0.04, 0.3, 0.5), M.galv()), x, 4.35, 0.42));
  if (door !== null) {
    const st = shutterTexture().clone();
    st.repeat.set(1, 5);
    st.needsUpdate = true;
    const shutter = new Mesh(new PlaneGeometry(4.6, 5), new MeshStandardMaterial({ map: st, roughness: 0.5, metalness: 0.4 }));
    shutter.position.set(door, 2.5, 0.05);
    shutter.receiveShadow = true;
    g.add(shutter);
    fixed.add(at(new Mesh(new BoxGeometry(5.2, 0.6, 0.5), M.body2()), door, 5.3, 0.25));
    for (const s of [-1, 1]) {
      fixed.add(at(new Mesh(new BoxGeometry(0.14, 5, 0.18), M.yellow()), door + s * 2.38, 2.5, 0.1));
      // Bollards either side of the opening.
      fixed.add(at(new Mesh(new CylinderGeometry(0.11, 0.11, 1.1, 16), M.yellow()), door + s * 2.9, 0.55, 1.1));
    }
    const sign = new Mesh(new BoxGeometry(0.5, 0.2, 0.05), led(0x16a34a, 1.4));
    sign.position.set(door - 4.5, 2.7, 0.08);
    g.add(sign);
  }
  bake(fixed);
  g.add(fixed);
  // Wall-pack LEDs on every other column: lit faces, below the bloom threshold.
  const lamp = led(0xfff3df, 2.2);
  for (let i = -nCols; i <= nCols; i += 2) {
    const housing = at(rbox(0.5, 0.18, 0.34, M.dark(), 0.03), i * bay, 7.2, 0.58);
    housing.rotation.x = 0.35;
    const face = at(new Mesh(new PlaneGeometry(0.42, 0.26), lamp), i * bay, 7.12, 0.62);
    face.rotation.x = Math.PI / 2 + 0.35;
    g.add(housing, face);
  }
  return g;
}


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
