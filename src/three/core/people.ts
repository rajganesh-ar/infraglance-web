/**
 * Animated 3D site workers (Microsoft Rocketbox avatars + clips, MIT — see /credits).
 *
 * Assets are built by `npm run people` (scripts/people.mjs):
 *   /models/people/worker-{m1,m2,f1}.glb   skinned avatar, metres, Y-up, faces +Z, feet on y = 0
 *   /models/anim/{m,f}-{walk,idle}.glb     skeleton + one clip each ("walk" in place, "idle")
 *
 * Usage:
 *   const kit = await loadPeople();
 *   const p = kit.create({ variant: 'm2', action: 'walk', timeOffset: Math.random() * 5 });
 *   scene.add(p.root);
 *   p.setSpeed(1.2);              // walk cadence for 1.2 m/s — move p.root along its +Z yourself
 *   // per frame: p.update(dt)
 *
 * Natural walk speeds (clip stride / cycle): male 1.40 m/s (1.50 m in 1.07 s),
 * female 1.30 m/s (1.60 m in 1.23 s). `person.naturalSpeed` has the per-avatar value.
 * Variants: m1 = orange vest + orange hard hat, m2 = yellow vest + white hard hat + radio,
 * f1 = yellow vest + white hard hat. The hi-vis vest is painted into the body texture, so
 * `vest: false` is accepted but has no effect.
 */
