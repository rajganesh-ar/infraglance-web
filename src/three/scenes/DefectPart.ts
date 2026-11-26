import { CircleGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, Object3D, RingGeometry, TorusGeometry, Vector2, Vector3, BoxGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createStage } from '../core/stage';
import { createLabels } from '../core/labels';
import { C, M, addEnvironment, bake, led, overlayMat, solid } from '../core/kit';
import { avoidCrew, createCast } from './cast';
import { INSPECT_CELL_CREW } from './crew';
import { appMonitor, framedShot, hallBackdrop, meshGuarding } from './props';

// Ashima 3D simplex noise (MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/** Anomaly / ΔE overlay computed in object space; mixed into a lit, machined-steel PBR material. */
const OVERLAY = /* glsl */ `
uniform float uScan; uniform float uMode;
varying vec3 vObj;
${NOISE}
vec3 igJet(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.12, 0.35, 0.85), b = vec3(0.1, 0.75, 0.8), c = vec3(0.98, 0.8, 0.15), d = vec3(0.86, 0.15, 0.12);
  return t < 0.33 ? mix(a, b, t / 0.33) : t < 0.66 ? mix(b, c, (t - 0.33) / 0.33) : mix(c, d, (t - 0.66) / 0.34);
}
float igScanned() { return step(uScan, vObj.y); }
float igBand() { return smoothstep(0.06, 0.0, abs(vObj.y - uScan)); }
vec4 igOverlay() {
  float ang = atan(vObj.z, vObj.x);
  // Anomaly map: one localised blob around one scratch on the hub (where the label points), on a faint
  // cool tint elsewhere. A noise field read as confetti (a noisy detector), so the heat is a single
  // falloff around the defect with a little noise only to break the edge.
  vec3 defect = vec3(1.42 * cos(0.34), 0.35, 1.42 * sin(0.34));
  float d = length(vec3(vObj.x - defect.x, (vObj.y - defect.y) * 1.4, vObj.z - defect.z));
  float edge = snoise(vObj * 1.1 + vec3(3.1, 0.0, 1.7)) * 0.14;
  float blob = smoothstep(1.3 + edge, 0.2, d);
  float scratch = smoothstep(0.06, 0.0, abs(vObj.y - 0.35 - sin(ang * 3.0) * 0.08)) * smoothstep(0.75, 0.2, d);
  float a = max(blob * 0.85, scratch);
  vec4 anomaly = vec4(mix(vec3(0.55, 0.8, 0.92), igJet(a), smoothstep(0.05, 0.3, a)), 0.08 + smoothstep(0.08, 0.35, a) * 0.78);
  // ΔE map: banded green / amber / red with thin contours.
  float de = (snoise(vObj * 0.45 + vec3(0.0, 1.0, 2.0)) * 0.5 + 0.5) * 3.2;
  vec3 dc = de < 1.0 ? vec3(0.09, 0.64, 0.29) : de < 2.0 ? vec3(0.85, 0.47, 0.02) : vec3(0.86, 0.15, 0.15);
  float contour = smoothstep(0.08, 0.0, abs(fract(de * 2.0) - 0.5) - 0.42);
  vec4 delta = vec4(mix(dc, vec3(0.08), contour * 0.6), 0.6);
  return mix(anomaly, delta, uMode) * vec4(1.0, 1.0, 1.0, igScanned());
}`;

/** Where the defect sits on the hub (radians around Y, part space); matches `defect` in OVERLAY. */
const DEFECT_ANGLE = 0.34;

function partMaterial(uniforms: { uScan: { value: number }; uMode: { value: number } }) {
  // Light, bead-blasted machined finish: partly metallic, satin, so it reads light grey rather than gunmetal.
  const m = new MeshStandardMaterial({ color: 0xd9dde0, metalness: 0.6, roughness: 0.36, envMapIntensity: 1.3 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${OVERLAY}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec4 igO = igOverlay();\ndiffuseColor.rgb = mix(diffuseColor.rgb, igO.rgb, igO.a);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - igO.a * 0.9;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, igO.a);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += igBand() * vec3(0.05, 0.75, 0.95) * 4.5;');
  };
  m.customProgramCacheKey = () => 'ig-defect-part';
  return m;
}

