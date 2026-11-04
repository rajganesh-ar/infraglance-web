import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  Line,
  LineLoop,
  LineSegments,
  Mesh,
  NormalBlending,
  Object3D,
  Points,
  PointsMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createStage } from '../core/stage';
import { createLabels, type Label } from '../core/labels';
import { C, M, addEnvironment, led, lineMat, paint, softDot, solid } from '../core/kit';

/** Platform page: data flows from cameras → Glance Edge boxes → Glance Hub → apps, as a light "blueprint" model. */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 34, ao: 0.9 });
  const { scene, camera, isMobile } = stage;
  addEnvironment(stage, { fog: false, ground: false, shadowSize: 34 });
  const labels = createLabels(el, camera, 400);
  stage.onResize(() => labels.setSafeArea(stage.frame)); // never under the page's legend row

  const root = new Group();
  scene.add(root);

  // Hub core: faceted white body, cyan edges, two orbit rings
  const hub = new Group();
  hub.position.set(8, 0, 0);
  const coreGeo = new IcosahedronGeometry(2.6, 1);
  const core = new Mesh(coreGeo, paint(0xf4f6f8, 0.45));
  (core.material as ReturnType<typeof paint>).flatShading = true;
  core.castShadow = core.receiveShadow = true;
  const coreEdges = new LineSegments(new EdgesGeometry(coreGeo), lineMat(C.cyan, 0.6));
  const ring1 = new Mesh(new TorusGeometry(4.2, 0.035, 8, 120), led(0x0891b2, 0.8));
  // Outer orbit as a 1 px line like the data paths: a thin tube was sub-pixel at this distance and rendered
  // as a broken, dotted dark ellipse (and a metal one mirrored the dark lower sky as a black slash).
  const ring2 = new LineLoop(
    new BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => new Vector3(Math.cos((i / 160) * Math.PI * 2) * 4.9, Math.sin((i / 160) * Math.PI * 2) * 4.9, 0))),
    lineMat(0x7d8b99, 0.7),
  );
  ring1.rotation.x = Math.PI / 2.3;
  ring2.rotation.y = Math.PI / 2.6;
  const spin = new Group();
  spin.add(core, coreEdges);
  hub.add(spin, ring1, ring2);
  root.add(hub);
  labels.add('Glance Hub', hub, new Vector3(0, 5.8, 0), 'info');

  // Cameras (left arc): white housings with dark lenses, aimed at the edge column
  const camCount = isMobile ? 8 : 12;
  const cams: Vector3[] = [];
  const housing = new RoundedBoxGeometry(1.3, 0.62, 0.62, 2, 0.1);
  const lensGeo = new CylinderGeometry(0.2, 0.2, 0.08, 18).rotateZ(Math.PI / 2);
  for (let i = 0; i < camCount; i++) {
    const a = (i / (camCount - 1) - 0.5) * Math.PI * 0.85;
    const p = new Vector3(-22 + Math.cos(a) * -3, Math.sin(a) * 10.5, Math.cos(a * 2) * 3);
    const c = new Group();
    c.add(solid(housing, M.white()));
    const lens = solid(lensGeo, M.dark());
    lens.position.x = 0.68;
    c.add(lens);
    c.position.copy(p);
    c.lookAt(-8, p.y * 0.5, 0);
    c.rotateY(-Math.PI / 2);
    root.add(c);
    cams.push(p);
    // The source column's chip points at its top camera.
    if (i === camCount - 1) labels.add('Cameras · thermal · drones', c, new Vector3(0, 0.45, 0), 'info');
  }

  // Edge boxes: dark appliances with a status LED strip
  const edges: Vector3[] = [new Vector3(-8, 7, 1), new Vector3(-8, 0, -1), new Vector3(-8, -7, 1)];
  const edgeGeo = new RoundedBoxGeometry(3, 1.1, 2.2, 2, 0.08);
  const ledGeo = new BoxGeometry(1.2, 0.06, 0.02);
  edges.forEach((p, i) => {
    const e = new Group();
    e.add(solid(edgeGeo, M.dark()));
    const strip = new Mesh(ledGeo, M.greenLed());
    strip.position.set(-0.5, 0.2, 1.11);
    e.add(strip);
    e.position.copy(p);
    root.add(e);
    // Chips (PLC / SCADA on a phone) keep off the three boxes; the first box's own chip is pinned to its top.
    const top = new Object3D();
    top.position.y = 0.55;
    e.add(top);
    labels.avoid(top, () => 1.1, () => true, 1.6);
    if (i === 0) labels.add('Glance Edge', top, new Vector3(0, 0.75, 0), 'ok');
  });
  const plc = new Group();
  plc.add(solid(new RoundedBoxGeometry(2, 2.4, 1.2, 2, 0.06), M.body()));
  const door = new Mesh(new BoxGeometry(0.02, 2.0, 0.02), M.body2());
  door.position.set(0, 0, 0.61);
  plc.add(door);
  plc.position.set(-2, -12, 0);
  root.add(plc);
  labels.add('PLC / SCADA', plc, new Vector3(0, 1.7, 0), 'warn');

  // Apps (right column): white tiles with a pillar-coloured face stripe
  const appLabels: Label[] = [];
  const apps = [
    { name: 'Guard', c: 0xb45309 },
    { name: 'Inspect', c: 0x0b7f99 },
    { name: 'Flow', c: 0x1d5fd1 },
    { name: 'Sense', c: 0x0f766e },
    { name: 'Infra', c: 0x15803d },
  ].map((a, i) => {
    const p = new Vector3(24, 8 - i * 4.2, 0);
    const g = new Group();
    g.add(solid(new RoundedBoxGeometry(4.4, 1.2, 1.2, 2, 0.08), M.white()));
    const stripe = new Mesh(new BoxGeometry(0.16, 1.2, 0.02), paint(a.c, 0.5));
    stripe.position.set(-2.0, 0, 0.61);
    g.add(stripe);
    g.position.copy(p);
    root.add(g);
    appLabels.push(labels.add(a.name, g, new Vector3(0, 1.0, 0), 'info'));
    return p;
  });
  // Phones: five stacked chips would cover the tiles, so the column gets one label instead.
  const appsAnchor = new Group();
  appsAnchor.position.set(24, 9.6, 0);
  root.add(appsAnchor);
  const appsLabel = labels.add('Apps · 5 pillars', appsAnchor, new Vector3(), 'info');

  // Paths
  const paths: CatmullRomCurve3[] = [];
  cams.forEach((p, i) => {
    const e = edges[Math.min(2, Math.floor((i / camCount) * 3))];
    paths.push(new CatmullRomCurve3([p, p.clone().lerp(e, 0.5).add(new Vector3(0, 0, 3)), e, e.clone().lerp(hub.position, 0.5).add(new Vector3(0, 2, -2)), hub.position.clone()]));
  });
  paths.push(new CatmullRomCurve3([plc.position.clone(), new Vector3(3, -6, 2), hub.position.clone()]));
  apps.forEach((a) => paths.push(new CatmullRomCurve3([hub.position.clone(), hub.position.clone().lerp(a, 0.5).add(new Vector3(0, 0, 3)), a])));
  const pathMat = lineMat(0x94a3b8, 0.55);
  paths.forEach((curve) => root.add(new Line(new BufferGeometry().setFromPoints(curve.getPoints(48)), pathMat)));

  // Packets (normal-blended, readable on white)
  const PER = isMobile ? 3 : 5;
  const total = paths.length * PER;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const offs = Array.from({ length: total }, () => Math.random());
  const speeds = Array.from({ length: total }, () => 0.08 + Math.random() * 0.08);
  const cyan = [0.0, 0.29, 0.43]; // #0891b2 in linear
  const teal = [0.0, 0.18, 0.15]; // #0f766e in linear
  for (let i = 0; i < total; i++) colors.set(Math.floor(i / PER) >= cams.length + 1 ? teal : cyan, i * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  const packets = new Points(geo, new PointsMaterial({ size: 0.9, map: softDot(0.55), vertexColors: true, transparent: true, depthWrite: false, blending: NormalBlending }));
  packets.frustumCulled = false;
  root.add(packets);
  const tmp = new Vector3();
  // Fit the whole model (x −25.5…26.4 m, near cameras at z +3 and the ±0.1 rad sway included; y −13.2…14 m with
  // its top label) into the free area below the page's legend row. On a phone the width decides, and the whole
  // source column stays in: it is the first step of the flow.
  let base = 54;
  const lookX = 0.45;
  stage.onResize((w, h) => {
    const f = stage.frame;
    const narrow = w < 640;
    const tv = Math.tan((camera.fov * Math.PI) / 360);
    const fitH = 13.8 / (tv * (Math.max(1, f.bottom - f.top) / h));
    const fitW = 26.5 / (tv * (w / h));
    base = Math.max(fitH, fitW) * 1.06;
    appLabels.forEach((l) => l.setVisible(!narrow));
    appsLabel.setVisible(narrow);
    const offY = (f.top + f.bottom) / 2 - h / 2;
    if (Math.abs(offY) >= 1) camera.setViewOffset(w, h, 0, -offY, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });

  stage.onFrame((t, dt) => {
    for (let i = 0; i < total; i++) {
      offs[i] = (offs[i] + dt * speeds[i]) % 1;
      paths[Math.floor(i / PER)].getPoint(offs[i], tmp);
      positions[i * 3] = tmp.x;
      positions[i * 3 + 1] = tmp.y;
      positions[i * 3 + 2] = tmp.z;
    }
    geo.attributes.position.needsUpdate = true;
    spin.rotation.y = t * 0.3;
    spin.rotation.x = t * 0.15;
    ring1.rotation.z = t * 0.4;
    ring2.rotation.x = t * 0.25;
    root.rotation.y = Math.sin(t * 0.15) * 0.1 + stage.pointer.x * 0.1;
    root.rotation.x = stage.pointer.y * -0.05;
    camera.position.set(lookX, 6.4, base);
    camera.lookAt(lookX, 0.4, 0);
    labels.update(stage.size.width, stage.size.height);
  });

  await stage.warm();
  return { destroy: () => (labels.destroy(), stage.destroy()) };
}