import {
  AnimationClip,
  AnimationMixer,
  LoopRepeat,
  MeshStandardMaterial,
  VectorKeyframeTrack,
  type AnimationAction,
  type Material,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type PersonVariant = 'm1' | 'm2' | 'f1';
export type PersonAction = 'walk' | 'idle';

export interface PersonOptions {
  variant: PersonVariant;
  /** Starting clip (default 'idle'). */
  action?: PersonAction;
  /** Hard hat on (default true). */
  helmet?: boolean;
  /** Accepted for API symmetry; the vest is part of the body texture and cannot be removed. */
  vest?: boolean;
  /** Skinned meshes cast shadows (default true). */
  castShadow?: boolean;
  /** Skinned meshes receive shadows (default false — avoids acne on small, moving surfaces). */
  receiveShadow?: boolean;
  /** Seconds into the clips to start from, so a crowd does not move in lockstep. */
  timeOffset?: number;
  /** Walk speed in m/s (default: the clip's natural speed). */
  speed?: number;
}

export interface Person {
  root: Object3D;
  variant: PersonVariant;
  /** Current standing height in metres (with or without the hard hat). */
  readonly height: number;
  /** Ground speed in m/s at which the walk clip plays at timeScale 1 (no foot sliding). */
  readonly naturalSpeed: number;
  readonly action: PersonAction;
  setAction(a: PersonAction, fade?: number): void;
  setHelmet(on: boolean): void;
  /** Sets walk cadence to match a ground speed in m/s (clamped to 0.35×–1.8× natural). */
  setSpeed(mps: number): void;
  update(dt: number): void;
  /** Stops the mixer and detaches; geometry and materials stay with the kit. */
  dispose(): void;
}

export interface PeopleKit {
  variants: readonly PersonVariant[];
  create(o: PersonOptions): Person;
  /** Frees all shared geometry, materials and textures. Existing people stop rendering correctly. */
  dispose(): void;
}

const VARIANTS: readonly PersonVariant[] = ['m1', 'm2', 'f1'];
const SEX: Record<PersonVariant, 'm' | 'f'> = { m1: 'm', m2: 'm', f1: 'f' };
const ROOT_BONE = 'Bip01';
const DEFAULT_FADE = 0.35;

/** Daylight + HDRI tuning per part: albedo maps are fairly flat, so keep IBL a little under 1. */
const MATERIAL_TUNING: Record<string, { roughness: number; envMapIntensity: number }> = {
  body: { roughness: 0.8, envMapIntensity: 0.85 },
  head: { roughness: 0.55, envMapIntensity: 0.75 },
  helmet: { roughness: 0.35, envMapIntensity: 1.0 },
};

interface Template {
  scene: Object3D;
  height: number;
  heightNoHelmet: number;
  hipHeight: number;
}
interface ClipInfo {
  clip: AnimationClip;
  refHipHeight: number;
  speed: number;
}

let kitPromise: Promise<PeopleKit> | null = null;

/** Loads the three avatars and four clips once; later calls return the same kit. */
export async function loadPeople(opts: { base?: string } = {}): Promise<PeopleKit> {
  if (!kitPromise) {
    kitPromise = buildKit(opts.base ?? '/models/').catch((err) => {
      kitPromise = null;
      throw err;
    });
  }
  return kitPromise;
}

async function buildKit(baseUrl: string): Promise<PeopleKit> {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  const [avatars, clips] = await Promise.all([
    Promise.all(VARIANTS.map((v) => loader.loadAsync(`${base}people/worker-${v}.glb`))),
    Promise.all(
      (['m-walk', 'm-idle', 'f-walk', 'f-idle'] as const).map(async (k) => [k, await loader.loadAsync(`${base}anim/${k}.glb`)] as const),
    ),
  ]);

  const templates = {} as Record<PersonVariant, Template>;
  const owned = new Set<{ dispose(): void }>();
  VARIANTS.forEach((v, i) => {
    const scene = avatars[i].scene;
    const ud = scene.userData as Partial<Template>;
    prepareTemplate(scene, owned);
    templates[v] = {
      scene,
      height: ud.height ?? 1.8,
      heightNoHelmet: ud.heightNoHelmet ?? ud.height ?? 1.8,
      hipHeight: ud.hipHeight ?? 0.9,
    };
  });

  const clipInfo = new Map<string, ClipInfo>();
  for (const [key, gltf] of clips) {
    const clip = gltf.animations[0];
    if (!clip) throw new Error(`people: ${key}.glb has no animation`);
    const ud = clip.userData as { refHipHeight?: number; speed?: number };
    clipInfo.set(key, { clip, refHipHeight: ud.refHipHeight ?? 0.9, speed: ud.speed ?? 1.3 });
  }

  // One retargeted clip per (variant, action): Bip01 translation scaled by the avatar's hip height.
  const retargeted = new Map<string, { clip: AnimationClip; speed: number }>();
  const clipFor = (variant: PersonVariant, action: PersonAction) => {
    const key = `${variant}:${action}`;
    let r = retargeted.get(key);
    if (!r) {
      const info = clipInfo.get(`${SEX[variant]}-${action}`)!;
      const ratio = templates[variant].hipHeight / info.refHipHeight;
      r = { clip: Math.abs(ratio - 1) > 1e-3 ? scaleRootTrack(info.clip, ratio) : info.clip, speed: info.speed * ratio };
      retargeted.set(key, r);
    }
    return r;
  };

  return {
    variants: VARIANTS,
    create: (o) => createPerson(o, templates[o.variant], clipFor),
    dispose() {
      owned.forEach((d) => d.dispose());
      owned.clear();
      retargeted.clear();
      kitPromise = null;
    },
  };
}

/** Material tweaks, shared skeleton per avatar and a list of GPU resources the kit owns. */
function prepareTemplate(scene: Object3D, owned: Set<{ dispose(): void }>) {
  const skinned: SkinnedMesh[] = [];
  scene.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skinned.push(mesh);
    owned.add(mesh.geometry);
    for (const m of ([] as Material[]).concat(mesh.material)) {
      owned.add(m);
      if (!(m instanceof MeshStandardMaterial)) continue;
      const t = MATERIAL_TUNING[m.name] ?? MATERIAL_TUNING.body;
      m.metalness = 0;
      m.roughness = t.roughness;
      m.envMapIntensity = t.envMapIntensity;
      for (const tex of [m.map, m.normalMap] as (Texture | null)[]) {
        if (!tex) continue;
        tex.anisotropy = 4;
        owned.add(tex);
      }
    }
  });
  shareSkeleton(skinned);
}

