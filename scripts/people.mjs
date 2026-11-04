// Builds the 3D site-worker kit (Microsoft Rocketbox, MIT) and the daylight HDRI (Poly Haven, CC0).
//
//   npm run people            download missing sources → convert → optimise → write outputs
//   npm run people -- --check only verify existing outputs (sizes, bones, clip targets)
//
// Sources are downloaded once into assets/raw/3d/ (gitignored) and skipped when present:
//   Rocketbox avatar   Assets/Avatars/Professions/<Name>/Export/<Name>.fbx
//                      Assets/Avatars/Professions/<Name>/Textures/<prefix>_{body,head,helmet}_{color,normal}.tga
//                      (the *_specular maps are not used: roughness is set per material instead)
//   Rocketbox clips    Assets/Animations/all_animations_max_motextr_{xy,static}/<clip>.max.fbx
//   Poly Haven HDRI    https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<name>_1k.hdr
//
// Outputs:
//   public/models/people/worker-{m1,m2,f1}.glb  skinned avatar: metres, Y-up, faces +Z, feet on y=0,
//                                               separate Body / Head / Helmet meshes sharing one skin
//   public/models/anim/{m,f}-{walk,idle}.glb    skeleton nodes + one clip ("walk" | "idle"), in place;
//                                               rotation tracks for every bone, translation for Bip01 only
//   public/hdri/<name>_1k.hdr
//   src/data/credits-3d.json
//
// Tools: FBX2glTF (npm "fbx2gltf", prebuilt binary) converts FBX → GLB; @gltf-transform cleans,
// bakes and meshopt-compresses; sharp encodes textures (TGA is decoded here — sharp has no TGA reader).
// Texture encoding runs in a child process ("--encode-textures <jobs.json>"): @gltf-transform/functions
// pulls in its own sharp build and two sharp natives cannot load into one Node process on Windows.
// Downloaded files are only ever read as data.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RAW = 'assets/raw/3d';
const BUILD = `${RAW}/build`;
const OUT_PEOPLE = 'public/models/people';
const OUT_ANIM = 'public/models/anim';
const OUT_HDRI = 'public/hdri';
const CREDITS = 'src/data/credits-3d.json';
const FBX2GLTF = path.join(ROOT, 'node_modules/fbx2gltf/bin', process.platform === 'win32' ? 'Windows_NT/FBX2glTF.exe' : process.platform === 'darwin' ? 'Darwin/FBX2glTF' : 'Linux/FBX2glTF');
const checkOnly = process.argv.includes('--check');

const RB_REPO = 'https://github.com/microsoft/Microsoft-Rocketbox';
const RB_RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/';
const RB_LFS = 'https://media.githubusercontent.com/media/microsoft/Microsoft-Rocketbox/master/';
const RB_CREDIT = {
  author: 'Microsoft Rocketbox',
  source: 'Microsoft Rocketbox avatar library',
  license: 'MIT',
  licenseUrl: 'https://github.com/microsoft/Microsoft-Rocketbox/blob/master/LICENSE.md',
};

/** Avatars: picked from the 9 Rocketbox construction workers — the three wearing hard hat + hi-vis. */
const AVATARS = [
  { key: 'm1', name: 'Construction_Male_07', prefix: 'm107', sex: 'm', title: 'Site worker, orange hi-vis vest and hard hat (3D avatar)' },
  { key: 'm2', name: 'Construction_Male_08', prefix: 'm108', sex: 'm', title: 'Site worker, yellow hi-vis vest, white hard hat and radio (3D avatar)' },
  { key: 'f1', name: 'Construction_Female_01', prefix: 'f101', sex: 'f', title: 'Site worker, yellow hi-vis vest and white hard hat (3D avatar)' },
];

