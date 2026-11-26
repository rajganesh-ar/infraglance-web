/**
 * Industrial machines for the camera-view scenes, modelled as real equipment rather than primitives:
 * a counterbalance LPG forklift, a four-column hydraulic press and a six-axis robot.
 *
 * Drop-in replacements for kit.forklift(), props.hydraulicPress() and props.robotArm(): same return
 * shape, footprint, origin and joint pivots. Metres, Y up, origin at floor level. Painted parts are
 * dielectric, bare metal is metalness 1 (as kit.ts). Every static part is baked to one mesh per
 * material; the moving parts (beacon, ram, robot joints) stay separate objects.
 */
import {
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, bake, blobShadow, led, paint, solid } from '../core/kit';

// ---------------------------------------------------------------- materials
let forkPaintMat: MeshStandardMaterial | null = null;
/** Muted industrial yellow (weathered RAL 1007-ish), not toy yellow. */
const forkPaint = () => (forkPaintMat ??= paint(0xc99a1e, 0.55));

let meshTexInst: CanvasTexture | null = null;
/** 16 px welded-mesh cell (alpha only); mipmaps average it to a ~35% tint at distance. */
function meshTex() {
  if (meshTexInst) return meshTexInst;
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
  return (meshTexInst = t);
}
let wireMeshMat: MeshStandardMaterial | null = null;
/** See-through dark grey guard mesh. */
const wireMesh = () =>
  (wireMeshMat ??= new MeshStandardMaterial({ color: 0x2a2f34, map: meshTex(), roughness: 0.6, metalness: 0, transparent: true, depthWrite: false, side: DoubleSide }));

// ---------------------------------------------------------------- helpers
const UP = new Vector3(0, 1, 0);
const _dir = new Vector3();
type Axis = 'x' | 'y' | 'z';
type P3 = [number, number, number];

const at = <T extends Object3D>(o: T, x: number, y: number, z: number) => (o.position.set(x, y, z), o);
const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Rounded box. One bevel segment (a soft chamfer) by default; 2 on big faces seen close up. */
function rb(w: number, h: number, d: number, mat: Material, r = 0.02, seg = 1) {
  return solid(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.45)), mat);
}

/** Cylinder along an axis; `rTop` is the radius at the + end. */
function cylGeo(r: number, len: number, axis: Axis = 'y', seg = 16, rTop = r, open = false): BufferGeometry {
  const g = new CylinderGeometry(rTop, r, len, seg, 1, open);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}
const cyl = (r: number, len: number, mat: Material, axis: Axis = 'y', seg = 16, rTop = r) => solid(cylGeo(r, len, axis, seg, rTop), mat);
/** Hex nut / bolt head with crisp flats. */
const hexGeo = (r: number, h: number, axis: Axis = 'y') => toCreasedNormals(cylGeo(r, h, axis, 6), 0.5);

/** Lathe from [radius, y] pairs, with creased normals so turned shoulders stay crisp. */
function lathe(pts: [number, number][], seg = 24, crease = 0.6) {
  return toCreasedNormals(new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), seg), crease);
}

/** Round member from a to b. */
function rod(a: Vector3, b: Vector3, r: number, mat: Material, seg = 10) {
  _dir.subVectors(b, a);
  const m = solid(new CylinderGeometry(r, r, _dir.length(), seg), mat);
  m.position.copy(a).addScaledVector(_dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, _dir.normalize());
  return m;
}
/** Rounded rectangular member from a to b (w across X while the run stays in a YZ plane). */
function strut(a: Vector3, b: Vector3, w: number, d: number, mat: Material, r = 0.012) {
  _dir.subVectors(b, a);
  const m = rb(w, _dir.length(), d, mat, r);
  m.position.copy(a).addScaledVector(_dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, _dir.normalize());
  return m;
}
/** Rigid pipe through points, with a fitting at every bend. */
function pipe(parent: Object3D, pts: P3[], r: number, mat: Material, fitting = 1.35) {
  const v = pts.map(([x, y, z]) => new Vector3(x, y, z));
  const ball = new SphereGeometry(r * fitting, 8, 5);
  for (let i = 0; i < v.length - 1; i++) parent.add(rod(v[i], v[i + 1], r, mat));
  for (let i = 1; i < v.length - 1; i++) parent.add(at(solid(ball, mat), v[i].x, v[i].y, v[i].z));
}
/** Flexible hose through points. */
function hose(pts: P3[], r: number, mat: Material, segs = 20) {
  return solid(new TubeGeometry(new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z))), segs, r, 7), mat);
}

/**
 * Crease angle for extrusions (~14°). Below the first bevel step (15° with 3 segments, 22.5° with 2), so the
 * flat caps keep flat normals (cap triangles only have outline vertices; smoothing them into the bevel shades
 * the whole cap in streaks), while curved outlines (≤ ~10° per step) stay smooth.
 */
const EXTRUDE_CREASE = 0.24;
const extrudeOpts = (depth: number, bevel: number, segs: number, curve: number) => ({
  depth,
  bevelEnabled: bevel > 0,
  bevelThickness: bevel,
  bevelSize: bevel,
  bevelSegments: segs,
  curveSegments: curve,
});
/**
 * Side profile (shape x = world z, shape y = world y) extruded across world X and centred, so `width` is
 * the total. The bevel rounds every outline edge and grows the outline by `bevel`.
 */
