/**
 * Site workers as data + bodies (not a scene; shared by Journey and the pillar scenes).
 *
 * Scenes describe their workers as `WorkerSpec[]` (route, speed, PPE state,
 * avatar variant) and get bodies from an `ActorFactory`. Each walker moves at
 * constant ground speed along a closed Catmull-Rom loop with a damped heading,
 * so a real walk cycle will not foot-slide.
 *
 * Real people: scenes use createCast() from ./cast (Rocketbox avatars, async load
 * with fade-in, falling back to mannequinActor on the low tier or a failed load).
 */
import { CatmullRomCurve3, Vector3, type Object3D } from 'three';
import { blobShadow, worker, wrapPi } from '../core/kit';

export type AvatarVariant = 'm1' | 'm2' | 'f1';

export interface WorkerSpec {
  id: string;
  /** PPE state: hard hat on (drives the detection colour and label). */
  helmet: boolean;
  /** Rocketbox avatar for the people step: m1 orange vest, m2 yellow vest + radio, f1 yellow vest. */
  variant?: AvatarVariant;
  /** Closed loop of floor waypoints [x, z] in the station's local metres. One point = standing still. */
  route: [number, number][];
  /** Walking speed along the route in m/s (1.1–1.35 is a normal walk; 0 = stands). */
  speed: number;
  /** Start position along the route, 0..1. */
  phase?: number;
  /** Heading (radians, 0 = facing +Z) when standing. */
  face?: number;
}

// ---------------------------------------------------------------- crews shared by the journey and the pillar scenes
// Station-local metres (floor = slab top). Routes keep at least 0.3 m of body clearance from the props.

/** Operator beside the inspection HMI, watching parts leave the tunnel (journey inspect line). */
export const INSPECT_CREW: WorkerSpec[] = [{ id: 'op1', helmet: true, variant: 'f1', speed: 0, route: [[2.4, 3.1]], face: -2.3 }];

/**
 * Technician on a slow round of the walkway in front of the pipe rack, between the gauge and the
 * pump skid (pipeRack()-local; the journey's sense station has no spill on the walkway).
 */
export const SENSE_CREW: WorkerSpec[] = [
  { id: 't1', helmet: true, variant: 'm2', speed: 1.1, phase: 0.2, route: [[-5.5, 3.9], [-1, 4.0], [2.6, 4.1], [3.5, 4.95], [2.6, 5.8], [-1, 5.8], [-5.5, 5.7], [-6.5, 4.8]] },
];

/**
 * Sense pillar (pipeRack()-local): a technician on rounds walks past the gauge, turns at the pump
 * skid and comes back in front of the spill (never through it: the spill ring spans x −3.1…0.7,
 * z 4.05…6.35; gauge post at (−2, 2.9); skid x 4.2…7.8, z 3.3…4.7); a second one stands at the
 * end of the skid with the hot motor in view.
 */
export const SENSE_SCENE_CREW: WorkerSpec[] = [
  { id: 't1', helmet: true, variant: 'm2', speed: 1.1, phase: 0.08, route: [[-9, 3.55], [-4.5, 3.6], [-0.6, 3.55], [2.5, 3.35], [3.45, 4.6], [2.6, 6.9], [-1.2, 7.15], [-5, 7.0], [-9, 6.7], [-10.3, 5.1]] },
  { id: 't2', helmet: true, variant: 'f1', speed: 0, route: [[8.75, 3.2]], face: -1.9 },
];

/**
 * Flow pillar (world metres, on the 0.12 m apron): an operator walks the service road on the walkway side
 * of the conveyor, clear of the trestle feet (z ≤ 1.3) and well short of the stockpile (x ≥ 12.4).
 */
export const FLOW_CREW: WorkerSpec[] = [
  { id: 'f1', helmet: true, variant: 'm2', speed: 1.1, phase: 0.35, route: [[-13, 3.3], [-4, 3.4], [5, 3.4], [7.6, 4.0], [5, 4.65], [-4, 4.65], [-13, 4.55], [-14.3, 3.9]] },
  { id: 'f2', helmet: true, variant: 'm1', speed: 0, route: [[9.4, 4.4]], face: -2.0 },
];

/**
 * Infra (trussBridge()-local metres, ground y = 0): the drone pilot and a bridge engineer on the near left
 * bank, between the riprap (x ≥ −10.3) and the abutment (x ≤ −16.3), well in front of the flight line along
 * the piers (z 7–9 at 3–5 m up), both turned toward the left pier the drone is surveying.
 */
