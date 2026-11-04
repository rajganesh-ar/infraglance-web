import { CatmullRomCurve3, Group, Mesh, RingGeometry, Vector3 } from 'three';
import { createStage } from '../core/stage';
import { createLabels, type Label } from '../core/labels';
import { C, addEnvironment, cctv, damp, forklift, hazardZone, overlayMat, wrapPi } from '../core/kit';
import type { WorkerSpec } from './crew';
import { avoidCrew, createCast, type CastMember } from './cast';
import { floorLine, framedShot, guardFence, hydraulicPress, pad, robotArm } from './props';

/** Zones on the floor (world metres). The press base sits inside the amber zone; the robot inside the fenced red cell. */
const ZONES = [
  { id: 'press', x: -6, z: -2, w: 7.8, d: 5.8, kind: 'warn' as const, name: 'Press zone · armed' },
  { id: 'cell', x: 7, z: 1, w: 7, d: 8, kind: 'bad' as const, name: 'Robot cell · restricted' },
];

/**
 * ── People ── Rocketbox avatars (see cast.ts) in world metres (floor y = 0.12).
 * Routes keep at least 0.3 m of body clearance from the machines: press base
 * x −8.6…−4.4, z −3.9…−0.7 (light-curtain posts at z −0.45); robot reach
 * ~2.4 m around (7.5, 0.5); cell fence x 3.5…10.5, z −3…5 with its gate at
 * z 5, x 6.0–7.4; forklift lane z 8.95–12.05. p3 has no hard hat (the one PPE
 * violation), p2 walks into the robot cell through the gate (restricted-zone
 * breach), p1 walks along the front of the press inside the armed zone.
 * Order = priority on the low tier (two people).
 */
export const GUARD_ZONE_CREW: WorkerSpec[] = [
  { id: 'p3', helmet: false, variant: 'm1', speed: 1.1, phase: 0.3, route: [[-1.2, -6.3], [2.4, -6.3], [3.1, -5.5], [2.4, -4.7], [-1.2, -4.7], [-2.0, -5.5]] },
  { id: 'p2', helmet: true, variant: 'f1', speed: 1.15, phase: 0.6, route: [[-2, 6.9], [2, 6.9], [5.2, 6.9], [6.3, 6.0], [6.45, 4.1], [6.95, 4.35], [6.9, 5.9], [6.0, 7.6], [2, 7.6], [-2, 7.6], [-3.2, 7.25]] },
  { id: 'p1', helmet: true, variant: 'm2', speed: 1.2, phase: 0.05, route: [[-12.5, 4.3], [-8, 4.4], [-5, 4.4], [-2.8, 3.2], [-3.6, 0.4], [-5.6, 0.6], [-8, 2.2], [-12, 2.6], [-13.3, 3.45]] },
];
const SLAB = 0.12;