function sideExtrude(shape: Shape, width: number, bevel: number, segs = 2, curve = 10) {
  const d = width - 2 * bevel;
  const g = new ExtrudeGeometry(shape, extrudeOpts(d, bevel, segs, curve));
  g.rotateY(-Math.PI / 2);
  g.translate(d / 2, 0, 0);
  return toCreasedNormals(g, EXTRUDE_CREASE);
}
/** Front profile (shape x, y = world x, y) extruded along world Z and centred (`depth` is the total). */
function frontExtrude(shape: Shape, depth: number, bevel: number, segs = 2, curve = 12) {
  const d = depth - 2 * bevel;
  const g = new ExtrudeGeometry(shape, extrudeOpts(d, bevel, segs, curve));
  g.translate(0, 0, -d / 2);
  return toCreasedNormals(g, EXTRUDE_CREASE);
}
/** Plan profile (shape x = world x, shape y = world −z) extruded up world Y from y0 (`height` is the total). */
function planExtrude(shape: Shape, height: number, y0: number, bevel: number) {
  const d = height - 2 * bevel;
  const g = new ExtrudeGeometry(shape, extrudeOpts(d, bevel, 1, 6));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  return toCreasedNormals(g, EXTRUDE_CREASE);
}
/** Annulus sector in a profile plane (fenders). */
function arcShape(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const s = new Shape();
  s.absarc(cx, cy, r1, a0, a1, false);
  s.absarc(cx, cy, r0, a1, a0, true);
  return s;
}
/** Outline from points (implicitly closed). */
function poly(pts: [number, number][]) {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  return s;
}

// ============================================================== forklift
/** Solid tyre turned about X: flat sidewalls, rounded shoulders. */
function tyreGeo(R: number, rIn: number, hw: number) {
  const pts: [number, number][] = [
    [rIn, -hw],
    [R - 0.035, -hw],
    [R - 0.01, -hw * 0.88],
    [R, -hw * 0.6],
    [R, hw * 0.6],
    [R - 0.01, hw * 0.88],
    [R - 0.035, hw],
    [rIn, hw],
  ];
  return lathe(pts, 28, 0.7).rotateZ(-Math.PI / 2);
}
/** Pressed-steel wheel: dished disc and hub on both faces (the barrel hides inside the tyre). */
function rimGeo(rr: number, hw: number) {
  const f = hw * 0.82;
  const half: [number, number][] = [
    [0.001, -f],
    [rr * 0.42, -f],
    [rr * 0.48, -f * 0.62],
    [rr * 0.86, -f * 0.72],
    [rr * 0.94, -f * 0.95],
    [rr + 0.006, -hw],
  ];
  const pts = [...half, ...half.map(([r, y]) => [r, -y] as [number, number]).reverse()];
  return lathe(pts, 20, 0.5).rotateZ(-Math.PI / 2);
}

/** Mast channel in plan, extruded up Y. Outer channels open inward (web outside), inner ones open outward. */
function channelGeo(sign: number, x0: number, x1: number, zh: number, tw: number, tf: number, y0: number, y1: number, webOut: boolean) {
  const pts: [number, number][] = webOut
    ? [[x1, -zh], [x1, zh], [x0, zh], [x0, zh - tf], [x1 - tw, zh - tf], [x1 - tw, -zh + tf], [x0, -zh + tf], [x0, -zh]]
    : [[x0, -zh], [x1, -zh], [x1, -zh + tf], [x0 + tw, -zh + tf], [x0 + tw, zh - tf], [x1, zh - tf], [x1, zh], [x0, zh]];
  return planExtrude(poly(pts.map(([x, z]) => [x * sign, -z])), y1 - y0, y0, 0.006);
}

/**
 * Counterbalance LPG forklift (~1.1 × 2.3 m body, overhead guard 2.18 m, forks to z 2.26), origin at the
 * floor centre, forks toward +Z. Static parts baked to seven draw calls; `beacon` is the amber roof lamp
 * (the scene blinks it via `.visible`; an unlit lens stays under it).
 */