export const INFRA_CREW: WorkerSpec[] = [
  { id: 'd1', helmet: true, variant: 'm2', speed: 0, route: [[-11.1, 11.5]], face: 2.8 },
  { id: 'd2', helmet: true, variant: 'f1', speed: 0, route: [[-12.4, 12.3]], face: 2.6 },
];

/** Inspect pillar (world metres): an operator stands at the inspection cell, clear of the plinth (r 4.3) and gantry legs. */
export const INSPECT_CELL_CREW: WorkerSpec[] = [{ id: 'op1', helmet: true, variant: 'f1', speed: 0, route: [[6.0, 1.7]], face: -1.85 }];

/** A body that can walk: root origin at the feet, facing +Z, 1.75 m tall. */
export interface Actor {
  root: Object3D;
  setHelmet(on: boolean): void;
  /** Ground speed in m/s (0 = idle). */
  setGait(mps: number): void;
  update(dt: number): void;
}
export type ActorFactory = (spec: WorkerSpec) => Actor;

/** Procedural fallback figure with a simple, speed-matched gait (stride 1.4 m per cycle). */
export const mannequinActor: ActorFactory = (spec) => {
  const w = worker({ helmet: spec.helmet });
  let phase = Math.random() * Math.PI * 2;
  let v = 0;
  let amp = 0;
  return {
    root: w,
    setHelmet: (on) => void (w.hat.visible = on),
    setGait: (mps) => void (v = mps),
    update(dt) {
      amp += (Math.min(1, v / 1.2) - amp) * (1 - Math.exp(-6 * dt));
      phase += dt * ((Math.PI * 2 * v) / 1.4);
      const s = Math.sin(phase);
      w.legs[0].rotation.x = s * 0.42 * amp;
      w.legs[1].rotation.x = -s * 0.42 * amp;
      w.arms[0].rotation.x = -s * 0.3 * amp;
      w.arms[1].rotation.x = s * 0.3 * amp;
    },
  };
};

export interface Walker {
  spec: WorkerSpec;
  actor: Actor;
  /** Current feet position in the parent's local space. */
  pos: Vector3;
  heading: number;
  /** Multiplier on the spec speed (0 = wait, e.g. yielding to a forklift). */
  speedScale: number;
  /** Position a little ahead on the route (for yielding checks). */
  ahead(dist: number, out: Vector3): Vector3;
  update(dt: number): void;
}

/**
 * Puts an actor on its route. `floorY` is the height of the floor it walks on
 * (e.g. a 0.12 m slab). Adds a soft contact shadow under the feet.
 */
export function createWalker(spec: WorkerSpec, make: ActorFactory, parent: Object3D, floorY = 0): Walker {
  const actor = make(spec);
  parent.add(actor.root);
  const shadow = blobShadow(0.85, 0.85, 0.3);
  parent.add(shadow);
  const pts = spec.route.map(([x, z]) => new Vector3(x, 0, z));
  const curve = pts.length > 1 ? new CatmullRomCurve3(pts, true, 'centripetal') : null;
  const len = curve ? curve.getLength() : 1;
  let u = spec.phase ?? 0;
  const pos = new Vector3();
  const tan = new Vector3();
  let heading = spec.face ?? 0;
  let gait = 0;
  if (curve) {
    curve.getPointAt(u, pos);
    curve.getTangentAt(u, tan);
    heading = Math.atan2(tan.x, tan.z);
  } else pos.copy(pts[0]);

  const walker: Walker = {
    spec,
    actor,
    pos,
    get heading() {
      return heading;
    },
    speedScale: 1,
    ahead(dist, out) {
      if (!curve) return out.copy(pos);
      return curve.getPointAt((u + dist / len) % 1, out);
    },
    update(dt) {
      const target = curve ? spec.speed * walker.speedScale : 0;
      gait += (target - gait) * (1 - Math.exp(-5 * dt)); // ease in/out of stops
      if (curve) {
        u = (u + (dt * gait) / len) % 1;
        curve.getPointAt(u, pos);
        curve.getTangentAt(u, tan);
        heading += wrapPi(Math.atan2(tan.x, tan.z) - heading) * (1 - Math.exp(-8 * dt));
      }
      actor.root.position.set(pos.x, floorY, pos.z);
      actor.root.rotation.y = heading;
      shadow.position.set(pos.x, floorY + 0.012, pos.z);
      actor.setGait(gait);
      actor.update(dt);
    },
  } as Walker;
  walker.update(0);
  return walker;
}