/** Guard pillar: armed press zone, fenced robot cell, tracked workers with PPE state, breach ripples, a forklift. */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 30, ao: 1.0 });
  const { scene, camera } = stage;
  addEnvironment(stage, { shadowSize: 20 }); // fog follows the shot distance (framedShot)
  // Fixed shot: no distance fade (phones pull the camera back up to 2.6x).
  const labels = createLabels(el, camera, 400);
  stage.onResize(() => labels.setSafeArea(stage.frame));
  const cast = createCast(stage);

  scene.add(pad(36, 26));
  const floor = new Group();
  floor.position.y = SLAB;
  scene.add(floor);
  for (const z of [8.6, 12.4]) {
    const l = floorLine(30);
    l.position.set(0, 0.004, z);
    floor.add(l);
  }

  const press = hydraulicPress();
  press.position.set(-6.5, 0, -2.3);
  floor.add(press);
  const robot = robotArm();
  robot.position.set(7.5, 0, 0.5);
  floor.add(robot);
  // The gate is in fence-local x: world x 6.0–7.4 on the +Z side (was given in world x, so the front was closed).
  const fence = guardFence(7, 8, [-1.0, 0.4]);
  fence.position.set(7, 0, 1);
  floor.add(fence);

  // Zone names are static context: on a phone-sized canvas they give way to the live exceptions (the tinted,
  // taped zones still show), and while someone is in a zone the person's chip names it instead.
  const zoneLabels: Label[] = [];
  let wide = true;
  const zones = ZONES.map((zd) => {
    const zone = hazardZone(zd.w, zd.d, zd.kind);
    zone.position.set(zd.x, 0, zd.z);
    floor.add(zone);
    // Press: at the zone's front-right corner (above the 6.5 m crown it projected off the top of the canvas).
    const at = zd.id === 'press' ? new Vector3(zd.x + zd.w / 2 - 0.3, 2.2, zd.z + zd.d / 2) : new Vector3(zd.x, 3.6, zd.z - 1.5);
    zoneLabels.push(labels.add(zd.name, at, new Vector3(), zd.kind));
    const ripple = new Mesh(new RingGeometry(0.55, 0.68, 56), overlayMat(zd.kind === 'bad' ? C.red : C.amber, 0));
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = 0.03;
    floor.add(ripple);
    return { ...zd, zone, ripple, rippleT: 1 };
  });
  stage.onResize((w) => (wide = w >= 520));
  const occupied = zones.map(() => false);
  const zoneAt = (x: number, z: number) => zones.findIndex((zd) => Math.abs(x - zd.x) < zd.w / 2 && Math.abs(z - zd.z) < zd.d / 2);

  // People with detection boxes sized to each person; their labels appear once they have faded in.
  const crew = cast.add(floor, GUARD_ZONE_CREW, { boxes: true });
  avoidCrew(labels, crew); // no chip (forklift proximity included) is drawn over a person or their box
  const people: { m: CastMember; lbl: Label; inside: number; dwell: number }[] = crew.members.map((m) => {
    const lbl = labels.add('', m.top, new Vector3(), 'ok');
    lbl.setVisible(false);
    return { m, lbl, inside: -1, dwell: 0 };
  });

  const fork = forklift();
  floor.add(fork);
  const forkLbl = labels.add('Forklift · 8 km/h', fork, new Vector3(0, 2.9, 0), 'warn');
  const forkPath = new CatmullRomCurve3(
    // Midpoints keep the straights straight (a 4-point Catmull-Rom loop bows ~0.9 m toward the walkway).
    [[-14, 9.5], [0, 9.5], [13, 9.5], [14.1, 10.5], [13, 11.5], [0, 11.5], [-14, 11.5], [-15.1, 10.5]].map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  const forkLen = forkPath.getLength();
  let forkU = 0;
  let forkV = 2.2;
  let forkHeading = 0;
  const tan = new Vector3();

  // Poles short enough, and far enough forward, that the heads stay inside the shot.
  for (const [x, z] of [[-15, -6], [15, -6]]) {
    const cam = cctv(5.2, 8);
    cam.position.set(x, 0, z);
    cam.rotation.y = Math.atan2(-x, -z);
    floor.add(cam);
  }

  // Frames the press crown and pole cameras at the top and the whole forklift lane at the bottom.
  // On a phone only the machines, zones and the lane in front of them need to stay in (x -10...10.5 m): the
  // empty yard and the poles at the sides may crop, so the people are larger than with the whole pad in view.
  const shot = framedShot(stage, new Vector3(0, 18.4, 31.6), new Vector3(0, 1.0, 3.7), { keep: 11.5 });

  stage.onFrame((t, dt) => {
    press.ram.position.y = 2.85 + Math.abs(Math.sin(t * 0.8)) * 0.75;
    robot.pose(t);
    forkPath.getPointAt(forkU, fork.position);
    forkPath.getTangentAt(forkU, tan);
    forkHeading += wrapPi(Math.atan2(tan.x, tan.z) - forkHeading) * (1 - Math.exp(-6 * dt));
    fork.rotation.y = forkHeading;
    fork.beacon.visible = Math.sin(t * 9) > -0.2;

    cast.tick(dt);
    crew.update(dt);
    let nearest = 99;
    let blocked = false;
    occupied.fill(false);
    for (const p of people) {
      const box = p.m.box!;
      const { x, z } = p.m.walker.pos;
      // Nobody for the forklift to react to until the people have faded in.
      const d = p.m.present ? Math.hypot(x - fork.position.x, z - fork.position.z) : 99;
      nearest = Math.min(nearest, d);
      const dx = x - fork.position.x, dz = z - fork.position.z;
      // Someone ahead and in the forklift's path: slow down.
      if (d < 4.5 && dx * tan.x + dz * tan.z > 0 && Math.abs(dx * tan.z - dz * tan.x) < 1.6) blocked = true;
      const zi = zoneAt(x, z);
      if (zi !== p.inside) {
        p.inside = zi;
        p.dwell = 0;
        if (zi >= 0 && p.m.present) {
          zones[zi].ripple.position.set(x, 0.03, z);
          zones[zi].rippleT = 0;
        }
      }
      p.dwell += dt;
      // Chips for exceptions only (zone breach, missing hard hat): a green box already says "compliant".
      if (zi >= 0) {
        if (p.m.present) occupied[zi] = true;
        box.setColor(zones[zi].kind === 'bad' ? C.red : C.amber);
        p.lbl.setText(`${zones[zi].id === 'cell' ? 'In robot cell' : 'In press zone'} · ${p.dwell.toFixed(1)} s`);
        p.lbl.setTone(zones[zi].kind);
        p.lbl.setVisible(p.m.present);
      } else if (!p.m.spec.helmet) {
        box.setColor(C.red);
        p.lbl.setText('No helmet · 0.94');
        p.lbl.setTone('bad');
        p.lbl.setVisible(p.m.present);
      } else {
        box.setColor(C.green);
        p.lbl.setVisible(false);
      }
    }
    zoneLabels.forEach((l, i) => l.setVisible(wide && !occupied[i]));
    forkV = damp(forkV, blocked ? 0.5 : 2.2, 2.5, dt);
    forkU = (forkU + (dt * forkV) / forkLen) % 1;
    const close = nearest < 4;
    forkLbl.setText(close ? `Proximity ${nearest.toFixed(1)} m` : 'Forklift · 8 km/h');
    forkLbl.setTone(close ? 'bad' : 'warn');

    for (const z of zones) {
      z.rippleT = Math.min(1, z.rippleT + dt * 0.7);
      z.ripple.scale.setScalar(1 + z.rippleT * 5);
      z.ripple.material.opacity = (1 - z.rippleT) * 0.6;
      z.zone.fill.material.opacity = 0.08 + Math.sin(t * 2.4 + z.x) * 0.03;
    }
    shot(dt, 2.5);
    labels.update(stage.size.width, stage.size.height);
  });

  await stage.warm();
  // People load after the first frame and fade in; the scene never waits for them.
  void cast.load();
  return { destroy: () => (cast.dispose(), labels.destroy(), stage.destroy()) };
}
