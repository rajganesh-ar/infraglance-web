/**
 * Real people for the 3D scenes (not a scene): the rigged Microsoft Rocketbox
 * avatars from core/people.ts (MIT, see /credits) on the crew.ts walkers.
 *
 * - The scene renders at once with nobody in it; `load()` (called after the
 *   first frame) fetches the avatars in the background, compiles their shaders
 *   off the main thread, then fades everyone in. If loading fails, the
 *   procedural kit.worker() figure is used instead and one warning is logged.
 * - Walkers keep a constant ground speed (1.1–1.35 m/s), slow down for tight
 *   turns and to give way, and the walk clip's cadence follows that speed, so
 *   feet do not slide. Below ~0.3 m/s a walker cross-fades to the idle clip.
 * - Optional detection boxes are sized to each person's real height (with or
 *   without the hard hat), turn with them, and deepen with the stride.
 * - Low tier: at most two people per scene, and no shadow-map shadows from
 *   people (the soft contact shadow stays on every tier).
 *
 * Units are metres everywhere: avatars stand 1.74–1.84 m, next to a 2.2 m
 * forklift guard, 5.4 m racking and a 6.5 m press.
 */
import {
  Group,
  HalfFloatType,
  Object3D,
  Vector3,
  WebGLRenderTarget,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type Skeleton,
  type SkinnedMesh,
  type Texture,
} from 'three';
import type { Stage } from '../core/stage';
import type { Labels } from '../core/labels';
import type { PeopleKit, Person } from '../core/people';
import { C, detectionBox, smooth } from '../core/kit';
import { createWalker, mannequinActor, type Actor, type Walker, type WorkerSpec } from './crew';

type DetectionBox = ReturnType<typeof detectionBox>;

/** Walk ↔ idle switch points (m/s), with hysteresis. */
const IDLE_BELOW = 0.28;
const WALK_ABOVE = 0.45;
const FADE_S = 0.7;
/** Detection box: shoulder width plus arm swing; depth standing vs mid-stride; head-room above the hard hat. */
const BOX_W = 0.7;
const BOX_D_IDLE = 0.44;
const BOX_D_WALK = 0.82;
const BOX_PAD = 0.05;
/** Label anchor height above the box top. */
const LABEL_GAP = 0.28;
const FALLBACK_H = 1.78;

let warned = false;

export interface CastMember {
  readonly spec: WorkerSpec;
  readonly walker: Walker;
  /** Status box around the person (crews added with `boxes`), else null. */
  readonly box: DetectionBox | null;
  /** Label anchor just above the box / head; follows the person. */
  readonly top: Object3D;
  /** Hold position (e.g. give way to a forklift): eases to a stop and idles. */
  wait: boolean;
  /** True once the body is in and fading or faded in (gate labels on this). */
  readonly present: boolean;
  /** Present and its crew not hidden (label chips avoid the person while true). */
  readonly shown: boolean;
  /** Standing height in metres of the current body (1.78 until it loads). */
  readonly height: number;
  /** Current ground speed in m/s. */
  readonly speed: number;
}

export interface Crew {
  readonly members: CastMember[];
  /** Moves, animates and boxes every member; call from the station's tick. */
  update(dt: number): void;
  /** Shows or hides the whole crew (skinned meshes are never frustum-culled, so hide far stations). */
  setVisible(on: boolean): void;
}

export interface CrewOptions {
  /** Floor height in the parent's space (default 0). */
  floorY?: number;
  /** Draw a status box around each person: green with a hard hat, red without. */
  boxes?: boolean;
}

export interface Cast {
  /** Adds walkers under `parent` (station-local metres). Members past the tier budget are skipped. */
  add(parent: Object3D, specs: WorkerSpec[], opts?: CrewOptions): Crew;
  /** Loads the avatars and fades them in; falls back to simple figures on error. Never rejects. */
  load(): Promise<void>;
  /** Advances the fade-in; call once per frame. */
  tick(dt: number): void;
  /** Stops mixers, frees per-person skeletons and detaches the bodies (shared avatar assets stay cached). */
  dispose(): void;
}