/** Per-part material + texture settings. Specular maps are dropped; roughness is per part. */
const PARTS = {
  body: { node: 'Body', size: 1024, normalSize: 1024, roughness: 0.8 },
  head: { node: 'Head', size: 1024, normalSize: 1024, roughness: 0.55 },
  helmet: { node: 'Helmet', size: 512, normalSize: 512, roughness: 0.35 },
};

/**
 * Clips: a calm standing idle and the neutral walk per sex. Idles come first: their first frame
 * gives the clip skeleton's standing hip height, which the walk of the same sex reuses.
 * The walk FBX ("motextr_xy") still moves Bip01 forward; the build removes that travel.
 */
const CLIPS = [
  { key: 'm-idle', sex: 'm', clip: 'idle', dir: 'all_animations_max_motextr_static', file: 'm_idle_neutral_01', title: 'Male calm standing idle (3D animation)' },
  { key: 'm-walk', sex: 'm', clip: 'walk', dir: 'all_animations_max_motextr_xy', file: 'm_walk_neutral', title: 'Male neutral walk cycle (3D animation)' },
  { key: 'f-idle', sex: 'f', clip: 'idle', dir: 'all_animations_max_motextr_static', file: 'f_idle_neutral_02', title: 'Female calm standing idle (3D animation)' },
  { key: 'f-walk', sex: 'f', clip: 'walk', dir: 'all_animations_max_motextr_xy', file: 'f_walk_neutral', title: 'Female neutral walk cycle (3D animation)' },
];

const HDRI = {
  name: 'kloofendal_48d_partly_cloudy_puresky',
  title: 'Kloofendal 48d Partly Cloudy (Pure Sky) — daylight HDRI for 3D scene lighting',
  author: 'Greg Zaal (original), Jarod Guest (sky edit)',
};

const LIMITS = { avatar: 1.6e6, anim: 250e3, hdri: 2e6 };
/** Root bone of the 3ds Max Biped; its translation carries the hip bob. */
const ROOT_BONE = 'Bip01';
/** Body bones that clips may drive. Facial bones (jaw, lids, brows, lips…) keep the avatar's own rest pose. */
const BODY_BONE = /^Bip01( (Pelvis|Spine\d?|Neck|Head|[LR] (Clavicle|UpperArm|Forearm|Hand|Finger\d+|Thigh|Calf|Foot|Toe\d+)))?$/;
/** Non-skeleton helpers the Rocketbox exports carry along. */
const HELPERS = new Set(['Bip01 Footsteps', 'MotionExtractionHelper', 'ExposeTransformHelper']);

// ------------------------------------------------------------------ utils
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const ensureDir = (d) => mkdirSync(d, { recursive: true });

