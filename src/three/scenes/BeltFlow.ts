import { BoxGeometry, Mesh, Object3D, PlaneGeometry, Vector3 } from 'three';
import { createStage } from '../core/stage';
import { createLabels } from '../core/labels';
import { C, M, addEnvironment, cctv, detectionBox, overlayMat, solid, thermalSpot } from '../core/kit';
import { avoidCrew, createCast } from './cast';
import { FLOW_CREW } from './crew';
import { feedHopper, floodMast, framedShot, hallBackdrop, pad, stockpile, troughedConveyor } from './props';

/** Flow pillar: bulk conveyor with an ore stream, a hot idler on thermal, belt drift, a foreign object and an operator on the service road. */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 32, ao: 1.1 });
  const { scene, camera, isMobile } = stage;
  addEnvironment(stage, { shadowSize: 22 }); // fog follows the shot distance (framedShot)
  // Fixed shot: no distance fade (phones pull the camera back up to 2.6x).
  const labels = createLabels(el, camera, 400);
  stage.onResize(() => labels.setSafeArea(stage.frame));
  const cast = createCast(stage);

  // A concrete apron under the conveyor grounds it (the yard alone fades into the section colour).
  const apron = pad(46, 17);
  apron.position.set(1, apron.position.y, 1.6);
  scene.add(apron);
  // Context: the plant building behind the conveyor and floodlight masts on the apron.
  const shed = hallBackdrop(80, 12, 7.5, 16);
  shed.position.set(0, 0, -9);
  scene.add(shed);
  for (const [x, z] of [[-17, -5.5], [16, -5.5]]) {
    const mast = floodMast(12, 3);
    mast.position.set(x, 0.12, z);
    scene.add(mast);
  }

  const L = 30, ANG = 0.16;
  const conveyor = troughedConveyor({ length: L, angle: ANG, hot: 10, ore: isMobile ? 90 : 170 });
  conveyor.position.x = -2;
  scene.add(conveyor);
  const { conv } = conveyor;
  const pile = stockpile(5, 4.2);
  pile.position.set(-2 + (L / 2) * Math.cos(ANG) + 5.2, 0, 0); // clear of the head house tower legs
  scene.add(pile);
  // Feed hopper over the loading zone (outlet 1.4 m up the belt from the tail, inside the skirt boards).
  const feed = conveyor.beltAt(-L / 2 + 1.4);
  const hopper = feedHopper(feed.y);
  hopper.position.set(-2 + feed.x, 0, 0);
  scene.add(hopper);

  // Belt-edge drift warning (on the belt, so it moves with it)
  const edgeWarn = new Mesh(new PlaneGeometry(L, 0.14), overlayMat(C.amber, 0.5));
  edgeWarn.rotation.x = -Math.PI / 2;
  edgeWarn.position.set(0, 0.36, 0.92);
  conveyor.belt.add(edgeWarn);

  // On the camera side of the belt edge, so the hot idler is not hidden under the belt.
  const hot = thermalSpot(2.2);
  hot.position.copy(conveyor.hotLocal).add(new Vector3(0, 0.05, 1.05));
  conv.add(hot);
  // The leader ends on the glow; the chip hangs below the belt, so it covers neither the belt nor the glow.
  const hotLabel = labels.add('Idler 11 · 86 °C', hot, new Vector3(), 'warn', { below: true });

  // Foreign object: a steel bar riding on the belt, boxed by the detector
  const foreign = solid(new BoxGeometry(1.3, 0.09, 0.09), M.dark());
  conv.add(foreign);
  const fBox = detectionBox(1.5, 0.4, 0.5, C.red);
  conv.add(fBox);
  let fT = 0.1;
  const foreignLabel = labels.add('Foreign object · steel bar', fBox, new Vector3(0, 0.6, 0), 'bad');
  // Drift and load are pinned to the belt (they move with it): drift at the near edge strip, load on the ore.
  const driftAt = new Object3D();
  driftAt.position.set(-6, 0.36, 0.92);
  const loadAt = new Object3D();
  loadAt.position.set(4, 0.4, 0);
  conveyor.belt.add(driftAt, loadAt);
  const driftLabel = labels.add('Belt drift +41 mm', driftAt, new Vector3(), 'warn');
  const loadLabel = labels.add('Load 1 180 t/h', loadAt, new Vector3(), 'info');
  // Phones: four chips would stack over a thin belt, so the belt-wide load figure gives way to the exceptions.
  stage.onResize((w) => loadLabel.setVisible(w >= 480));

  const cam = cctv(7, 10);
  cam.position.set(1, 0, -6.5);
  scene.add(cam);

  // An operator walking the service road beside the belt, and one watching the discharge (no boxes: Flow watches the belt).
  const crew = cast.add(scene, FLOW_CREW, { floorY: 0.12 });
  avoidCrew(labels, crew);

  const shot = framedShot(stage, new Vector3(10, 9.8, 26), new Vector3(1.5, 2.8, 0.6));

  stage.onFrame((t, dt) => {
    conveyor.tick(t, dt);
    fT = (fT + dt * 0.05) % 1;
    const fx = -L / 2 + fT * L;
    foreign.position.set(fx, 0.2, -0.25);
    foreign.rotation.y = 0.35;
    fBox.position.set(fx, 0.24, -0.25);
    const fVis = fT > 0.12 && fT < 0.88;
    fBox.visible = fVis;
    foreignLabel.setVisible(fVis);
    const heat = 0.5 + Math.sin(t * 2.2) * 0.5;
    hot.scale.setScalar(0.95 + heat * 0.1);
    hotLabel.setText(`Idler 11 · ${(83 + heat * 6).toFixed(0)} °C`);
    const drift = Math.sin(t * 0.6);
    conveyor.belt.position.z = conveyor.ore.position.z = drift * 0.08;
    edgeWarn.material.opacity = 0.15 + Math.max(0, drift) * 0.55;
    driftLabel.setText(`Belt drift ${drift > 0 ? '+' : ''}${(drift * 45).toFixed(0)} mm`);
    driftLabel.setTone(Math.abs(drift) > 0.6 ? 'warn' : 'info');
    loadLabel.setText(`Load ${(1150 + Math.sin(t * 0.8) * 60).toFixed(0)} t/h`);
    cast.tick(dt);
    crew.update(dt);
    shot(dt, 3);
    labels.update(stage.size.width, stage.size.height);
  });

  await stage.warm();
  // People load after the first frame and fade in; the scene never waits for them.
  void cast.load();
  return { destroy: () => (cast.dispose(), labels.destroy(), stage.destroy()) };
}