/** Body / Head / Helmet come from one glTF skin: let them share one Skeleton (one bone texture). */
function shareSkeleton(meshes: SkinnedMesh[]) {
  const first = meshes[0];
  if (!first) return;
  for (const m of meshes.slice(1)) {
    if (m.skeleton.bones.length === first.skeleton.bones.length && m.skeleton.bones.every((b, i) => b === first.skeleton.bones[i])) {
      m.bind(first.skeleton, m.bindMatrix);
    }
  }
}

function scaleRootTrack(clip: AnimationClip, ratio: number): AnimationClip {
  const out = clip.clone();
  out.tracks = out.tracks.map((t) => {
    if (t.name !== `${ROOT_BONE}.position` || !(t instanceof VectorKeyframeTrack)) return t;
    const values = Float32Array.from(t.values, (v) => v * ratio);
    return new VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(values));
  });
  return out;
}

function createPerson(
  o: PersonOptions,
  tpl: Template,
  clipFor: (v: PersonVariant, a: PersonAction) => { clip: AnimationClip; speed: number },
): Person {
  const root = cloneSkinned(tpl.scene);
  root.name = `person-${o.variant}`;
  const skinned: SkinnedMesh[] = [];
  let helmet: Object3D | null = null;
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skinned.push(mesh);
    mesh.castShadow = o.castShadow ?? true;
    mesh.receiveShadow = o.receiveShadow ?? false;
    mesh.frustumCulled = false; // bounds do not follow the animated pose; avoid popping at frame edges
    const matName = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name ?? '';
    if (/helmet/i.test(mesh.name) || /helmet/i.test(matName)) helmet = mesh;
  });
  shareSkeleton(skinned);

  const mixer = new AnimationMixer(root);
  const walk = clipFor(o.variant, 'walk');
  const idle = clipFor(o.variant, 'idle');
  const actions: Record<PersonAction, AnimationAction> = {
    walk: mixer.clipAction(walk.clip).setLoop(LoopRepeat, Infinity),
    idle: mixer.clipAction(idle.clip).setLoop(LoopRepeat, Infinity),
  };
  const offset = Math.max(0, o.timeOffset ?? 0);
  actions.walk.time = offset % walk.clip.duration;
  actions.idle.time = offset % idle.clip.duration;

  let current: PersonAction = o.action ?? 'idle';
  let helmetOn = o.helmet ?? true;
  let walkScale = 1;

  const applyHelmet = () => {
    if (helmet) helmet.visible = helmetOn;
  };
  const setSpeed = (mps: number) => {
    walkScale = Math.min(1.8, Math.max(0.35, mps / walk.speed));
    actions.walk.setEffectiveTimeScale(walkScale);
  };

  applyHelmet();
  if (o.speed !== undefined) setSpeed(o.speed);
  actions[current].setEffectiveWeight(1).play();

  return {
    root,
    variant: o.variant,
    get height() {
      return helmetOn && helmet ? tpl.height : tpl.heightNoHelmet;
    },
    naturalSpeed: walk.speed,
    get action() {
      return current;
    },
    setAction(a, fade = DEFAULT_FADE) {
      if (a === current) return;
      const from = actions[current];
      const to = actions[a];
      to.enabled = true;
      to.setEffectiveTimeScale(a === 'walk' ? walkScale : 1);
      to.setEffectiveWeight(1);
      if (!to.isRunning()) to.play();
      if (fade > 0) from.crossFadeTo(to, fade, false);
      else {
        from.stop();
        to.setEffectiveWeight(1);
      }
      current = a;
    },
    setHelmet(on) {
      helmetOn = on;
      applyHelmet();
    },
    setSpeed,
    update(dt) {
      mixer.update(dt);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.removeFromParent();
    },
  };
}
