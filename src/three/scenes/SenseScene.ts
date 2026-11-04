import { CircleGeometry, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { createStage } from '../core/stage';
import { createLabels } from '../core/labels';
import { C, addEnvironment, detectionBox, fatLines, thermalSpot } from '../core/kit';
import { avoidCrew, createCast } from './cast';
import { SENSE_SCENE_CREW } from './crew';
import { framedShot, pad, pipeRack, vapour } from './props';

const SLAB = 0.12;

/** Sense pillar: pipe rack with a vapour leak, an analogue gauge being read, a hot motor, a floor spill and two technicians. */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 32, ao: 1.1 });
  const { scene, camera, isMobile } = stage;
  addEnvironment(stage, { shadowSize: 18 }); // fog follows the shot distance (framedShot)
  // Fixed shot: no distance fade (phones pull the camera back up to 2.6x).
  const labels = createLabels(el, camera, 400);
  stage.onResize(() => labels.setSafeArea(stage.frame));
  const cast = createCast(stage);

  scene.add(pad(26, 16));
  const plant = pipeRack();
  plant.position.y = SLAB;
  scene.add(plant);

  const plume = vapour(isMobile ? 170 : 340, plant.leak.clone());
  plant.add(plume);
  const plumeBox = detectionBox(2.4, 3.6, 2.6, C.red);
  plumeBox.position.copy(plant.leak).add(new Vector3(0, 1.75, 1.1));
  plant.add(plumeBox);
  labels.add('Vapour · valve V-12', plumeBox, new Vector3(0, 2.0, 0), 'bad');

  // The gauge dial is something chips and leaders keep off (a leader across it reads as pointing at it).
  const gaugeTop = new Object3D();
  gaugeTop.position.copy(plant.gauge.position).add(new Vector3(0, 0.45, 0));
  plant.add(gaugeTop);
  labels.avoid(gaugeTop, () => 0.9, () => true, 0.45);
  // Kept on phones too: the analog-gauge use case shows this scene, and with the spill chip hanging below its
  // ring the reading has room above the dial.
  const gaugeLabel = labels.add('PI-204 · 6.2 bar', gaugeTop, new Vector3(0, 0.3, 0), 'info');

  const hot = thermalSpot(1.1);
  hot.position.copy(plant.motor).add(new Vector3(0.2, 0.15, 0.55));
  plant.add(hot);
  const hotLabel = labels.add('Motor M-3 · 92 °C', hot, new Vector3(0, 1.0, 0), 'warn');

  // Spill on the walkway: a wet, darker and glossier patch with a detection outline.
  const spill = new Mesh(
    new CircleGeometry(1.0, 40),
    new MeshStandardMaterial({ color: 0x59636b, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  spill.rotation.x = -Math.PI / 2;
  spill.scale.set(1.6, 0.9, 1);
  spill.position.set(-1.2, 0.015, 5.2);
  spill.receiveShadow = true;
  plant.add(spill);
  const ring: number[] = [];
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2;
    ring.push(Math.cos(a0) * 1.9, 0, Math.sin(a0) * 1.15, Math.cos(a1) * 1.9, 0, Math.sin(a1) * 1.15);
  }
  const spillRing = fatLines(ring, C.amber, 2);
  spillRing.position.set(-1.2, 0.03, 5.2);
  plant.add(spillRing);
  // Hangs below the spill, its leader up to the ring's front edge: the space above stays clear for the gauge reading.
  labels.add('Spill · walkway W2', spillRing, new Vector3(0, 0, 1.15), 'warn', { below: true });

  // A technician on rounds past the gauge and the spill, and one at the pump skid (no boxes: Sense watches the plant, not people).
  const techs = cast.add(plant, SENSE_SCENE_CREW);
  avoidCrew(labels, techs);

  const shot = framedShot(stage, new Vector3(4.6, 8.4, 21.5), new Vector3(0.4, 2.6, 0.9));

  stage.onFrame((t, dt) => {
    plume.tick(t, dt);
    const reading = 6 + Math.sin(t * 0.7) * 0.6 + Math.sin(t * 2.3) * 0.08;
    plant.gauge.set(reading);
    gaugeLabel.setText(`PI-204 · ${reading.toFixed(1)} bar`);
    const h = 0.5 + Math.sin(t * 2) * 0.5;
    hot.scale.setScalar(1.05 + h * 0.1);
    hotLabel.setText(`Motor M-3 · ${(88 + h * 6).toFixed(0)} °C`);
    spillRing.material.opacity = 0.7 + Math.sin(t * 3) * 0.3;
    cast.tick(dt);
    techs.update(dt);
    shot(dt, 3);
    labels.update(stage.size.width, stage.size.height);
  });

  await stage.warm();
  // People load after the first frame and fade in; the scene never waits for them.
  void cast.load();
  return { destroy: () => (cast.dispose(), labels.destroy(), stage.destroy()) };
}