/** Inspect pillar: a machined flange on a turntable under a descending laser sheet that reveals an anomaly or ΔE map. */
export async function mount(el: HTMLElement) {
  const stage = createStage(el, { fov: 30, ao: 0.8, near: 0.2 });
  const { scene, camera, isMobile } = stage;
  addEnvironment(stage, { shadowSize: 9 }); // fog follows the shot distance (framedShot)
  // Fixed shot: no distance fade (phones pull the camera back up to 2.6x).
  const labels = createLabels(el, camera, 400);
  stage.onResize(() => labels.setSafeArea(stage.frame));
  const cast = createCast(stage);
  // An operator at the cell, for scale (no box: Inspect watches the part, not people).
  const crew = cast.add(scene, INSPECT_CELL_CREW);
  avoidCrew(labels, crew);

  // Inspection cell: plinth with turntable, gantry and the scanner head.
  // The hall behind the cell.
  const hall = hallBackdrop(64, 11, 6, 9);
  hall.position.set(0, 0, -7.5);
  scene.add(hall);
  const cell = new Group();
  const plinth = solid(new CylinderGeometry(4.2, 4.3, 0.5, 72), M.body());
  plinth.position.y = 0.25;
  plinth.castShadow = false;
  cell.add(plinth);
  const gantry = new Group();
  for (const x of [-5.2, 5.2]) {
    const post = solid(new RoundedBoxGeometry(0.4, 7.4, 0.4, 2, 0.04), M.body());
    post.position.set(x, 3.7, -0.6);
    gantry.add(post);
  }
  const bar = solid(new RoundedBoxGeometry(10.8, 0.45, 0.5, 2, 0.05), M.body());
  bar.position.set(0, 7.2, -0.6);
  const head = solid(new RoundedBoxGeometry(1.2, 0.5, 0.7, 2, 0.06), M.white());
  head.position.set(0, 6.75, -0.2);
  const window_ = solid(new BoxGeometry(0.8, 0.04, 0.3), M.dark());
  window_.position.set(0, 6.49, -0.1);
  gantry.add(bar, head, window_);
  const add = (m: Object3D, x: number, y: number, z: number) => (m.position.set(x, y, z), gantry.add(m), m);
  // Post feet and the linear guide rails on the beam face, with the head's carriage plate.
  for (const x of [-5.2, 5.2]) add(solid(new BoxGeometry(0.7, 0.04, 0.7), M.galv()), x, 0.02, -0.6);
  for (const y of [7.08, 7.32]) add(solid(new BoxGeometry(10.2, 0.04, 0.03), M.steel()), 0, y, -0.33);
  add(solid(new RoundedBoxGeometry(1.0, 0.6, 0.06, 1, 0.02), M.galv()), 0, 7.05, -0.3);
  // Main camera: lens barrel and hood through the head, ring light round it (lit face under the bloom threshold).
  add(solid(new CylinderGeometry(0.075, 0.075, 0.2, 20), M.dark()), 0, 6.42, -0.2);
  add(solid(new CylinderGeometry(0.13, 0.09, 0.14, 20, 1, true), M.dark()), 0, 6.28, -0.2);
  add(solid(new CylinderGeometry(0.42, 0.42, 0.07, 40, 1, true), M.dark()), 0, 6.46, -0.2);
  add(solid(new RingGeometry(0.2, 0.42, 40).rotateX(-Math.PI / 2), M.dark()), 0, 6.495, -0.2);
  for (const s of [-1, 1]) add(solid(new BoxGeometry(0.04, 0.14, 0.04), M.galv()), s * 0.44, 6.56, -0.2);
  const ringFace = new Mesh(new RingGeometry(0.22, 0.4, 40).rotateX(Math.PI / 2), led(0xeef6ff, 1.3));
  ringFace.position.set(0, 6.42, -0.2);
  // Two angled side cameras on brackets: housing, lens, flared hood, cable gland; aimed at the part.
  for (const s of [-1, 1]) {
    const camG = new Group();
    camG.position.set(s * 2.4, 6.7, -0.1);
    camG.lookAt(0, 3.0, 0.4);
    camG.add(solid(new RoundedBoxGeometry(0.17, 0.17, 0.34, 1, 0.02), M.white()));
    const lens = solid(new CylinderGeometry(0.05, 0.05, 0.12, 16).rotateX(Math.PI / 2), M.dark());
    lens.position.z = 0.23;
    const hood = solid(new CylinderGeometry(0.06, 0.095, 0.14, 16, 1, true).rotateX(Math.PI / 2), M.dark());
    hood.position.z = 0.36;
    const gland = solid(new CylinderGeometry(0.025, 0.025, 0.08, 8).rotateX(Math.PI / 2), M.dark());
    gland.position.z = -0.21;
    camG.add(lens, hood, gland);
    gantry.add(camG);
    add(solid(new BoxGeometry(0.06, 0.42, 0.06), M.galv()), s * 2.4, 6.95, -0.32);
  }
  // Cable carrier (drag chain) in a tray on the beam: lower run, a bend, upper run back to the head carriage.
  add(solid(new BoxGeometry(5.2, 0.03, 0.2), M.galv()), 0.6, 7.44, -0.6);
  const link = new BoxGeometry(0.1, 0.07, 0.14);
  for (let x = 3.0; x > -1.8; x -= 0.11) add(solid(link, M.dark()), x, 7.5, -0.6);
  for (let k = 0; k <= 8; k++) {
    const a = -Math.PI / 2 - (k / 8) * Math.PI;
    const m = add(solid(link, M.dark()), -1.8 + Math.cos(a) * 0.17, 7.67 + Math.sin(a) * 0.17, -0.6);
    m.rotation.z = a + Math.PI / 2;
  }
  for (let x = -1.8; x < -0.1; x += 0.11) add(solid(link, M.dark()), x, 7.84, -0.6);
  add(solid(new BoxGeometry(0.12, 0.5, 0.18), M.galv()), 0, 7.62, -0.6);
  // Status beacon on the left post, electrical cabinet behind the cell (RAL 7035, door seam, handle, vents).
  add(solid(new CylinderGeometry(0.05, 0.05, 0.45, 12), M.galv()), -5.2, 7.62, -0.6);
  add(solid(new RoundedBoxGeometry(1.4, 2.0, 0.5, 1, 0.03), M.body()), -7.4, 1.0, -3.2);
  add(solid(new BoxGeometry(0.01, 1.9, 0.01), M.dark()), -7.4, 1.0, -2.945);
  for (const s of [-1, 1]) add(solid(new BoxGeometry(0.03, 0.18, 0.04), M.steel()), -7.4 + s * 0.08, 1.15, -2.94);
  add(solid(new RoundedBoxGeometry(1.5, 0.1, 0.6, 1, 0.02), M.body2()), -7.4, 2.05, -3.2);
  add(solid(new BoxGeometry(1.5, 0.1, 0.55), M.body2()), -7.4, 0.05, -3.2);
  bake(gantry);
  cell.add(gantry, ringFace);
  // Perimeter guarding behind and either side of the cell; the operator side stays open.
  cell.add(meshGuarding([[-5.95, 0.7, -5.95, -4.9], [-5.95, -4.9, 5.95, -4.9], [5.95, -4.9, 5.95, 0.7]], 2.1));
  scene.add(cell);
  // Operator display beside the cell with Inspect's station view, turned to the operator and the camera
  // (right of the operator at (6.0, 1.7), so she never stands in front of the screen).
  const hmi = appMonitor('inspect-station', { width: 1.0, height: 1.55, tilt: 0.1, shelf: true });
  hmi.position.set(7.4, 0, 0.7);
  hmi.rotation.y = -0.5;
  scene.add(hmi);
  labels.avoid(hmi.top, () => hmi.screenHeight, () => true, 0.55);
  const table = solid(new CylinderGeometry(3.6, 3.6, 0.12, 72), M.steel());
  table.position.y = 0.56;
  scene.add(table);
  const lamp = new Mesh(new CylinderGeometry(0.05, 0.05, 0.06, 12), M.greenLed());
  lamp.position.set(0.45, 6.75, 0.16);
  lamp.rotation.x = Math.PI / 2;
  scene.add(lamp);

  const profile = [
    [0.0, -1.6], [1.1, -1.6], [1.1, -1.2], [2.9, -1.2], [3.0, -1.0], [3.0, -0.4], [2.9, -0.3],
    [1.5, -0.3], [1.4, 0.0], [1.4, 1.4], [1.6, 1.5], [1.6, 1.9], [1.4, 2.0], [0.7, 2.0], [0.7, -1.6],
  ].map(([x, y]) => new Vector2(x, y));
  const geo = new LatheGeometry(profile, isMobile ? 72 : 128);
  geo.computeVertexNormals();
  const uniforms = { uScan: { value: 2.2 }, uMode: { value: 0 } };
  const part = solid(geo, partMaterial(uniforms));
  const pivot = new Group();
  pivot.add(part);
  pivot.position.y = 0.62 + 1.6;
  scene.add(pivot);

  const laser = new Mesh(new CircleGeometry(4.1, 72), overlayMat(C.cyan, 0.08));
  laser.rotation.x = -Math.PI / 2;
  pivot.add(laser);
  const laserRing = new Mesh(new TorusGeometry(4.1, 0.018, 6, 128), led(0x0891b2, 1.6));
  laserRing.rotation.x = Math.PI / 2;
  pivot.add(laserRing);

  const defectAnchor = new Object3D();
  defectAnchor.position.set(1.42 * Math.cos(DEFECT_ANGLE), 0.35, 1.42 * Math.sin(DEFECT_ANGLE)); // the blob centre in the shader
  part.add(defectAnchor);
  const defectLabel = labels.add('Anomaly 0.91 · scratch', defectAnchor, new Vector3(0, 0.3, 0), 'bad');
  const scoreLabel = labels.add('Scanning · anomaly map', new Vector3(0, 5.6, 0), new Vector3(), 'info');

  let mode = 0;
  // The 7.4 m gantry top sits well inside the frame, below the page's eyebrow and mode toggle.
  const shot = framedShot(stage, new Vector3(0, 7.4, 21), new Vector3(0, 3.5, 0));

  stage.onFrame((t, dt) => {
    const cycle = (t * 0.2) % 1;
    const y = 2.25 - Math.min(1, cycle / 0.7) * 4.0;
    uniforms.uScan.value = y;
    uniforms.uMode.value += (mode - uniforms.uMode.value) * (1 - Math.exp(-dt * 8));
    laser.position.y = y;
    laserRing.position.y = y;
    const show = cycle < 0.7;
    laser.visible = laserRing.visible = show;
    // One turn per scan, phased so the defect faces the camera while it is revealed and through the result.
    part.rotation.y = DEFECT_ANGLE - Math.PI / 2 + (cycle - 0.55) * Math.PI * 2;
    const facing = Math.cos(DEFECT_ANGLE - part.rotation.y - Math.PI / 2);
    const done = cycle > 0.6;
    defectLabel.setVisible(mode === 0 && y < 0.35 && facing > 0.25);
    scoreLabel.setText(mode === 0 ? (done ? 'Result · reject · score 0.91' : 'Scanning · anomaly map') : done ? 'Result · review · ΔE max 2.4' : 'Scanning · ΔE2000 map');
    scoreLabel.setTone(done ? (mode === 0 ? 'bad' : 'warn') : 'info');
    cast.tick(dt);
    crew.update(dt);
    shot(dt, 1.2);
    labels.update(stage.size.width, stage.size.height);
  });

  await stage.warm();
  // People load after the first frame and fade in; the scene never waits for them.
  void cast.load();
  return {
    setMode(m: string) {
      mode = m === 'color' ? 1 : 0;
    },
    destroy: () => (cast.dispose(), labels.destroy(), stage.destroy()),
  };
}
