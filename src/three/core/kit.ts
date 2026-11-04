/**
 * Shared 3D kit: daylight palette, PBR materials, light rig, ground, overlays
 * and a few props. Every scene builds on this so they all read as one product.
 *
 * Units are metres. Painted surfaces are dielectric (metalness 0); only bare
 * metal (machined, stainless, galvanised) uses metalness 1.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type ColorRepresentation,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Stage } from './stage';

/**
 * Overlay / status colours for a light scene (AA-ish on the light floor).
 * `bg` is only the fallback; the real background comes from the host section.
 */
export const C = {
  bg: 0xeaeff4,
  green: 0x16a34a,
  amber: 0xd97706,
  red: 0xdc2626,
  cyan: 0x0891b2,
  blue: 0x1d5fd1,
  teal: 0x0f766e,
  ink: 0x1b2733,
  slate: 0x94a3b8,
  white: 0xffffff,
};

/**
 * Sun direction, matched to the sun in the Poly Haven HDRI
 * (kloofendal_48d_partly_cloudy_puresky: azimuth 55.7°, elevation 48°), so
 * reflections and cast shadows agree.
 */
export const SUN_DIR = new Vector3(0.553, 0.743, 0.377).normalize();
export const SUN_DIST = 46;

// ---------------------------------------------------------------- materials
const cache = new Map<string, Material>();
const cached = <T extends Material>(key: string, make: () => T): T => {
  let m = cache.get(key) as T | undefined;
  if (!m) cache.set(key, (m = make()));
  return m;
};
const std = (key: string, color: ColorRepresentation, roughness: number, metalness = 0, extra: Partial<MeshStandardMaterial> = {}) =>
  cached(key, () => Object.assign(new MeshStandardMaterial({ color, roughness, metalness }), extra));

/** Named palette materials, cached so meshes batch by material. */
export const M = {
  /** Light grey housings (RAL 7035). */
  body: () => std('body', 0xc3c8cc, 0.55),
  /** Basalt grey structure (RAL 7012). */
  body2: () => std('body2', 0x60656a, 0.6),
  /** White painted steel. */
  white: () => std('white', 0xe9eaec, 0.5),
  /** Machined / stainless steel. */
  steel: () => std('steel', 0xaeb4b9, 0.32, 1),
  /** Hot-dip galvanised steel (duller than stainless). */
  galv: () => std('galv', 0xa7adb2, 0.5, 1),
  dark: () => std('dark', 0x2c3136, 0.7),
  concrete: () => concreteMat(0xe1e4e7),
  rubber: () => std('rubber', 0x1f2124, 0.85),
  /** Safety yellow (RAL 1003). */
  yellow: () => std('yellow', 0xe8a900, 0.5),
  /** Safety orange (RAL 2004). */
  orange: () => std('orange', 0xd8571a, 0.5),
  /** Signal red paint (valves, handwheels). */
  red: () => std('red', 0xb91c1c, 0.5),
  /** Blue-grey bridge paint (RAL 7031). */
  bridge: () => std('bridge', 0x66747c, 0.55),
  // Light, weathered asphalt: dark roads became the strongest line in wide shots.
  asphalt: () => std('asphalt', 0x989ea4, 0.92),
  hivis: () => std('hivis', 0xd4ea1a, 0.75, 0, { emissive: new Color(0x1c2400) }),
  /** Retro-reflective tape on vests (reads silver-grey in daylight). */
  reflect: () => std('reflect', 0xbfc4c8, 0.35, 0.2),
  /** Workwear trousers and sleeves. */
  cloth: () => std('cloth', 0x434d58, 0.85),
  /** Neutral entourage-figure skin (no skin tone: an archviz mannequin). */
  figure: () => std('figure', 0xc4c8cc, 0.65),
  helmet: () => std('helmet', 0xeeeeea, 0.35),
  glass: () => std('glass', 0xd6e6ee, 0.05, 0, { transparent: true, opacity: 0.28, depthWrite: false }),
  water: () => std('water', 0x3f5560, 0.06, 0, { envMapIntensity: 1.2 }),
  card: () => std('card', 0xb08a5a, 0.85),
  pallet: () => std('pallet', 0xa88a62, 0.85),
  aggregate: () => std('aggregate', 0x8f8a82, 1, 0, { flatShading: true }),
  /** Status LEDs and lenses: lit, but well under the bloom threshold. */
  cyanLed: () => led(0x0891b2, 0.8),
  greenLed: () => led(0x16a34a, 0.8),
  /** Alert lamps and beacons: bright enough to bloom. */
  amberAlert: () => led(0xf59e0b, 6),
  redAlert: () => led(0xef4444, 6),
};

