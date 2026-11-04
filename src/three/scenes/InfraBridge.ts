import { CatmullRomCurve3, Mesh, Object3D, PlaneGeometry, Vector3 } from 'three';
import { createStage } from '../core/stage';
import { createLabels } from '../core/labels';
import { addEnvironment, crack, paint } from '../core/kit';
import { car, drone, framedShot, trussBridge } from './props';
import { INFRA_CREW } from './crew';
import { avoidCrew, createCast } from './cast';

/**
 * Infra pillar: drone survey of a truss bridge; cracks are highlighted as the drone passes, with width
 * labels. The pilot and a bridge engineer watch from the near bank.
 */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 32, ao: 1.4 });
  const { scene, camera } = stage;
  addEnvironment(stage, { shadowSize: 34 }); // fog follows the shot distance (framedShot)
  // Fixed shot: no distance fade (phones pull the camera back up to 2.6x).
  const labels = createLabels(el, camera, 400);
  stage.onResize(() => labels.setSafeArea(stage.frame));

  const SPAN = 36;
  const bridge = trussBridge(SPAN);
  scene.add(bridge);
  const cast = createCast(stage);
  const crew = cast.add(bridge, INFRA_CREW);
  avoidCrew(labels, crew);

  // The two cracks as the Infra report's register has them (D-014 grew; D-017 is within the measurement
  // uncertainty, so "no measurable change"). At the report's 0.1 mm/px both are over the ~3 px a width needs.
  const defects = [
    { i: 0, pts: [[-0.3, 2.6], [0.1, 1.8], [-0.2, 1.0], [0.25, 0.2], [0.0, -0.8], [0.3, -1.6]] as [number, number][], text: 'Crack 3.5 ± 0.2 mm · +0.4 mm vs 2025', tone: 'bad' as const },
    { i: 1, pts: [[0.4, 2.2], [0.0, 1.5], [0.3, 0.9], [-0.2, 0.1]] as [number, number][], text: 'Crack 0.35 mm · no measurable change', tone: 'ok' as const },
  ].map((d) => {
    const p = bridge.piers[d.i];
    const c = crack(d.pts);
    c.position.set(p.x, 3.33, 2.315);
    scene.add(c);
    // The crack is an obstacle for every other chip (the survey chip rides past it with the drone); its own
    // chip is pinned to the crack's upper end, so the leader ends on the crack.
    const [x0, y0] = d.pts[0];
    const len = y0 - Math.min(...d.pts.map(([, y]) => y));
    const reach = Math.max(...d.pts.map(([x]) => Math.abs(x - x0))) + 0.2;
    const top = new Object3D();
    top.position.set(p.x + x0, 3.33 + y0, 2.4);
    scene.add(top);
    labels.avoid(top, () => len, () => true, reach);
    // A third of the way down the first segment: the very top sits right under the deck edge in this shot.
    const [x1, y1] = d.pts[1];
    const lbl = labels.add(d.text, top, new Vector3((x1 - x0) * 0.35, (y1 - y0) * 0.35, 0), d.tone);
    // Highlighted in its chip's tone while the drone images it (red for the crack that grew, green for the stable one).
    const hi = d.tone === 'bad' ? [0.83, 0.08, 0.07] : [0.05, 0.42, 0.16];
    return { c, lbl, hi, focus: new Vector3(p.x, 3.4, 2.3) };
  });
  const spall = new Mesh(new PlaneGeometry(1.3, 0.55), paint(0x9a9c9c, 1));
  spall.position.set(4, 6.95, 3.605);
  scene.add(spall);
  const spallLabel = labels.add('Spalling · 0.31 m²', spall, new Vector3(0, -0.8, 0.2), 'warn');

  const cars = [0xe9eaec, 0xaeb4b9, 0x2b3a55].map((color, i) => {
    const c = car(color);
    scene.add(c);
    return { c, off: i * 0.37, dir: i === 1 ? -1 : 1, lane: i === 1 ? -1.6 : 1.6 };
  });

  const uav = drone();
  uav.scale.setScalar(1.8); // a 1 m drone is a speck at survey-shot distance; scaled so its label points at something
  scene.add(uav);
  const progLabel = labels.add('Survey 0 %', uav, new Vector3(0, 0.8, 0), 'info');
  const path = new CatmullRomCurve3(
    [new Vector3(-16, 5, 8), new Vector3(-9, 3.2, 7), new Vector3(-2, 4, 8), new Vector3(9, 3.2, 7), new Vector3(16, 5, 8), new Vector3(12, 14, 5), new Vector3(0, 15, 6), new Vector3(-12, 14, 5)],
    true,
  );
  const look = new Vector3();
  // Phones pan a little left so the pilot and engineer on the left bank stay in frame (the right approach wall crops instead).
  const shot = framedShot(stage, new Vector3(22, 12, 36), new Vector3(0, 6, 0), { fog: [1.1, 4.2], pan: new Vector3(-4, 0, 0) });

  stage.onFrame((t, dt) => {
    const u = (t * 0.028) % 1;
    path.getPointAt(u, uav.position);
    look.set(uav.position.x, uav.position.y, 0);
    uav.lookAt(look);
    uav.rotors.forEach((r) => (r.rotation.y += dt * 30));
    progLabel.setText(`Survey ${(u * 100).toFixed(0)} % · 1 240 images`);
    for (const d of defects) {
      const k = Math.max(0, Math.min(1, 1.8 - uav.position.distanceTo(d.focus) / 5));
      d.c.material.color.setRGB(0.23 + (d.hi[0] - 0.23) * k, 0.2 + (d.hi[1] - 0.2) * k, 0.19 + (d.hi[2] - 0.19) * k);
      d.c.material.linewidth = 1.5 + k * 1.2;
      d.lbl.setVisible(k > 0.15 || u > 0.55);
    }
    spallLabel.setVisible(u > 0.25);
    for (const c of cars) {
      const p = ((t * 0.035 + c.off) % 1) * 2 - 1;
      const x = c.dir * p * (bridge.reach + 2);
      const { y, pitch } = bridge.surfaceAt(x);
      c.c.position.set(x, y, c.lane);
      c.c.rotation.set(0, c.dir > 0 ? 0 : Math.PI, c.dir > 0 ? -pitch : pitch);
      c.c.visible = Math.abs(x) < bridge.reach - 1;
    }
    crew.update(dt);
    cast.tick(dt);
    shot(dt, 4);
    labels.update(stage.size.width, stage.size.height);
  });

  await stage.warm();
  // People load after the first frame and fade in; the scene never waits for them.
  void cast.load();
  return { destroy: () => (cast.dispose(), labels.destroy(), stage.destroy()) };
}