export function forklift() {
  const g = new Group();
  const body = new Group();
  const Y = forkPaint();
  const D = M.dark();
  const S = M.steel();
  const R = M.rubber();
  const headLamp = led(0xfff1dc, 1.1);
  const tailLamp = led(0xe0342c, 1.0);
  const amberDim = led(0xf59e0b, 0.18);

  // ---- chassis: one side profile with both wheel arches, the operator deck, the dash cowl and the hood
  const p = new Shape();
  p.moveTo(0.88, 0.3);
  p.lineTo(0.88, 0.62);
  p.quadraticCurveTo(0.88, 0.7, 0.82, 0.74);
  p.lineTo(0.7, 1.03);
  p.quadraticCurveTo(0.67, 1.09, 0.61, 1.09);
  p.lineTo(0.57, 1.09);
  p.quadraticCurveTo(0.52, 1.09, 0.51, 1.04);
  p.lineTo(0.46, 0.78);
  p.quadraticCurveTo(0.45, 0.72, 0.4, 0.72);
  p.lineTo(-0.02, 0.72);
  p.quadraticCurveTo(-0.06, 0.72, -0.07, 0.76);
  p.lineTo(-0.1, 0.92);
  p.quadraticCurveTo(-0.12, 0.97, -0.18, 0.97);
  p.lineTo(-0.64, 0.97);
  p.absarc(-0.7, 0.2, 0.27, Math.acos(0.06 / 0.27), 0, true); // rear arch (front part)
  p.lineTo(-0.4, 0.14);
  p.lineTo(0.2, 0.14);
  p.absarc(0.56, 0.27, 0.32, Math.PI, 0, true); // front arch
  body.add(solid(sideExtrude(p, 1.05, 0.025, 2), Y));

  // ---- counterweight: separate casting, heavily radiused, with a sculpted rear and the rear arch
  const c = new Shape();
  c.moveTo(-0.62, 0.98);
  c.quadraticCurveTo(-0.62, 1.0, -0.66, 1.0);
  c.lineTo(-0.92, 1.0);
  c.quadraticCurveTo(-1.05, 1.0, -1.07, 0.86);
  c.quadraticCurveTo(-1.1, 0.55, -1.07, 0.28);
  c.quadraticCurveTo(-1.06, 0.22, -1.03, 0.22);
  c.absarc(-0.7, 0.2, 0.3, Math.PI, Math.acos(0.08 / 0.3), true);
  body.add(solid(sideExtrude(c, 1.08, 0.06, 3), Y));
  body.add(at(rb(0.2, 0.1, 0.05, D, 0.015), 0, 0.36, -1.13)); // tow-pin pocket

  // ---- running gear: solid tyres on pressed rims, drive axle with differential, steer axle
  const tyreF = tyreGeo(0.27, 0.175, 0.1);
  const rimF = rimGeo(0.175, 0.1);
  const tyreR = tyreGeo(0.21, 0.13, 0.085);
  const rimR = rimGeo(0.13, 0.085);
  const lug = hexGeo(0.011, 0.02, 'x');
  for (const s of [-1, 1]) {
    for (const [x, y, z, tyre, rim, hw, lr] of [
      [0.455, 0.27, 0.56, tyreF, rimF, 0.1, 0.05],
      [0.435, 0.21, -0.7, tyreR, rimR, 0.085, 0.037],
    ] as const) {
      body.add(at(solid(tyre, R), s * x, y, z));
      body.add(at(solid(rim, S), s * x, y, z));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        body.add(at(solid(lug, S), s * (x + hw * 0.82 + 0.006), y + Math.sin(a) * lr, z + Math.cos(a) * lr));
      }
    }
    // Mudguard flares over both arches
    body.add(at(solid(sideExtrude(arcShape(0.56, 0.27, 0.305, 0.35, 0.3, Math.PI - 0.3), 0.07, 0.01, 1), D), s * 0.535, 0, 0));
    body.add(at(solid(sideExtrude(arcShape(-0.7, 0.2, 0.25, 0.29, 0.15, Math.PI - 0.15), 0.05, 0.008, 1), D), s * 0.552, 0, 0));
    // Operator step with a rubber tread
    body.add(at(rb(0.05, 0.03, 0.3, R, 0.008), s * 0.545, 0.42, 0.06));
  }
  body.add(at(cyl(0.085, 0.72, D, 'x', 16), 0, 0.27, 0.56));
  const diff = solid(new SphereGeometry(0.15, 14, 10), D);
  diff.scale.set(0.9, 0.85, 1);
  body.add(at(diff, 0, 0.27, 0.56));
  body.add(at(rb(0.7, 0.09, 0.14, D, 0.02), 0, 0.21, -0.7));

  // ---- two-stage mast: nested outer and inner channels, ties, central lift cylinder, chains and sheaves
  const ZM = 1.06;
  for (const s of [-1, 1]) {
    body.add(at(solid(channelGeo(s, 0.29, 0.4, 0.07, 0.03, 0.024, 0.1, 2.18, true), D), 0, 0, ZM));
    body.add(at(solid(channelGeo(s, 0.235, 0.355, 0.042, 0.025, 0.02, 0.14, 2.24, false), D), 0, 0, ZM));
    body.add(at(rb(0.07, 0.1, 0.42, D, 0.015), s * 0.31, 0.27, 0.8)); // mast pivot bracket on the drive axle
    // Tilt cylinder: frame pin under the cowl to a clevis on the outer channel
    const a = v3(s * 0.44, 0.58, 0.85);
    const b = v3(s * 0.44, 0.92, 1.02);
    const mid = a.clone().lerp(b, 0.62);
    body.add(rod(a, mid, 0.04, D, 14), rod(mid, b, 0.019, S, 10));
    body.add(at(rb(0.06, 0.08, 0.08, D, 0.012), s * 0.43, 0.92, 1.02));
    // Lift chain (two link plates) over a sheave on the inner crosshead
    for (const o of [-0.011, 0.011]) body.add(at(rb(0.006, 1.59, 0.022, S, 0.002), s * 0.1 + o, 1.455, 1.135));
    body.add(at(cyl(0.055, 0.04, S, 'x', 16), s * 0.1, 2.25, 1.08));
  }
  body.add(at(rb(0.74, 0.08, 0.05, D, 0.012), 0, 2.13, 0.955)); // outer top tie
  body.add(at(rb(0.74, 0.1, 0.05, D, 0.012), 0, 0.62, 0.955)); // outer lower tie
  body.add(at(rb(0.5, 0.07, 0.07, D, 0.012), 0, 2.205, ZM)); // inner crosshead
  body.add(at(rb(0.14, 0.06, 0.1, D, 0.012), 0, 0.16, 1.02)); // lift cylinder foot
  body.add(at(cyl(0.05, 1.35, D, 'y', 16), 0, 0.85, 1.03));
  body.add(at(cyl(0.028, 0.66, S, 'y', 12), 0, 1.855, 1.03));

  // ---- fork carriage with load backrest grille, and two L-forks with tapered blades
  body.add(at(rb(0.98, 0.12, 0.06, D, 0.015), 0, 0.62, 1.18));
  body.add(at(rb(0.98, 0.09, 0.06, D, 0.015), 0, 0.27, 1.18));
  body.add(at(rb(0.88, 0.26, 0.02, D, 0.006), 0, 0.445, 1.16));
  for (const s of [-1, 1]) {
    body.add(at(rb(0.05, 0.46, 0.05, D, 0.01), s * 0.465, 0.445, 1.175));
    body.add(at(rb(0.045, 0.8, 0.04, D, 0.01), s * 0.465, 1.07, 1.19));
  }
  body.add(at(rb(0.975, 0.045, 0.04, D, 0.01), 0, 1.47, 1.19));
  body.add(at(rb(0.93, 0.035, 0.03, D, 0.008), 0, 1.07, 1.19));
  for (const x of [-0.35, -0.21, -0.07, 0.07, 0.21, 0.35]) body.add(at(rb(0.018, 0.78, 0.018, D, 0.004), x, 1.07, 1.19));
  const fp = new Shape();
  fp.moveTo(1.26, 0.7);
  fp.lineTo(1.19, 0.7);
  fp.lineTo(1.19, 0.655);
  fp.lineTo(1.21, 0.655);
  fp.lineTo(1.21, 0.13);
  fp.quadraticCurveTo(1.21, 0.08, 1.26, 0.08);
  fp.lineTo(2.22, 0.08);
  fp.quadraticCurveTo(2.26, 0.08, 2.26, 0.095);
  fp.lineTo(1.62, 0.125);
  fp.lineTo(1.3, 0.125);
  fp.quadraticCurveTo(1.26, 0.125, 1.26, 0.165);
  const forkGeo = sideExtrude(fp, 0.11, 0.008, 1, 6);
  for (const x of [-0.24, 0.24]) body.add(at(solid(forkGeo, D), x, 0, 0));

  // ---- overhead guard: leaning front legs, rear legs on the counterweight, slatted canopy
  for (const s of [-1, 1]) {
    body.add(strut(v3(s * 0.49, 0.82, 0.77), v3(s * 0.5, 2.11, 0.53), 0.06, 0.07, D));
    body.add(strut(v3(s * 0.49, 1.0, -0.8), v3(s * 0.5, 2.11, -0.79), 0.06, 0.07, D));
    body.add(at(rb(0.06, 0.07, 1.42, D, 0.012), s * 0.5, 2.145, -0.13));
  }
  for (const z of [0.56, -0.81]) body.add(at(rb(1.06, 0.07, 0.06, D, 0.012), 0, 2.145, z));
  for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) body.add(at(rb(0.045, 0.03, 1.32, D, 0.006), x, 2.15, -0.125));
  body.add(at(cyl(0.07, 0.03, D, 'y', 16), 0, 2.175, -0.42)); // beacon base

  // ---- operator station: seat, steering column and wheel, dash, hydraulic levers
  body.add(at(rb(0.4, 0.05, 0.38, D, 0.012), 0, 1.02, -0.3));
  body.add(at(rb(0.48, 0.09, 0.45, R, 0.04, 2), 0, 1.085, -0.29));
  const back = at(rb(0.46, 0.46, 0.09, R, 0.04, 2), 0, 1.37, -0.5);
  back.rotation.x = -0.2;
  body.add(back);
  for (const s of [-1, 1]) {
    const wing = at(rb(0.05, 0.16, 0.24, R, 0.02), s * 0.255, 1.18, -0.36);
    wing.rotation.x = -0.1;
    body.add(wing);
  }
  body.add(at(rb(0.62, 0.035, 0.12, D, 0.01), 0, 1.115, 0.6));
  const colA = v3(0, 1.06, 0.5);
  const colB = v3(0, 1.33, 0.38);
  body.add(rod(colA, v3(0, 1.22, 0.43), 0.045, D, 12), rod(colA, colB, 0.022, D, 10));
  const wheel = solid(new TorusGeometry(0.16, 0.016, 8, 28), D);
  wheel.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), colB.clone().sub(colA).normalize());
  wheel.position.copy(colB);
  body.add(wheel);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const spoke = solid(new CylinderGeometry(0.009, 0.009, 0.16, 6), D);
    spoke.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
    spoke.rotation.z = a - Math.PI / 2;
    spoke.position.applyQuaternion(wheel.quaternion).add(colB);
    spoke.quaternion.premultiply(wheel.quaternion);
    body.add(spoke);
  }
  for (const x of [0.2, 0.26, 0.32]) {
    body.add(rod(v3(x, 1.08, 0.56), v3(x, 1.26, 0.53), 0.008, D, 6));
    body.add(at(solid(new SphereGeometry(0.022, 10, 8), R), x, 1.27, 0.528));
  }

  // ---- LPG cylinder on its cradle behind the seat, with straps, valve guard and feed hose
  body.add(
    at(
      solid(
        lathe([[0.001, -0.38], [0.07, -0.375], [0.115, -0.36], [0.145, -0.33], [0.155, -0.29], [0.155, 0.29], [0.145, 0.33], [0.115, 0.36], [0.07, 0.375], [0.001, 0.38]], 20, 0.8).rotateZ(-Math.PI / 2),
        S,
      ),
      0,
      1.225,
      -0.86,
    ),
  );
  for (const x of [-0.22, 0.22]) {
    body.add(at(solid(cylGeo(0.159, 0.03, 'x', 20, 0.159, true), D), x, 1.225, -0.86));
    body.add(at(rb(0.04, 0.1, 0.26, D, 0.01), x, 1.09, -0.86));
  }
  body.add(at(solid(cylGeo(0.08, 0.07, 'x', 14, 0.08, true), S), 0.41, 1.225, -0.86));
  body.add(at(cyl(0.025, 0.05, D, 'x', 10), 0.4, 1.225, -0.86));
  body.add(hose([[0.43, 1.225, -0.84], [0.46, 1.15, -0.76], [0.42, 1.04, -0.62], [0.34, 0.99, -0.52]], 0.012, D, 14));

  // ---- lamps (lit, but under the bloom threshold): head lamps + amber indicators, tail/reverse, rear work lamp
  for (const s of [-1, 1]) {
    body.add(at(rb(0.1, 0.13, 0.07, D, 0.015), s * 0.5, 1.7, 0.665));
    body.add(at(cyl(0.033, 0.012, headLamp, 'z', 16), s * 0.5, 1.72, 0.704));
    body.add(at(rb(0.06, 0.022, 0.01, amberDim, 0.003), s * 0.5, 1.664, 0.703));
    body.add(at(rb(0.1, 0.12, 0.07, D, 0.015), s * 0.5, 1.4, -0.865));
    body.add(at(rb(0.07, 0.05, 0.01, tailLamp, 0.003), s * 0.5, 1.42, -0.904));
    body.add(at(rb(0.07, 0.03, 0.01, headLamp, 0.003), s * 0.5, 1.37, -0.904));
  }
  body.add(at(rb(0.12, 0.08, 0.08, D, 0.015), 0.3, 2.12, -0.87));
  body.add(at(rb(0.09, 0.05, 0.01, headLamp, 0.003), 0.3, 2.12, -0.914));

  const beaconProfile: [number, number][] = [[0.062, -0.05], [0.062, 0.02], [0.056, 0.044], [0.038, 0.058], [0.001, 0.064]];
  body.add(at(solid(lathe(beaconProfile, 16, 0.9).scale(0.97, 0.97, 0.97), amberDim), 0, 2.24, -0.42)); // unlit lens
  bake(body);
  g.add(body);

  const beacon = new Mesh(lathe(beaconProfile, 16, 0.9), M.amberAlert());
  beacon.position.set(0, 2.24, -0.42);
  g.add(beacon, blobShadow(1.9, 3.0, 0.38));
  return Object.assign(g, { beacon });
}