/** Emissive lamp material (cached per colour and intensity). */
export function led(color: ColorRepresentation, intensity = 0.8) {
  const c = new Color(color);
  return cached(`led${c.getHexString()}${intensity}`, () =>
    new MeshStandardMaterial({ color: c.clone().multiplyScalar(0.25), emissive: c, emissiveIntensity: intensity, roughness: 0.4 }),
  );
}

/** Uncached painted material, for parts that animate colour. */
export function paint(color: ColorRepresentation, roughness = 0.55, metalness = 0) {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

const CONCRETE_GLSL = /* glsl */ `
varying vec3 vGPos;
float igHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float igNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(igHash(i), igHash(i + vec2(1, 0)), u.x), mix(igHash(i + vec2(0, 1)), igHash(i + vec2(1, 1)), u.x), u.y);
}
// Anti-aliased joint lines every s metres; fades out before it can alias.
float igJoint(vec2 p, float s) {
  vec2 q = p / s;
  vec2 fw = max(fwidth(q), vec2(1e-4));
  vec2 g = abs(fract(q - 0.5) - 0.5) / (fw * 1.2);
  float l = 1.0 - min(min(g.x, g.y), 1.0);
  return l * (1.0 - smoothstep(0.015, 0.06, max(fw.x, fw.y)));
}`;

/**
 * Light concrete with saw-cut joints every 6 m and low-frequency mottling,
 * computed in world space so slabs and the yard floor line up.
 */
export function concreteMat(color: ColorRepresentation = 0xbfc3c6, joints = 6) {
  const c = new Color(color);
  return cached(`concrete${c.getHexString()}${joints}`, () => {
    const m = new MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${CONCRETE_GLSL}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float igMot = igNoise(vGPos.xz * 0.35) * 0.6 + igNoise(vGPos.xz * 1.7) * 0.25 + igNoise(vGPos.xz * 0.045) * 0.15;
diffuseColor.rgb *= (0.93 + 0.1 * igMot)${joints > 0 ? ` * (1.0 - igJoint(vGPos.xz, ${joints.toFixed(1)}) * 0.2)` : ''};`,
        )
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= 0.9 + 0.16 * igMot;');
    };
    m.customProgramCacheKey = () => `ig-concrete-${joints}`;
    return m;
  });
}

/** Thin technical line (paths, outlines). */
export function lineMat(color: ColorRepresentation = C.ink, opacity = 0.5) {
  return new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

/**
 * Normal-blended translucent overlay (zones, coverage, scan planes). Additive
 * blending washes out on a light background, so overlays are plain alpha.
 */
export function overlayMat(color: ColorRepresentation, opacity = 0.15, map?: Texture) {
  return new MeshBasicMaterial({
    color,
    map: map ?? null,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Enable shadows on every opaque mesh under a node. */
export function shade<T extends Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as Mesh).isMesh && !((c as Mesh).material as Material)?.transparent) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

// ---------------------------------------------------------------- textures
const texCache = new Map<string, CanvasTexture>();
function canvasTex(key: string, size: [number, number], draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  [c.width, c.height] = size;
  draw(c.getContext('2d')!, c.width, c.height);
  t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/** Soft round alpha falloff (contact shadows, puffs). White RGB, alpha gradient. */
export function softDot(inner = 0) {
  return canvasTex(`dot${inner}`, [64, 64], (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    if (inner > 0) grd.addColorStop(inner, 'rgba(255,255,255,0.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

/** 45° hazard hatch (yellow/black or red/white), tiles along U. */
export function hatchTexture(a = '#e8a900', b = '#1f2124') {
  const t = canvasTex(`hatch${a}${b}`, [64, 16], (g, w, h) => {
    g.fillStyle = a;
    g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let x = -h; x < w + h; x += 16) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 8, h);
      g.lineTo(x + 8 + h, 0);
      g.lineTo(x + h, 0);
      g.closePath();
      g.fill();
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Thermal-camera style radial heat (jet colour map) for hot-spot overlays. */
export function heatTexture() {
  return canvasTex('heat', [128, 128], (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,236,1)');
    grd.addColorStop(0.14, 'rgba(255,214,64,1)');
    grd.addColorStop(0.32, 'rgba(244,96,32,0.95)');
    grd.addColorStop(0.55, 'rgba(196,40,96,0.6)');
    grd.addColorStop(0.78, 'rgba(70,40,160,0.28)');
    grd.addColorStop(1, 'rgba(40,30,120,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

// ---------------------------------------------------------------- primitives
type MatArg = MeshStandardMaterial | ColorRepresentation;
const asMat = (m: MatArg) => (m instanceof MeshStandardMaterial ? m : std(`c${new Color(m).getHexString()}`, m, 0.55));

/** A solid with an optional hairline edge (off by default; use sparingly on light geometry). */
export function edged(geo: BufferGeometry, edge: ColorRepresentation | null = null, edgeOpacity = 0.12, fill: MatArg = M.body(), edgeGeo?: BufferGeometry) {
  const g = new Group();
  const mesh = new Mesh(geo, asMat(fill));
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  let lines: LineSegments | undefined;
  if (edge !== null) {
    lines = new LineSegments(new EdgesGeometry(edgeGeo ?? geo, 25), lineMat(edge, edgeOpacity));
    g.add(lines);
  }
  return Object.assign(g, { mesh, lines });
}

/** Bevelled box (8% of the smallest side, capped at 4 cm). No edge lines unless asked. */
export function box(w: number, h: number, d: number, edge: ColorRepresentation | null = null, op = 0.12, fill: MatArg = M.body()) {
  const r = Math.min(0.04, Math.min(w, h, d) * 0.08);
  const geo = r > 0.006 ? new RoundedBoxGeometry(w, h, d, 2, r) : new BoxGeometry(w, h, d);
  return edged(geo, edge, op, fill, edge === null ? undefined : new BoxGeometry(w, h, d));
}

export function solid(geo: BufferGeometry, mat: Material) {
  const m = new Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** A flat slab that receives but does not cast shadows (floors, decks, pads). */
export function slab(w: number, h: number, d: number, mat: Material = M.concrete()) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.receiveShadow = true;
  m.position.y = h / 2;
  return m;
}

// ---------------------------------------------------------------- environment
export interface EnvOptions {
  /** Fog near/far in metres; false for none. framedShot() and the journey re-set it from the camera distance. */
  fog?: [number, number] | false;
  /** Half-size of the sun's shadow frustum in metres. */
  shadowSize?: number;
  /** Add the concrete yard floor (default true). */
  ground?: boolean;
  groundColor?: ColorRepresentation;
}

/**
 * Daylight rig: warm sun with soft PCF shadows (direction matches the HDRI),
 * a sky/ground hemisphere fill, fog in the page background colour and a
 * 1.2 km concrete yard floor whose edge always dissolves into the fog.
 */
export function addEnvironment(stage: Stage, opts: EnvOptions = {}) {
  const { scene, tier, bg } = stage;
  const fog = opts.fog ?? [60, 190];
  scene.fog = fog ? new Fog(bg.clone(), fog[0], fog[1]) : null;

  // Cool sky above, cool grey bounce below (a brown bounce made the light floor read warm and murky).
  const hemi = new HemisphereLight(0xe6eef6, 0xc4cad1, 0.45);
  scene.add(hemi);

  const sun = new DirectionalLight(0xfff3e2, 3.0);
  sun.position.copy(SUN_DIR).multiplyScalar(SUN_DIST);
  sun.castShadow = tier !== 'low';
  const s = opts.shadowSize ?? 30;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 140 });
  sun.shadow.camera.updateProjectionMatrix();
  const map = tier === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(map, map);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  let ground: Mesh | null = null;
  if (opts.ground !== false) {
    // Yard floor: mottled, no joint grid (joints are on the station slabs only, so it never reads as graph paper).
    ground = new Mesh(new PlaneGeometry(1200, 1200), concreteMat(opts.groundColor ?? 0xd5dadf, 0));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);
  }
  return { ground, sun, hemi };
}

// ---------------------------------------------------------------- overlays
/** Soft contact shadow under movers (works on every tier, even with shadows off). */
export function blobShadow(w: number, d: number, opacity = 0.32) {
  const m = new Mesh(
    new PlaneGeometry(w, d),
    new MeshBasicMaterial({ color: 0x000000, map: softDot(0.2), transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

/** Crisp 2 px line set (resolution is updated by LineSegments2 from the renderer viewport). */
export function fatLines(positions: number[], color: ColorRepresentation, width = 2, opacity = 1) {
  const geo = new LineSegmentsGeometry().setPositions(positions);
  const mat = new LineMaterial({ color: new Color(color).getHex(), linewidth: width, worldUnits: false, transparent: true, opacity, depthWrite: false });
  const l = new LineSegments2(geo, mat);
  l.renderOrder = 3;
  return l;
}

/** Detection box: 2 px status-coloured edges (green ok / amber warn / red bad). */
export function detectionBox(w: number, h: number, d: number, color: ColorRepresentation = C.green) {
  const box = new BoxGeometry(w, h, d);
  const edges = new EdgesGeometry(box);
  const geo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
  box.dispose();
  edges.dispose();
  const mat = new LineMaterial({ color: new Color(color).getHex(), linewidth: 2, worldUnits: false, transparent: true, opacity: 1, depthWrite: false });
  const l = new LineSegments2(geo, mat);
  l.renderOrder = 3;
  return Object.assign(l, {
    setColor: (c: ColorRepresentation) => mat.color.set(c),
  });
}

/** Floor zone: translucent fill plus a hatched tape border. */
export function hazardZone(w: number, d: number, kind: 'warn' | 'bad' = 'warn', tape = 0.1) {
  const g = new Group();
  const fillColor = kind === 'bad' ? C.red : C.amber;
  const fill = new Mesh(new PlaneGeometry(w, d), overlayMat(fillColor, 0.1));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.02;
  fill.renderOrder = 1;
  g.add(fill);
  const tex = kind === 'bad' ? hatchTexture('#e5e7e9', '#c62828') : hatchTexture();
  const tapeMat = new MeshStandardMaterial({ map: tex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const strips: [number, number, number, number, number][] = [
    [w, tape, 0, -d / 2, 0],
    [w, tape, 0, d / 2, 0],
    [d, tape, -w / 2, 0, Math.PI / 2],
    [d, tape, w / 2, 0, Math.PI / 2],
  ];
  const tapeGroup = new Group();
  for (const [len, wid, x, z, rot] of strips) {
    const geo = new PlaneGeometry(len, wid);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / (wid * 4)));
    const m = new Mesh(geo, tapeMat);
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, 0.022, z);
    tapeGroup.add(m);
  }
  g.add(bake(tapeGroup, { cast: false }));
  return Object.assign(g, { fill });
}

/** Screen-facing thermal hot-spot overlay (the detection result, not a glowing part). */
export function thermalSpot(size = 0.9) {
  const s = new Sprite(new SpriteMaterial({ map: heatTexture(), transparent: true, opacity: 0.82, depthWrite: false, depthTest: true }));
  s.scale.setScalar(size);
  s.renderOrder = 2;
  return s;
}

// ---------------------------------------------------------------- people (fallback figure)
/**
 * Fallback site worker: a neutral archviz figure (feet at the origin, facing
 * +Z; 1.75 m, 1.78 m with the hard hat) in workwear, hi-vis vest and hard hat.
 * Only used when the rigged Rocketbox avatars (people.ts, via scenes/cast.ts)
 * fail to load. `height` is the standing height for sizing detection boxes.
 *
 * `legs` and `arms` are pivot groups (hip / shoulder) for a simple gait.
 */
export function worker(opts: { helmet?: boolean; vest?: boolean } = {}) {
  const g = new Group();
  const legs: Group[] = [];
  const arms: Group[] = [];
  const legGeo = new CapsuleGeometry(0.068, 0.7, 4, 10);
  legGeo.translate(0, -0.42, 0);
  const bootGeo = new RoundedBoxGeometry(0.11, 0.09, 0.27, 2, 0.03);
  bootGeo.translate(0, -0.855, 0.04);
  const legMerged = mergeGeometries([legGeo, bootGeo].map(ni).map(stripToCommon), false)!;
  for (const x of [-0.095, 0.095]) {
    const hip = new Group();
    hip.position.set(x, 0.9, 0);
    hip.add(solid(legMerged, M.cloth()));
    g.add(hip);
    legs.push(hip);
  }
  // Torso, neck + head, vest and reflective band: one vertex-coloured mesh (one draw call).
  const parts: BufferGeometry[] = [];
  const add = (geo: BufferGeometry, color: number, sz = 1, y = 0) => {
    const g2 = ni(geo);
    g2.scale(1, 1, sz);
    g2.translate(0, y, 0);
    tint(g2, color);
    parts.push(g2);
  };
  add(new CapsuleGeometry(0.155, 0.36, 4, 14), 0x434d58, 0.64, 1.18);
  const headGeo = new SphereGeometry(0.1, 20, 14);
  headGeo.scale(1, 1.16, 1.04);
  add(headGeo, 0xc4c8cc, 1, 1.63);
  add(new CylinderGeometry(0.045, 0.05, 0.12, 10), 0xc4c8cc, 1, 1.5);
  if (opts.vest !== false) {
    add(new CapsuleGeometry(0.163, 0.26, 4, 14), 0xd4ea1a, 0.68, 1.19);
    add(new CylinderGeometry(0.166, 0.166, 0.045, 18, 1, true), 0xbfc4c8, 0.69, 1.12);
  }
  g.add(solid(mergeGeometries(parts, false)!, figureMat()));
  const armGeo = new CapsuleGeometry(0.048, 0.52, 4, 8);
  armGeo.translate(0, -0.3, 0);
  for (const x of [-0.205, 0.205]) {
    const sh = new Group();
    sh.position.set(x, 1.42, 0);
    sh.rotation.z = x > 0 ? 0.06 : -0.06;
    sh.add(solid(armGeo, M.cloth()));
    g.add(sh);
    arms.push(sh);
  }
  const hat = new Group();
  const dome = solid(new SphereGeometry(0.125, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet());
  dome.scale.set(1, 0.92, 1.08);
  dome.position.y = 1.665;
  const brim = solid(new CylinderGeometry(0.15, 0.15, 0.012, 22), M.helmet());
  brim.position.set(0, 1.668, 0.02);
  hat.add(dome, brim);
  bake(hat);
  hat.visible = opts.helmet !== false;
  g.add(hat);
  const fig = Object.assign(g, { legs, arms, hat });
  // A live getter (Object.assign would copy a getter's value once).
  return Object.defineProperty(fig, 'height', { get: () => (hat.visible ? 1.78 : 1.75) }) as typeof fig & { readonly height: number };
}

const ni = (g: BufferGeometry) => (g.index ? g.toNonIndexed() : g);
/** Per-vertex colour (linear) for merged multi-colour props; keeps position/normal/uv/color only. */
function tint(g: BufferGeometry, hex: number) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  const c = new Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return g;
}
let figureMatInst: MeshStandardMaterial | null = null;
const figureMat = () => (figureMatInst ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }));
function stripToCommon(g: BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g;
}

// ---------------------------------------------------------------- props
/** Counterbalance forklift (~1.1 × 2.3 m, guard 2.1 m) baked to five draw calls, with a beacon. */
export function forklift() {
  const g = new Group();
  const body = new Group();
  const chassis = solid(new RoundedBoxGeometry(1.1, 0.62, 1.9, 2, 0.06), M.yellow());
  chassis.position.set(0, 0.6, 0);
  const cw = solid(new RoundedBoxGeometry(1.08, 0.7, 0.46, 2, 0.08), M.dark());
  cw.position.set(0, 0.72, -0.86);
  const seat = solid(new RoundedBoxGeometry(0.46, 0.42, 0.42, 2, 0.06), M.dark());
  seat.position.set(0, 1.12, -0.32);
  const dash = solid(new RoundedBoxGeometry(0.9, 0.36, 0.28, 2, 0.04), M.yellow());
  dash.position.set(0, 1.08, 0.5);
  body.add(chassis, cw, seat, dash);
  const postGeo = new BoxGeometry(0.06, 1.25, 0.06);
  for (const [x, z] of [[-0.5, 0.42], [0.5, 0.42], [-0.5, -0.62], [0.5, -0.62]]) {
    const p = solid(postGeo, M.dark());
    p.position.set(x, 1.53, z);
    body.add(p);
  }
  const roof = solid(new BoxGeometry(1.06, 0.05, 1.14), M.dark());
  roof.position.set(0, 2.16, -0.1);
  body.add(roof);
  const railGeo = new BoxGeometry(0.09, 2.4, 0.12);
  for (const x of [-0.33, 0.33]) {
    const r = solid(railGeo, M.dark());
    r.position.set(x, 1.3, 1.08);
    body.add(r);
  }
  const carriage = solid(new BoxGeometry(0.86, 0.36, 0.06), M.dark());
  carriage.position.set(0, 0.42, 1.18);
  body.add(carriage);
  const forkGeo = new BoxGeometry(0.1, 0.045, 1.05);
  for (const x of [-0.24, 0.24]) {
    const f = solid(forkGeo, M.steel());
    f.position.set(x, 0.12, 1.72);
    body.add(f);
  }
  const wheelGeo = new CylinderGeometry(0.27, 0.27, 0.2, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rearGeo = new CylinderGeometry(0.2, 0.2, 0.18, 18);
  rearGeo.rotateZ(Math.PI / 2);
  for (const [x, z, geo] of [[-0.48, 0.56, wheelGeo], [0.48, 0.56, wheelGeo], [-0.46, -0.7, rearGeo], [0.46, -0.7, rearGeo]] as const) {
    const w = solid(geo, M.rubber());
    w.position.set(x, geo === wheelGeo ? 0.27 : 0.2, z);
    body.add(w);
  }
  bake(body);
  g.add(body);
  const beacon = new Mesh(new CylinderGeometry(0.06, 0.07, 0.1, 12), M.amberAlert());
  beacon.position.set(0, 2.24, -0.42);
  g.add(beacon, blobShadow(1.9, 3.0, 0.38));
  return Object.assign(g, { beacon });
}

/** Pole-mounted CCTV camera with its floor coverage sector (no light cone). */
export function cctv(height = 7, reach = 9, color: ColorRepresentation = C.cyan) {
  const g = new Group();
  const pole = solid(new CylinderGeometry(0.07, 0.1, height, 12), M.galv());
  pole.position.y = height / 2;
  const arm = solid(new BoxGeometry(0.07, 0.07, 0.62), M.galv());
  arm.position.set(0, height - 0.1, 0.28);
  const head = new Group();
  head.position.set(0, height - 0.3, 0.6);
  head.rotation.x = 0.45;
  const housing = solid(new RoundedBoxGeometry(0.26, 0.24, 0.62, 2, 0.05), M.white());
  const hood = solid(new BoxGeometry(0.32, 0.02, 0.7), M.white());
  hood.position.set(0, 0.14, 0.04);
  const lens = new Mesh(new CylinderGeometry(0.075, 0.075, 0.03, 18), M.dark());
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.32;
  const ledM = new Mesh(new SphereGeometry(0.014, 8, 6), M.greenLed());
  ledM.position.set(0.09, -0.08, 0.31);
  head.add(housing, hood, lens);
  // Sector centred on +Z (the way the camera looks).
  const sector = new Mesh(new CircleGeometry(reach * 0.5, 48, -Math.PI / 2 - 0.6, 1.2), overlayMat(color, 0.07));
  sector.rotation.x = -Math.PI / 2;
  sector.position.set(0, 0.025, 0.6);
  sector.renderOrder = 1;
  const arcPts: number[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = -Math.PI / 2 - 0.6 + (i / 32) * 1.2;
    arcPts.push(Math.cos(a) * reach * 0.5, 0, -Math.sin(a) * reach * 0.5);
  }
  const arc = new Line(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(arcPts, 3)), lineMat(color, 0.35));
  arc.position.set(0, 0.03, 0.6);
  const fixed = new Group();
  fixed.add(pole, arm, head);
  bake(fixed);
  ledM.position.applyMatrix4(head.matrix);
  g.add(fixed, ledM, sector, arc);
  return Object.assign(g, { sector });
}

/** A crack as a crisp polyline in the XY plane (dark, highlighted when detected). */
export function crack(points: [number, number][], color: ColorRepresentation = 0x3a3330, width = 1.5) {
  const arr: number[] = [];
  for (let i = 0; i < points.length - 1; i++) arr.push(points[i][0], points[i][1], 0, points[i + 1][0], points[i + 1][1], 0);
  return fatLines(arr, color, width, 0.9);
}

export const smooth = (x: number) => x * x * (3 - 2 * x);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
/** Shortest signed angle from a to b. */
export const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- structure helpers
const UP = new Vector3(0, 1, 0);
/** A solid square-section member between two points (truss chords, braces, frames). */
export function beam(a: Vector3, b: Vector3, t: number, mat: Material = M.steel()) {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  const m = solid(new BoxGeometry(t, len, t), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

/**
 * Merges every static opaque mesh under `root` into one mesh per material
 * (world transforms baked in). Cuts draw calls for racks, trusses and frames.
 */
export function bake(root: Object3D, opts: { cast?: boolean } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map<Material, BufferGeometry[]>();
  const victims: Mesh[] = [];
  const tmp = new Matrix4();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !(m.material instanceof MeshStandardMaterial) || m.material.transparent) return;
    if ((m as any).isInstancedMesh || (m as any).isSkinnedMesh) return;
    const t = m.geometry.clone().applyMatrix4(tmp.multiplyMatrices(inv, m.matrixWorld));
    const g = t.index ? t.toNonIndexed() : t;
    const list = groups.get(m.material) ?? [];
    list.push(g);
    groups.set(m.material, list);
    victims.push(m);
  });
  victims.forEach((v) => v.parent?.remove(v));
  for (const [mat, geos] of groups) {
    // Keep only attributes every geometry shares, so they can merge.
    const keys = ['position', 'normal', 'uv'].filter((k) => geos.every((g) => g.getAttribute(k)));
    geos.forEach((g) => Object.keys(g.attributes).forEach((k) => !keys.includes(k) && g.deleteAttribute(k)));
    const merged = mergeGeometries(geos, false);
    if (merged) {
      const mesh = solid(merged, mat);
      mesh.castShadow = opts.cast ?? true;
      root.add(mesh);
    }
    geos.forEach((g) => g.dispose());
  }
  return root;
}