interface Member extends CastMember {
  walker: Walker;
  box: DetectionBox | null;
  group: Group;
  holder: Group;
  blob: Mesh | null;
  body: Actor | null;
  person: Person | null;
  crew: CrewState;
  floorY: number;
  gait: number;
  h: number;
  depth: number;
}

interface CrewState {
  visible: boolean;
}

type State = 'idle' | 'loading' | 'fading' | 'done';

/** Keeps label chips off these people and their boxes (feet to just above the head or hard hat). */
export function avoidCrew(labels: Labels, crew: Crew) {
  for (const m of crew.members) labels.avoid(m.top, () => m.height + BOX_PAD + LABEL_GAP, () => m.shown);
}

export function createCast(stage: Stage, opts: { budget?: number } = {}): Cast {
  const budget = opts.budget ?? (stage.tier === 'low' ? 2 : Infinity);
  const shadows = stage.tier !== 'low';
  const blobOpacity = shadows ? 0.22 : 0.3;
  const all: Member[] = [];
  const fadeMats = new Set<Material>();
  const skinned: SkinnedMesh[] = [];
  let state: State = 'idle';
  let fade = 0;
  let shadowsOn = false;
  let destroyed = false;
  let loading: Promise<void> | null = null;
  const a1 = new Vector3();
  const a2 = new Vector3();

  const showing = () => state === 'fading' || state === 'done';
  const applyVisibility = (m: Member) => {
    const on = m.crew.visible && showing();
    m.group.visible = on;
    if (m.box) m.box.visible = on;
  };

  /** Box, label anchor: sized to the body, turned with it, deeper in mid-stride. */
  const place = (m: Member, dt: number) => {
    const { pos, heading } = m.walker;
    const h = m.h + BOX_PAD;
    const stride = Math.min(1, m.gait / 1.2);
    m.depth += (BOX_D_IDLE + (BOX_D_WALK - BOX_D_IDLE) * stride - m.depth) * (1 - Math.exp(-6 * dt));
    if (m.box) {
      m.box.position.set(pos.x, m.floorY + h / 2, pos.z);
      m.box.rotation.y = heading;
      m.box.scale.set(BOX_W, h, m.depth);
    }
    m.top.position.set(pos.x, m.floorY + h + LABEL_GAP, pos.z);
  };

  /** 1 on straights, down to 0.4 in a hairpin: people slow for tight turns. */
  const turnFactor = (m: Member) => {
    const p = m.walker.pos;
    m.walker.ahead(0.7, a1);
    m.walker.ahead(1.4, a2);
    const ux = a1.x - p.x, uz = a1.z - p.z, vx = a2.x - a1.x, vz = a2.z - a1.z;
    const turn = Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz));
    return Math.max(0.4, 1 - turn * 0.55);
  };

  function add(parent: Object3D, specs: WorkerSpec[], o: CrewOptions = {}): Crew {
    const crew: CrewState = { visible: true };
    const members: Member[] = [];
    const floorY = o.floorY ?? 0;
    for (const spec of specs) {
      if (all.length >= budget) break;
      // One group per person holds the body and its contact shadow, so both stay hidden until the body is in.
      const group = new Group();
      group.name = `crew-${spec.id}`;
      group.visible = false;
      parent.add(group);
      const holder = new Group();
      const top = new Object3D();
      parent.add(top);
      let box: DetectionBox | null = null;
      if (o.boxes) {
        box = detectionBox(1, 1, 1, spec.helmet ? C.green : C.red);
        box.visible = false;
        box.material.opacity = 0;
        parent.add(box);
      }
      const m = {
        spec,
        walker: null as unknown as Walker,
        box,
        top,
        wait: false,
        group,
        holder,
        blob: null,
        body: null,
        person: null,
        crew,
        floorY,
        gait: 0,
        h: FALLBACK_H,
        depth: BOX_D_IDLE,
        get present() {
          return state === 'done' || (state === 'fading' && fade > 0.35);
        },
        get shown() {
          return m.present && m.crew.visible;
        },
        get height() {
          return m.h;
        },
        get speed() {
          return m.gait;
        },
      } as Member;
      // The walker drives this stand-in; the real body is plugged in when it arrives.
      const actor: Actor = {
        root: holder,
        setHelmet: (on) => m.body?.setHelmet(on),
        setGait: (v) => {
          m.gait = v;
          m.body?.setGait(v);
        },
        update: (dt) => m.body?.update(dt),
      };
      m.walker = createWalker(spec, () => actor, group, floorY);
      m.blob = (group.children.find((c) => c !== holder) as Mesh | undefined) ?? null;
      if (m.blob) (m.blob.material as MeshBasicMaterial).opacity = 0;
      place(m, 1);
      members.push(m);
      all.push(m);
    }
    return {
      members,
      update(dt) {
        for (const m of members) {
          m.walker.speedScale = m.wait ? 0 : m.spec.speed > 0 ? turnFactor(m) : 1;
          m.walker.update(dt);
          place(m, dt);
        }
      },
      setVisible(on) {
        if (crew.visible === on) return;
        crew.visible = on;
        members.forEach(applyVisibility);
      },
    };
  }

  function attachPerson(kit: PeopleKit, m: Member) {
    let walking = m.gait > WALK_ABOVE;
    const p = kit.create({
      variant: m.spec.variant ?? 'm2',
      action: walking ? 'walk' : 'idle',
      helmet: m.spec.helmet,
      castShadow: false, // switched on half-way through the fade (never on the low tier)
      timeOffset: Math.random() * 8,
      speed: walking ? m.gait : undefined,
    });
    m.holder.add(p.root);
    m.person = p;
    m.h = p.height;
    p.root.traverse((o) => {
      const s = o as SkinnedMesh;
      if (!s.isSkinnedMesh) return;
      skinned.push(s);
      ([] as Material[]).concat(s.material).forEach((mat) => fadeMats.add(mat));
    });
    m.body = {
      root: p.root,
      setHelmet: (on) => {
        p.setHelmet(on);
        m.h = p.height;
      },
      setGait: (v) => {
        if (!walking && v > WALK_ABOVE) {
          walking = true;
          p.setAction('walk', 0.3);
        } else if (walking && v < IDLE_BELOW) {
          walking = false;
          p.setAction('idle', 0.45);
        }
        if (walking) p.setSpeed(v);
      },
      update: (dt) => p.update(dt),
    };
  }

  function attachFallback(m: Member) {
    const a = mannequinActor(m.spec);
    m.holder.add(a.root);
    m.body = a;
    m.h = (a.root as Object3D & { height?: number }).height ?? FALLBACK_H;
    a.setGait(m.gait);
  }

  /**
   * The shared avatar materials fade in the transparent pass and stay there at opacity 1. Their
   * textures have no alpha and once faded in they write depth, so they look exactly as opaque;
   * switching back would swap shader programs mid-scroll (measured: a 36 ms frame on ANGLE / D3D11).
   * While fading they do not write depth: an invisible body in the depth buffer shows up as a pale
   * ghost (ambient occlusion and overlays behind it are cut out around its silhouette).
   * depthWrite is render state, not a shader define, so toggling it costs nothing.
   */
  const setOpacity = (a: number) =>
    fadeMats.forEach((mat) => {
      mat.opacity = a;
      mat.depthWrite = a >= 1;
    });

  /** The same variants the scene draws with (linear output into the post chain's target), off the main thread. */
  const compile = async () => {
    if (destroyed) return;
    await stage.compile();
  };

  const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

  /** Uploads the avatar textures one per frame, so the first visible frame does not upload them all (~90 ms). */
  async function upload() {
    const textures = new Set<Texture>();
    for (const mat of fadeMats) for (const v of Object.values(mat)) if ((v as Texture | null)?.isTexture) textures.add(v as Texture);
    for (const t of textures) {
      if (destroyed) return;
      stage.renderer.initTexture(t);
      await nextFrame();
    }
  }

  /**
   * Draws every person once, still at opacity 0, into a tiny offscreen target. The first draw of a
   * skinned, quantized mesh is slow on some drivers (ANGLE builds vertex variants at draw time), and
   * here it happens while nobody can see it: not mid-scroll when a far station comes into view.
   * Where people will cast shadows, this draw also renders the shadow map with them casting, so the
   * skinned shadow-depth program is built here and not when shadows switch on half-way through the fade.
   */
  function prewarm() {
    const { renderer, scene, camera } = stage;
    const rt = new WebGLRenderTarget(16, 16, { type: HalfFloatType, depthBuffer: true });
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.shadowMap.autoUpdate;
    const hidden = all.filter((m) => !m.group.visible);
    hidden.forEach((m) => (m.group.visible = true));
    const warmShadows = shadows && renderer.shadowMap.enabled && !shadowsOn;
    try {
      // The next real frame redraws the shadow map without them (they are hidden until the fade).
      renderer.shadowMap.autoUpdate = warmShadows;
      if (warmShadows) skinned.forEach((s) => (s.castShadow = true));
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
    } catch {
      /* best effort */
    } finally {
      if (warmShadows) skinned.forEach((s) => (s.castShadow = false));
      renderer.setRenderTarget(prevTarget);
      renderer.shadowMap.autoUpdate = prevAuto;
      hidden.forEach((m) => (m.group.visible = false));
      rt.dispose();
    }
  }

  async function run() {
    try {
      const { loadPeople } = await import('../core/people');
      const kit = await loadPeople();
      if (destroyed) return;
      all.forEach((m) => attachPerson(kit, m));
      for (const mat of fadeMats) {
        mat.transparent = true;
        mat.needsUpdate = true;
      }
      setOpacity(0);
      await compile();
      if (destroyed) return;
      await upload();
      if (destroyed) return;
      prewarm();
      await nextFrame();
      if (destroyed) return;
      fade = 0;
      state = 'fading';
    } catch (err) {
      if (destroyed) return;
      if (!warned) {
        warned = true;
        console.warn('[3d] Animated people unavailable; showing simple figures instead.', err);
      }
      setOpacity(1);
      fadeMats.clear();
      skinned.length = 0;
      for (const m of all) {
        m.person?.dispose();
        m.person = null;
        m.holder.clear();
        attachFallback(m);
      }
      await compile();
      if (destroyed) return;
      fade = 1;
      state = 'done';
      for (const m of all) {
        if (m.blob) (m.blob.material as MeshBasicMaterial).opacity = blobOpacity;
        if (m.box) m.box.material.opacity = 1;
      }
    }
    all.forEach(applyVisibility);
  }

  return {
    add,
    load() {
      if (!loading) {
        state = 'loading';
        loading = all.length ? run() : Promise.resolve();
      }
      return loading;
    },
    tick(dt) {
      if (state !== 'fading') return;
      fade = Math.min(1, fade + dt / FADE_S);
      const a = smooth(fade);
      setOpacity(a);
      if (shadows && !shadowsOn && fade > 0.5) {
        shadowsOn = true;
        skinned.forEach((s) => (s.castShadow = true));
      }
      for (const m of all) {
        if (m.blob) (m.blob.material as MeshBasicMaterial).opacity = blobOpacity * a;
        if (m.box) m.box.material.opacity = a;
      }
      if (fade >= 1) state = 'done';
    },
    dispose() {
      destroyed = true;
      // The avatar materials are shared with the next mount: leave them fully visible.
      setOpacity(1);
      // After a context loss their GPU copies died with the old context: disposing then only unhooks
      // three's records, quietly (scenes dispose the cast before the stage).
      stage.releaseLostContext();
      // Free this renderer's copies of the shared avatar geometry, materials and textures (they stay
      // cached CPU-side and upload again on a remount), plus each person's bone texture.
      const gpu = new Set<{ dispose(): void }>();
      for (const s of skinned) {
        gpu.add(s.skeleton as Skeleton);
        gpu.add(s.geometry);
        for (const mat of ([] as Material[]).concat(s.material)) {
          gpu.add(mat);
          for (const v of Object.values(mat)) if ((v as Texture | null)?.isTexture) gpu.add(v as Texture);
        }
      }
      for (const m of all) {
        m.person?.dispose();
        m.person = null;
      }
      gpu.forEach((r) => r.dispose());
    },
  };
}