// ============================================================== press
const COLS: [number, number][] = [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]];

/** Fabricated-box gussets on the web between a top and bottom plate (front/back and both sides). */
function gussets(parent: Object3D, y0: number, y1: number, mat: Material) {
  const h = y1 - y0;
  const y = (y0 + y1) / 2;
  for (const x of [-1.8, -1.0, 1.0, 1.8]) for (const z of [-1.53, 1.53]) parent.add(at(rb(0.08, h, 0.14, mat, 0.015), x, y, z));
  for (const z of [-1.3, 0, 1.3]) for (const x of [-2.03, 2.03]) parent.add(at(rb(0.14, h, 0.08, mat, 0.015), x, y, z));
}

/**
 * Four-column hydraulic press (4.2 × 3.2 m, 6.5 m tall incl. the main cylinder) with a light curtain at
 * z 1.85 and an operator console at (−3.7, 1.2), facing +Z. Basalt-grey fabricated crown and base, chromed
 * columns, light-grey slide. `ram` is the slide (origin at its centre; reads right for y 2.85–3.6).
 */
export function hydraulicPress() {
  const g = new Group();
  const fixed = new Group();
  const B = M.body();
  const B2 = M.body2();
  const S = M.steel();
  const D = M.dark();
  const Yl = M.yellow();
  const red = M.red();
  const green = M.greenLed();

  // ---- base and crown: fabricated boxes (plates + ribbed web)
  fixed.add(at(rb(4.2, 0.12, 3.2, B2, 0.03), 0, 0.06, 0));
  fixed.add(at(rb(3.92, 0.86, 2.92, B2, 0.03), 0, 0.55, 0));
  fixed.add(at(rb(4.2, 0.14, 3.2, B2, 0.035, 2), 0, 1.03, 0));
  gussets(fixed, 0.12, 0.96, B2);
  fixed.add(at(rb(4.2, 0.14, 3.2, B2, 0.035, 2), 0, 4.57, 0));
  fixed.add(at(rb(3.92, 0.92, 2.92, B2, 0.03), 0, 5.1, 0));
  fixed.add(at(rb(4.2, 0.14, 3.2, B2, 0.035, 2), 0, 5.63, 0));
  gussets(fixed, 4.64, 5.56, B2);
  const anchor = hexGeo(0.04, 0.05);
  for (const x of [-1.95, 0, 1.95]) for (const z of [-1.5, 1.5]) fixed.add(at(solid(anchor, S), x, 0.145, z));

  // ---- chromed columns with tie-rod nuts on the base, under and over the crown
  const colGeo = new CylinderGeometry(0.2, 0.2, 4.75, 28);
  const nutGeo = hexGeo(0.27, 0.18);
  const studGeo = new CylinderGeometry(0.15, 0.15, 0.07, 18);
  for (const [x, z] of COLS) {
    fixed.add(at(solid(colGeo, S), x, 1.1 + 4.75 / 2, z));
    for (const y of [1.19, 4.41, 5.79]) fixed.add(at(solid(nutGeo, D), x, y, z));
    fixed.add(at(solid(studGeo, S), x, 5.915, z));
  }

  // ---- main cylinder: bolted base flange, barrel, head flange, cap; nose and gland under the crown
  fixed.add(at(cyl(0.66, 0.12, B2, 'y', 32), 0, 5.76, 0));
  fixed.add(at(cyl(0.5, 0.5, B, 'y', 32), 0, 6.07, 0));
  fixed.add(at(cyl(0.6, 0.1, B2, 'y', 32), 0, 6.37, 0));
  fixed.add(at(cyl(0.3, 0.08, B2, 'y', 24, 0.26), 0, 6.46, 0));
  const bolt = hexGeo(0.032, 0.04);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    fixed.add(at(solid(bolt, S), Math.cos(a) * 0.59, 5.84, Math.sin(a) * 0.59));
    fixed.add(at(solid(bolt, S), Math.cos(a) * 0.55, 6.44, Math.sin(a) * 0.55));
  }
  fixed.add(at(cyl(0.38, 0.16, B2, 'y', 28), 0, 4.42, 0));
  fixed.add(at(cyl(0.3, 0.03, S, 'y', 24), 0, 4.325, 0));
  // Valve manifold on the crown, piped into the cylinder
  fixed.add(at(rb(0.5, 0.36, 0.42, D, 0.02), 1.0, 5.88, -1.25));
  pipe(fixed, [[0.75, 5.92, -1.3], [0.3, 5.92, -1.3], [0.3, 5.92, -0.38]], 0.03, S);
  pipe(fixed, [[0.75, 6.0, -1.12], [0.12, 6.0, -1.12], [0.12, 6.0, -0.4]], 0.03, S);

  // ---- nameplate on the crown web (engraved lines read as text at a distance)
  fixed.add(at(rb(0.72, 0.36, 0.014, S, 0.004), 0, 5.12, 1.467));
  for (const [y, w] of [[5.22, 0.5], [5.15, 0.56], [5.09, 0.4], [5.03, 0.46]]) fixed.add(at(rb(w, 0.022, 0.006, D, 0.002), 0, y, 1.476));

  // ---- bolster with T-slots, and the lower die set clamped to it
  fixed.add(at(rb(3.0, 0.2, 2.2, B2, 0.02), 0, 1.2, 0));
  for (const [z0, z1] of [[-1.1, -0.69], [-0.63, -0.25], [-0.19, 0.19], [0.25, 0.63], [0.69, 1.1]]) {
    fixed.add(at(rb(3.0, 0.05, z1 - z0, S, 0.008), 0, 1.325, (z0 + z1) / 2));
  }
  fixed.add(at(rb(2.0, 0.16, 1.4, D, 0.02), 0, 1.43, 0));
  fixed.add(at(rb(1.1, 0.2, 0.8, S, 0.015), 0, 1.61, 0));
  fixed.add(at(rb(0.6, 0.012, 0.35, D, 0.003), 0, 1.714, 0));
  const post = new CylinderGeometry(0.04, 0.04, 0.44, 14);
  for (const x of [-0.85, 0.85]) for (const z of [-0.55, 0.55]) fixed.add(at(solid(post, S), x, 1.73, z));
  for (const x of [-1.12, 1.12]) {
    for (const z of [-0.44, 0.44]) {
      fixed.add(at(rb(0.24, 0.07, 0.12, D, 0.012), x, 1.385, z));
      fixed.add(at(solid(anchor, S), x, 1.445, z));
    }
  }

  // ---- hydraulic power pack (tank, motor, valve block, gauge) piped up the right rear to the manifold
  fixed.add(at(rb(1.3, 0.06, 0.9, D, 0.01), 2.95, 0.03, -1.0));
  fixed.add(at(rb(1.26, 0.72, 0.86, B, 0.03, 2), 2.95, 0.42, -1.0));
  fixed.add(at(rb(1.28, 0.04, 0.88, B2, 0.01), 2.95, 0.8, -1.0));
  fixed.add(at(rb(0.4, 0.05, 0.32, D, 0.01), 3.2, 0.845, -1.0));
  fixed.add(at(cyl(0.19, 0.48, B2, 'x', 24), 3.2, 1.04, -1.0));
  for (let i = 0; i < 6; i++) fixed.add(at(cyl(0.2, 0.018, B2, 'x', 24), 3.0 + i * 0.08, 1.04, -1.0));
  fixed.add(at(cyl(0.18, 0.09, D, 'x', 24), 3.485, 1.04, -1.0));
  fixed.add(at(rb(0.16, 0.1, 0.16, B2, 0.012), 3.2, 1.27, -1.0));
  fixed.add(at(cyl(0.14, 0.16, B2, 'x', 20, 0.17), 2.88, 1.0, -1.0));
  fixed.add(at(rb(0.34, 0.22, 0.4, S, 0.015), 2.52, 0.93, -1.25));
  for (const x of [2.44, 2.6]) fixed.add(at(rb(0.07, 0.07, 0.09, D, 0.01), x, 0.93, -1.0));
  fixed.add(at(cyl(0.01, 0.07, S, 'y', 8), 2.4, 1.075, -1.12));
  fixed.add(at(cyl(0.05, 0.025, S, 'z', 18), 2.4, 1.15, -1.12));
  fixed.add(at(cyl(0.044, 0.004, B, 'z', 18), 2.4, 1.15, -1.106));
  fixed.add(at(cyl(0.05, 0.05, D, 'y', 12), 2.75, 0.845, -0.7));
  fixed.add(at(rb(0.06, 0.12, 0.01, D, 0.003), 3.45, 0.45, -0.565));
  for (const z of [-1.36, -1.2]) pipe(fixed, [[2.52, 1.04, z], [2.52, 1.42, z], [2.25, 1.42, z], [2.25, 6.02, z], [1.25, 6.02, z]], 0.03, S);
  for (const y of [1.9, 2.9, 3.9, 5.1]) fixed.add(at(rb(0.17, 0.06, 0.3, D, 0.01), 2.205, y, -1.28));

  // ---- see-through mesh guards on both sides and the back (dark frames, welded mesh)
  const panels: BufferGeometry[] = [];
  const panel = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const p = new PlaneGeometry(w, h);
    const uv = p.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.05), uv.getY(i) * (h / 0.05));
    p.rotateY(ry);
    p.translate(x, y, z);
    panels.push(p);
  };
  for (const s of [-1, 1]) {
    for (const z of [-1.45, 1.45]) fixed.add(at(rb(0.05, 3.34, 0.05, D, 0.01), s * 2.08, 2.79, z));
    for (const y of [1.16, 4.42]) fixed.add(at(rb(0.05, 0.05, 2.95, D, 0.01), s * 2.08, y, 0));
    panel(2.85, 3.2, s * 2.08, 2.79, 0, Math.PI / 2);
  }
  for (const x of [-2.06, 0, 2.06]) fixed.add(at(rb(0.05, 3.34, 0.05, D, 0.01), x, 2.79, -1.585));
  for (const y of [1.16, 4.42]) fixed.add(at(rb(4.14, 0.05, 0.05, D, 0.01), 0, y, -1.585));
  panel(4.06, 3.2, 0, 2.79, -1.585, 0);

  // ---- access ladder up the right side, and a low yellow guard rail round the crown top
  for (const z of [-0.05, 0.4]) {
    fixed.add(at(rb(0.05, 6.14, 0.05, D, 0.01), 2.26, 3.07, z));
    for (const y of [0.55, 2.8, 5.1]) fixed.add(at(rb(0.17, 0.05, 0.04, D, 0.008), 2.18, y, z));
  }
  const rung = cylGeo(0.016, 0.45, 'z', 8);
  for (let y = 0.3; y < 6.0; y += 0.28) fixed.add(at(solid(rung, D), 2.26, y, 0.175));
  const railPost = (x: number, z: number) => fixed.add(at(rb(0.05, 0.44, 0.05, Yl, 0.01), x, 5.92, z));
  for (const [x, z] of [[-2.02, -1.5], [-2.02, 0], [-2.02, 1.5], [2.02, -1.5], [2.02, -0.1], [2.02, 0.5], [2.02, 1.5], [-0.7, -1.52], [0.7, -1.52]]) railPost(x, z);
  for (const y of [5.92, 6.12]) {
    fixed.add(at(rb(0.04, 0.04, 3.0, Yl, 0.01), -2.02, y, 0));
    fixed.add(at(rb(0.04, 0.04, 1.4, Yl, 0.01), 2.02, y, -0.8));
    fixed.add(at(rb(0.04, 0.04, 1.0, Yl, 0.01), 2.02, y, 1.0));
    fixed.add(at(rb(4.04, 0.04, 0.04, Yl, 0.01), 0, y, -1.52));
  }

  // ---- light curtain (emitter / receiver posts) at the front opening
  for (const x of [-2.25, 2.25]) {
    const s = Math.sign(x);
    fixed.add(at(rb(0.07, 1.9, 0.07, Yl, 0.01), x, 1.05, 1.85));
    fixed.add(at(rb(0.03, 1.7, 0.02, D, 0.004), x - s * 0.035, 1.1, 1.85));
    fixed.add(at(rb(0.012, 0.03, 0.02, green, 0.003), x - s * 0.052, 1.97, 1.85));
    fixed.add(at(rb(0.08, 0.04, 0.08, D, 0.01), x, 2.02, 1.85));
    fixed.add(at(rb(0.24, 0.02, 0.24, D, 0.006), x, 0.01, 1.85));
  }

  // ---- operator console on a pedestal: e-stop on its yellow legend plate, green 'go' lamp, key switch, stack light
  fixed.add(at(rb(0.3, 0.03, 0.3, D, 0.008), -3.7, 0.015, 1.2));
  fixed.add(at(rb(0.12, 1.05, 0.12, B2, 0.015), -3.7, 0.52, 1.2));
  fixed.add(at(rb(0.56, 0.36, 0.26, B, 0.025, 2), -3.7, 1.2, 1.2));
  fixed.add(at(rb(0.6, 0.03, 0.31, B2, 0.01), -3.7, 1.395, 1.205));
  fixed.add(at(rb(0.12, 0.12, 0.012, Yl, 0.004), -3.82, 1.25, 1.336));
  fixed.add(at(cyl(0.045, 0.04, red, 'z', 18), -3.82, 1.25, 1.35));
  fixed.add(at(cyl(0.052, 0.018, red, 'z', 18), -3.82, 1.25, 1.379));
  fixed.add(at(cyl(0.03, 0.03, green, 'z', 14), -3.6, 1.25, 1.34));
  fixed.add(at(cyl(0.038, 0.012, D, 'z', 14), -3.6, 1.25, 1.336));
  fixed.add(at(cyl(0.03, 0.02, D, 'z', 12), -3.6, 1.13, 1.34));
  for (const x of [-3.82, -3.72]) fixed.add(at(cyl(0.022, 0.02, D, 'z', 12), x, 1.12, 1.34));
  fixed.add(at(rb(0.16, 0.06, 0.008, D, 0.002), -3.62, 1.335, 1.334));
  fixed.add(at(cyl(0.03, 0.04, D, 'y', 12), -3.47, 1.43, 1.15));
  for (const [y, m] of [[1.48, green], [1.54, Yl], [1.6, red]] as const) fixed.add(at(cyl(0.034, 0.058, m, 'y', 14), -3.47, y, 1.15));
  fixed.add(at(cyl(0.03, 0.02, D, 'y', 12), -3.47, 1.64, 1.15));
  fixed.add(at(rb(1.5, 0.035, 0.14, D, 0.01), -2.88, 0.018, 1.2)); // floor cable duct to the press
  bake(fixed);
  const guards = new Mesh(mergeGeometries(panels, false)!, wireMesh());
  guards.renderOrder = 1;
  g.add(fixed, guards);

  // ---- slide (ram): fabricated box with guide bushings on the columns, piston rod and upper die set
  const ramParts = new Group();
  ramParts.add(at(rb(2.9, 0.68, 2.1, B, 0.03, 2), 0, 0.03, 0));
  ramParts.add(at(rb(3.0, 0.05, 2.2, B, 0.015), 0, 0.375, 0));
  ramParts.add(at(rb(3.0, 0.09, 2.2, S, 0.015), 0, -0.355, 0));
  for (const x of [-1.0, -0.33, 0.33, 1.0]) for (const z of [-1.075, 1.075]) ramParts.add(at(rb(0.07, 0.62, 0.05, B, 0.012), x, 0.03, z));
  const bushing = new CylinderGeometry(0.26, 0.26, 0.7, 24);
  const wiper = new CylinderGeometry(0.215, 0.215, 0.04, 20);
  for (const [x, z] of COLS) {
    ramParts.add(at(rb(0.44, 0.6, 0.44, B, 0.03), Math.sign(x) * 1.6, 0.02, Math.sign(z) * 1.16));
    ramParts.add(at(solid(bushing, B), x, 0, z));
    for (const y of [-0.37, 0.37]) ramParts.add(at(solid(wiper, D), x, y, z));
  }
  ramParts.add(at(cyl(0.42, 0.08, B, 'y', 28), 0, 0.44, 0));
  ramParts.add(at(cyl(0.26, 1.3, S, 'y', 28), 0, 1.13, 0));
  ramParts.add(at(rb(2.0, 0.14, 1.4, D, 0.02), 0, -0.47, 0));
  ramParts.add(at(rb(0.9, 0.16, 0.6, S, 0.015), 0, -0.62, 0));
  const guideBush = new CylinderGeometry(0.065, 0.065, 0.12, 14);
  for (const x of [-0.85, 0.85]) for (const z of [-0.55, 0.55]) ramParts.add(at(solid(guideBush, S), x, -0.6, z));
  bake(ramParts);
  const parts = [...ramParts.children] as Mesh[];
  const ram = parts.find((m) => m.material === B)!;
  for (const m of parts) if (m !== ram) ram.add(m);
  ram.position.set(0, 3.6, 0);
  g.add(ram);
  return Object.assign(g, { ram });
}