async function download(url, dest, lfsUrl) {
  if (existsSync(dest) && statSync(dest).size > 0) return false;
  ensureDir(path.dirname(dest));
  let res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  let buf = Buffer.from(await res.arrayBuffer());
  // Git LFS pointer instead of content → fetch through media.githubusercontent.com.
  if (lfsUrl && buf.length < 1024 && buf.toString('utf8', 0, 40).startsWith('version https://git-lfs')) {
    res = await fetch(lfsUrl);
    if (!res.ok) throw new Error(`${res.status} ${lfsUrl}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  writeFileSync(dest + '.part', buf);
  renameSync(dest + '.part', dest);
  console.log(`  ↓ ${path.basename(dest)} ${kb(buf.length)}`);
  return true;
}
const rb = (rel, dest) => download(RB_RAW + encodeURI(rel), dest, RB_LFS + encodeURI(rel));

/** Minimal TGA reader: uncompressed or RLE true-colour / greyscale, 8/24/32 bpp → top-left RGB(A). */
function readTGA(file) {
  const b = readFileSync(file);
  const idLen = b[0], cmapType = b[1], type = b[2];
  const cmapLen = b.readUInt16LE(5), cmapDepth = b[7];
  const w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16], desc = b[17];
  if (cmapType !== 0 || ![2, 3, 10, 11].includes(type)) throw new Error(`${file}: unsupported TGA type ${type}`);
  const px = bpp / 8;
  const ch = px === 4 ? 4 : px === 3 ? 3 : 1;
  let off = 18 + idLen + cmapLen * Math.ceil(cmapDepth / 8);
  const src = Buffer.alloc(w * h * px);
  if (type === 2 || type === 3) b.copy(src, 0, off, off + src.length);
  else {
    let i = 0;
    while (i < src.length) {
      const hdr = b[off++];
      const n = (hdr & 0x7f) + 1;
      if (hdr & 0x80) { for (let k = 0; k < n; k++) b.copy(src, i + k * px, off, off + px); off += px; }
      else { b.copy(src, i, off, off + n * px); off += n * px; }
      i += n * px;
    }
  }
  const topDown = (desc & 0x20) !== 0;
  const out = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) {
    const sy = topDown ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const s = (sy * w + x) * px, d = (y * w + x) * ch;
      if (ch === 1) out[d] = src[s];
      else { out[d] = src[s + 2]; out[d + 1] = src[s + 1]; out[d + 2] = src[s]; if (ch === 4) out[d + 3] = src[s + 3]; }
    }
  }
  return { data: out, width: w, height: h, channels: ch };
}

function fbxToGlb(fbx, outBase) {
  ensureDir(path.dirname(outBase));
  execFileSync(FBX2GLTF, ['--binary', '--anim-framerate', 'bake30', '--long-indices', 'never', '--input', path.resolve(fbx), '--output', path.resolve(outBase)], { stdio: 'pipe' });
  return outBase + '.glb';
}

// 4×4 column-major helpers (only what the bake needs)
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const invRigid = (m) => {
  // inverse of rotation+translation (FBX2glTF mesh nodes carry no scale)
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  const t = [m[12], m[13], m[14]];
  r[12] = -(r[0] * t[0] + r[4] * t[1] + r[8] * t[2]);
  r[13] = -(r[1] * t[0] + r[5] * t[1] + r[9] * t[2]);
  r[14] = -(r[2] * t[0] + r[6] * t[1] + r[10] * t[2]);
  return r;
};
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const triCount = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + (p.getIndices()?.getCount() ?? 0) / 3, 0);

// ------------------------------------------------------------------ avatar
/** Child-process entry: encode every {src, out, size, kind} job with sharp. */
async function encodeTextures(jobsFile) {
  const { default: sharp } = await import('sharp');
  const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
  for (const j of jobs) {
    const t = readTGA(j.src);
    const w = Math.min(j.size, t.width);
    const h = Math.round((w * t.height) / t.width);
    let img = sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } }).resize(w, h, { kernel: 'lanczos3' });
    if (t.channels === 4) img = img.removeAlpha();
    img =
      j.kind === 'normal'
        ? // JPEG 4:4:4 keeps the X/Y vector channels at full resolution (lossy WebP is always 4:2:0).
          img.jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
        : img.webp({ quality: 84, effort: 6, smartSubsample: true });
    await img.toFile(j.out);
    j.w = w;
    j.h = h;
  }
  writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
}

const texOut = (a, part, kind) => `${BUILD}/tex/${a.key}_${part}_${kind}.${kind === 'normal' ? 'jpg' : 'webp'}`;
function encodeAvatarTextures() {
  ensureDir(`${BUILD}/tex`);
  const jobs = [];
  for (const a of AVATARS)
    for (const [part, cfg] of Object.entries(PARTS))
      for (const kind of ['color', 'normal'])
        jobs.push({ src: `${RAW}/rocketbox/avatars/${a.name}/${a.prefix}_${part}_${kind}.tga`, out: texOut(a, part, kind), size: kind === 'normal' ? cfg.normalSize : cfg.size, kind });
  const jobsFile = `${BUILD}/tex/jobs.json`;
  writeFileSync(jobsFile, JSON.stringify(jobs));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/people.mjs'), '--encode-textures', jobsFile], { stdio: 'inherit' });
  return JSON.parse(readFileSync(jobsFile, 'utf8'));
}
const loadTexture = (a, part, kind, sizes) => {
  const file = texOut(a, part, kind);
  const job = sizes.find((j) => j.out === file);
  return { buf: readFileSync(file), mime: kind === 'normal' ? 'image/jpeg' : 'image/webp', ext: kind === 'normal' ? 'jpg' : 'webp', w: job.w, h: job.h };
};

async function downloadAvatar(a) {
  const dir = `${RAW}/rocketbox/avatars`;
  const base = `Assets/Avatars/Professions/${a.name}`;
  await rb(`${base}/Export/${a.name}.fbx`, `${dir}/${a.name}.fbx`);
  for (const part of Object.keys(PARTS))
    for (const kind of ['color', 'normal']) {
      const f = `${a.prefix}_${part}_${kind}.tga`;
      await rb(`${base}/Textures/${f}`, `${dir}/${a.name}/${f}`);
    }
}

async function buildAvatar(a, sizes) {
  const dir = `${RAW}/rocketbox/avatars`;
  const fbx = `${dir}/${a.name}.fbx`;

  const doc = await io.read(fbxToGlb(fbx, `${BUILD}/${a.name}`));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  doc.createExtension(EXTTextureWebP).setRequired(true);

  // FBX2glTF could not resolve the Max texture paths; drop its placeholders, textures are added below.
  for (const t of root.listTextures()) t.dispose();
  for (const n of root.listNodes()) if (HELPERS.has(n.getName())) n.dispose();

  const meshNode = root.listNodes().find((n) => n.getMesh() && n.getSkin());
  const skin = meshNode.getSkin();
  const mesh = meshNode.getMesh();

  // Bake the mesh node transform (Max Z-up → Y-up) into vertices and inverse bind matrices so the
  // skinned mesh node is identity: bone.world × IBM = I at bind pose.
  const M = meshNode.getWorldMatrix();
  const Minv = invRigid(M);
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute('COLOR_0', null);
    transformPrimitive(prim, M);
  }
  const ibm = skin.getInverseBindMatrices();
  for (let i = 0; i < ibm.getCount(); i++) ibm.setElement(i, mul(ibm.getElement(i, []), Minv));
  meshNode.setMatrix(IDENTITY);

  // One node + mesh per part (Body / Head / Helmet) sharing the skin, so parts can be toggled.
  const parent = meshNode.getParentNode() ?? null;
  const parts = [];
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const part = Object.keys(PARTS).find((p) => mat.getName().toLowerCase().includes(p));
    if (!part) throw new Error(`${a.name}: unknown material ${mat.getName()}`);
    const cfg = PARTS[part];
    const color = loadTexture(a, part, 'color', sizes);
    const normal = loadTexture(a, part, 'normal', sizes);
    const tColor = doc.createTexture(`${part}_color`).setImage(color.buf).setMimeType(color.mime).setURI(`${a.key}_${part}_color.${color.ext}`);
    const tNormal = doc.createTexture(`${part}_normal`).setImage(normal.buf).setMimeType(normal.mime).setURI(`${a.key}_${part}_normal.${normal.ext}`);
    mat
      .setName(part)
      .setBaseColorFactor([1, 1, 1, 1])
      .setBaseColorTexture(tColor)
      .setNormalTexture(tNormal)
      .setNormalScale(1)
      .setMetallicFactor(0)
      .setRoughnessFactor(cfg.roughness)
      .setMetallicRoughnessTexture(null)
      .setEmissiveFactor([0, 0, 0])
      .setEmissiveTexture(null)
      .setOcclusionTexture(null)
      .setAlphaMode('OPAQUE')
      .setDoubleSided(false);
    const m = doc.createMesh(cfg.node).addPrimitive(prim);
    const node = doc.createNode(cfg.node).setMesh(m).setSkin(skin);
    (parent ?? scene).addChild(node);
    parts.push({ part, color: `${color.w}×${color.h} ${kb(color.buf.length)}`, normal: `${normal.w}×${normal.h} ${kb(normal.buf.length)}` });
  }
  meshNode.dispose();
  mesh.dispose();

  const bip = root.listNodes().find((n) => n.getName() === ROOT_BONE);
  const rootNode = root.listNodes().find((n) => n.getName() === 'RootNode');
  rootNode?.setName(`worker-${a.key}`);
  scene.setName(`worker-${a.key}`);

  await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }), weld());
  const tris = triCount(doc);
  const bounds = getBounds(scene);
  // height without the helmet: Body + Head only
  const noHelmet = root.listNodes().filter((n) => n.getMesh() && n.getName() !== 'Helmet').map((n) => getBounds(n));
  const crown = Math.max(...noHelmet.map((b) => b.max[1]));
  // read before meshopt: quantize() clones the skin and prunes this one
  const joints = skin.listJoints().map((j) => j.getName());
  const bones = joints.length;
  scene.setExtras({
    variant: a.key,
    source: `Microsoft Rocketbox ${a.name} (MIT)`,
    height: round(bounds.max[1] - bounds.min[1]),
    heightNoHelmet: round(crown - bounds.min[1]),
    hipHeight: round(bip.getWorldTranslation()[1]),
    triangles: tris,
    bones,
  });

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizationVolume: 'scene' }));
  ensureDir(OUT_PEOPLE);
  const out = `${OUT_PEOPLE}/worker-${a.key}.glb`;
  await io.write(out, doc);
  return {
    key: a.key,
    out,
    joints,
    report: { file: out, size: kb(statSync(out).size), bytes: statSync(out).size, ...scene.getExtras(), bboxMin: bounds.min.map((v) => round(v)), bboxMax: bounds.max.map((v) => round(v)), parts },
  };
}

// ------------------------------------------------------------------ clips
const refHip = {};
async function buildClip(c, jointsBySex) {
  const rel = `Assets/Animations/${c.dir}/${c.file}.max.fbx`;
  const fbx = `${RAW}/rocketbox/anim/${c.file}.max.fbx`;
  await rb(rel, fbx);
  const doc = await io.read(fbxToGlb(fbx, `${BUILD}/${c.file}`));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const anim = root.listAnimations()[0];
  if (!anim || root.listAnimations().length !== 1) throw new Error(`${c.file}: expected exactly one animation`);
  anim.setName(c.clip);

  const joints = jointsBySex[c.sex];
  const keep = new Set([ROOT_BONE, ...joints.filter((j) => BODY_BONE.test(j))]);
  const dropped = new Set();
  for (const ch of anim.listChannels()) {
    const name = ch.getTargetNode()?.getName();
    const p = ch.getTargetPath();
    const ok = keep.has(name) && (p === 'rotation' || (p === 'translation' && name === ROOT_BONE));
    if (!ok) {
      if (!keep.has(name) && !BODY_BONE.test(name ?? '')) dropped.add(name);
      ch.dispose();
    }
  }
  for (const n of root.listNodes()) if (HELPERS.has(n.getName())) n.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();

  // Reference standing hip height (the clip skeleton's Bip01 rest) — runtime rescales Bip01 by avatar/ref.
  const bip = root.listNodes().find((n) => n.getName() === ROOT_BONE);
  const posCh = anim.listChannels().find((ch) => ch.getTargetNode() === bip && ch.getTargetPath() === 'translation');
  const input = posCh.getSampler().getInput();
  const output = posCh.getSampler().getOutput();
  const n = output.getCount();
  const t0 = input.getElement(0, [])[0];
  const t1 = input.getElement(n - 1, [])[0];
  const first = output.getElement(0, []);
  const last = output.getElement(n - 1, []);
  const extras = { clip: c.clip, source: `Microsoft Rocketbox ${c.file} (MIT)`, duration: round(t1 - t0, 4) };

  if (c.clip === 'walk') {
    // Remove the forward travel from the root so the cycle plays in place; stride = travel per cycle.
    const dx = last[0] - first[0];
    const dz = last[2] - first[2];
    for (let i = 0; i < n; i++) {
      const t = (input.getElement(i, [])[0] - t0) / (t1 - t0);
      const v = output.getElement(i, []);
      output.setElement(i, [v[0] - first[0] - dx * t, v[1], v[2] - first[2] - dz * t]);
    }
    extras.stride = round(Math.hypot(dx, dz));
    extras.speed = round(Math.hypot(dx, dz) / (t1 - t0));
    extras.heading = round(Math.atan2(dx, dz) * (180 / Math.PI), 1);
  }
  let ySum = 0;
  for (let i = 0; i < n; i++) ySum += output.getElement(i, [])[1];
  extras.meanHipHeight = round(ySum / n);
  if (c.clip === 'idle') refHip[c.sex] = first[1];
  if (refHip[c.sex] === undefined) throw new Error(`${c.file}: build the ${c.sex} idle first (reference hip height)`);
  extras.refHipHeight = round(refHip[c.sex]);
  // The skeleton's rest Bip01 sits at the clip's first frame; for cross-file consistency put it in place.
  bip.setTranslation([0, bip.getTranslation()[1], 0]);

  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune({ keepLeaves: true }));
  const missing = [...new Set(anim.listChannels().map((ch) => ch.getTargetNode()?.getName()))].filter((t) => !keep.has(t));
  if (missing.length) throw new Error(`${c.file}: tracks target unknown nodes ${missing.join(', ')}`);
  const paths = {};
  for (const ch of anim.listChannels()) paths[ch.getTargetPath()] = (paths[ch.getTargetPath()] ?? 0) + 1;
  extras.tracks = anim.listChannels().length;
  anim.setExtras(extras);
  scene.setName(`anim-${c.key}`).setExtras(extras);

  // no geometry here: just meshopt-filter the keyframes (quaternion / exponential filters)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  ensureDir(OUT_ANIM);
  const out = `${OUT_ANIM}/${c.key}.glb`;
  await io.write(out, doc);
  return { key: c.key, report: { file: out, size: kb(statSync(out).size), bytes: statSync(out).size, ...extras, paths, droppedTargets: [...dropped].filter(Boolean) } };
}

// ------------------------------------------------------------------ hdri
async function buildHdri() {
  const file = `${HDRI.name}_1k.hdr`;
  const src = `${RAW}/hdri/${file}`;
  await download(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${file}`, src);
  ensureDir(OUT_HDRI);
  copyFileSync(src, `${OUT_HDRI}/${file}`);
  return { file: `${OUT_HDRI}/${file}`, size: kb(statSync(src).size), bytes: statSync(src).size };
}

// ------------------------------------------------------------------ credits
function writeCredits() {
  const list = [
    ...AVATARS.map((a) => ({
      key: `worker-${a.key}`,
      title: a.title,
      ...RB_CREDIT,
      url: `${RB_REPO}/tree/master/Assets/Avatars/Professions/${a.name}`,
      file: `/models/people/worker-${a.key}.glb`,
    })),
    ...CLIPS.map((c) => ({
      key: `anim-${c.key}`,
      title: c.title,
      ...RB_CREDIT,
      url: `${RB_REPO}/blob/master/Assets/Animations/${c.dir}/${c.file}.max.fbx`,
      file: `/models/anim/${c.key}.glb`,
    })),
    {
      key: `hdri-${HDRI.name}`,
      title: HDRI.title,
      author: HDRI.author,
      source: 'Poly Haven',
      url: `https://polyhaven.com/a/${HDRI.name}`,
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      file: `/hdri/${HDRI.name}_1k.hdr`,
    },
  ];
  writeFileSync(CREDITS, JSON.stringify(list, null, 2) + '\n');
  return list.length;
}

// ------------------------------------------------------------------ verify
async function verify() {
  const problems = [];
  const joints = {};
  for (const a of AVATARS) {
    const f = `${OUT_PEOPLE}/worker-${a.key}.glb`;
    const size = statSync(f).size;
    if (size > LIMITS.avatar) problems.push(`${f} is ${kb(size)} (> ${kb(LIMITS.avatar)})`);
    const doc = await io.read(f);
    const names = doc.getRoot().listSkins()[0].listJoints().map((j) => j.getName());
    joints[a.key] = new Set([...names, ...doc.getRoot().listNodes().map((n) => n.getName())]);
  }
  for (const c of CLIPS) {
    const f = `${OUT_ANIM}/${c.key}.glb`;
    const size = statSync(f).size;
    if (size > LIMITS.anim) problems.push(`${f} is ${kb(size)} (> ${kb(LIMITS.anim)})`);
    const doc = await io.read(f);
    const anim = doc.getRoot().listAnimations()[0];
    if (anim.getName() !== c.clip) problems.push(`${f}: clip is "${anim.getName()}"`);
    const rot = anim.listChannels().filter((ch) => ch.getTargetPath() === 'rotation').length;
    if (rot < 20) problems.push(`${f}: only ${rot} rotation tracks`);
    for (const a of AVATARS.filter((x) => x.sex === c.sex)) {
      const miss = anim.listChannels().map((ch) => ch.getTargetNode().getName()).filter((t) => !joints[a.key].has(t));
      if (miss.length) problems.push(`${f}: targets missing in worker-${a.key}: ${[...new Set(miss)].join(', ')}`);
    }
  }
  const hdr = `${OUT_HDRI}/${HDRI.name}_1k.hdr`;
  if (statSync(hdr).size > LIMITS.hdri) problems.push(`${hdr} > ${kb(LIMITS.hdri)}`);
  return problems;
}

// ------------------------------------------------------------------ main
const encodeIdx = process.argv.indexOf('--encode-textures');
if (encodeIdx > 0) {
  await encodeTextures(process.argv[encodeIdx + 1]);
  process.exit(0);
}
const { Logger, NodeIO, getBounds } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } = await import('@gltf-transform/extensions');
const { dedup, meshopt, prune, resample, transformPrimitive, weld } = await import('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

if (!checkOnly) {
  if (!existsSync(FBX2GLTF)) throw new Error(`FBX2glTF binary not found at ${FBX2GLTF} — run npm install`);
  await MeshoptEncoder.ready;
  console.log('download');
  for (const a of AVATARS) await downloadAvatar(a);
  console.log('textures');
  const sizes = encodeAvatarTextures();
  console.log('avatars');
  const avatars = [];
  for (const a of AVATARS) {
    const r = await buildAvatar(a, sizes);
    avatars.push(r);
    console.log(' ', JSON.stringify(r.report));
  }
  const jointsBySex = {};
  for (const r of avatars) {
    const sex = AVATARS.find((a) => a.key === r.key).sex;
    // a clip may only target bones that every avatar of that sex has
    jointsBySex[sex] = jointsBySex[sex] ? jointsBySex[sex].filter((j) => r.joints.includes(j)) : r.joints;
  }
  console.log('clips');
  for (const c of CLIPS) console.log(' ', JSON.stringify((await buildClip(c, jointsBySex)).report));
  console.log('hdri');
  console.log(' ', JSON.stringify(await buildHdri()));
  console.log(`credits: ${writeCredits()} entries → ${CREDITS}`);
}
const problems = await verify();
if (problems.length) {
  console.error('verify: FAILED\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('verify: ok');