// ============================================================== robot
/**
 * Six-axis industrial robot (~2.4 m reach) in safety orange with dark joints, on an anchored base plate.
 * Same joint pivots and `pose(t)` motion as before: turret about Y, shoulder / elbow / wrist about Z.
 */
export function robotArm() {
  const g = new Group();
  const O = M.orange();
  const D = M.dark();
  const S = M.steel();

  // ---- static base: anchored plate, J1 base casting, cable inlet
  const base = new Group();
  base.add(at(rb(1.0, 0.04, 1.0, D, 0.012), 0, 0.02, 0));
  const washer = cylGeo(0.045, 0.01, 'y', 16);
  const nut = hexGeo(0.03, 0.035);
  const stud = cylGeo(0.015, 0.03, 'y', 8);
  for (const x of [-0.42, 0.42]) {
    for (const z of [-0.42, 0.42]) {
      base.add(at(solid(washer, S), x, 0.045, z), at(solid(nut, S), x, 0.0675, z), at(solid(stud, S), x, 0.095, z));
    }
  }
  base.add(solid(lathe([[0.52, 0.04], [0.52, 0.085], [0.505, 0.1], [0.475, 0.12], [0.452, 0.16], [0.44, 0.21], [0.44, 0.288], [0.001, 0.288]], 36), O));
  base.add(at(cyl(0.445, 0.02, D, 'y', 36), 0, 0.295, 0));
  base.add(at(rb(0.12, 0.12, 0.16, D, 0.02), -0.5, 0.13, 0));
  pipe(base, [[-0.56, 0.13, 0], [-0.68, 0.035, 0], [-1.0, 0.035, 0]], 0.03, D, 1.1);
  bake(base);
  g.add(base);

  // ---- J1 turret: turned drum, yoke cheeks round the J2 axis, J1 and J2 motors
  const turret = new Group();
  turret.position.y = 0.3;
  g.add(turret);
  const tb = new Group();
  tb.add(solid(lathe([[0.44, 0], [0.44, 0.05], [0.43, 0.1], [0.405, 0.2], [0.37, 0.3], [0.001, 0.3]], 36), O));
  const cheek = new Shape();
  cheek.moveTo(-0.34, 0.2);
  cheek.lineTo(0.38, 0.2);
  cheek.absarc(0.15, 0.85, 0.24, 0, Math.PI, false);
  cheek.lineTo(-0.34, 0.5);
  const cheekGeo = frontExtrude(cheek, 0.1, 0.02, 2);
  for (const z of [-0.235, 0.235]) tb.add(at(solid(cheekGeo, O), 0, 0, z));
  tb.add(at(rb(0.56, 0.22, 0.5, O, 0.05, 2), 0.08, 0.31, 0));
  for (const z of [-0.31, 0.31]) tb.add(at(cyl(0.17, 0.05, D, 'z', 28), 0.15, 0.85, z));
  tb.add(at(cyl(0.095, 0.24, D, 'z', 20), 0.15, 0.85, 0.455));
  tb.add(at(rb(0.08, 0.06, 0.1, D, 0.01), 0.15, 0.965, 0.47));
  tb.add(at(cyl(0.08, 0.26, D, 'y', 20), -0.29, 0.43, 0));
  tb.add(at(rb(0.07, 0.06, 0.08, D, 0.01), -0.29, 0.59, 0));
  bake(tb);
  turret.add(tb);

  // ---- J2 lower arm: tapered link between round bosses, axle caps, cable bundle on its back edge
  const shoulder = new Group();
  shoulder.position.set(0.15, 0.85, 0);
  turret.add(shoulder);
  const sb = new Group();
  const link = new Shape();
  link.absarc(0, 0, 0.2, Math.PI, Math.PI * 2, false);
  link.absarc(0, 1.2, 0.16, 0, Math.PI, false);
  sb.add(solid(frontExtrude(link, 0.3, 0.03, 2), O));
  sb.add(cyl(0.12, 0.34, D, 'z', 24));
  pipe(sb, [[-0.252, 0.25, 0.08], [-0.227, 1.0, 0.08]], 0.028, D);
  for (const y of [0.42, 0.82]) sb.add(at(rb(0.05, 0.035, 0.07, D, 0.008), -0.225 + y * 0.03, y, 0.08));
  bake(sb);
  shoulder.add(sb);

  // ---- J3 elbow + upper arm: hub, rear housing with the J4–J6 motors, tapered forearm, wrist clevis, dress pack
  const elbow = new Group();
  elbow.position.y = 1.2;
  shoulder.add(elbow);
  const eb = new Group();
  eb.add(cyl(0.19, 0.38, O, 'z', 28));
  eb.add(cyl(0.12, 0.42, D, 'z', 24));
  eb.add(at(rb(0.42, 0.32, 0.36, O, 0.08, 2), -0.24, 0.04, 0));
  eb.add(at(cyl(0.07, 0.16, D, 'x', 18), -0.52, 0.08, 0));
  for (const z of [-0.09, 0.09]) eb.add(at(cyl(0.05, 0.14, D, 'x', 16), -0.51, -0.05, z));
  eb.add(at(cyl(0.125, 0.05, D, 'x', 24), 0.2, 0, 0));
  eb.add(at(cyl(0.115, 0.7, O, 'x', 24, 0.088), 0.575, 0, 0));
  eb.add(at(rb(0.09, 0.18, 0.24, O, 0.03), 0.93, 0, 0));
  for (const z of [-0.09, 0.09]) {
    eb.add(at(rb(0.2, 0.15, 0.04, O, 0.015), 1.0, 0, z));
    eb.add(at(cyl(0.075, 0.04, O, 'z', 20), 1.08, 0, z));
    eb.add(at(cyl(0.045, 0.05, D, 'z', 16), 1.08, 0, z * 1.12));
  }
  eb.add(hose([[-0.32, 0.2, 0.06], [-0.08, 0.27, 0.09], [0.3, 0.2, 0.1], [0.65, 0.14, 0.09], [0.86, 0.11, 0.07]], 0.03, D, 28));
  eb.add(at(rb(0.04, 0.07, 0.05, D, 0.008), 0.35, 0.135, 0.09));
  eb.add(at(rb(0.04, 0.06, 0.05, D, 0.008), 0.66, 0.1, 0.085));
  bake(eb);
  elbow.add(eb);

  // ---- J5/J6 wrist: hub, wrist body, tool flange and a pneumatic parallel gripper
  const wrist = new Group();
  wrist.position.x = 1.08;
  elbow.add(wrist);
  const wb = new Group();
  wb.add(cyl(0.075, 0.13, O, 'z', 20));
  wb.add(at(cyl(0.068, 0.12, O, 'x', 20, 0.06), 0.1, 0, 0));
  wb.add(at(cyl(0.062, 0.02, D, 'x', 20), 0.17, 0, 0));
  wb.add(at(cyl(0.058, 0.02, S, 'x', 20), 0.19, 0, 0));
  wb.add(at(cyl(0.045, 0.04, D, 'x', 16), 0.22, 0, 0));
  wb.add(at(rb(0.08, 0.09, 0.2, D, 0.015), 0.28, 0, 0));
  for (const z of [-0.055, 0.055]) wb.add(at(rb(0.12, 0.045, 0.024, S, 0.006), 0.38, 0, z));
  for (const z of [-0.04, 0.04]) wb.add(at(cyl(0.008, 0.03, S, 'y', 8), 0.27, 0.06, z));
  bake(wb);
  wrist.add(wb);

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
