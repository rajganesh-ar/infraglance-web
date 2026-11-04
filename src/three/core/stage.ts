/**
 * Renderer, daylight environment and post chain shared by every 3D scene.
 *
 * Look: a light architectural-visualisation daylight scene whose background is
 * exactly the colour of the page section it sits in (the canvas edge is
 * invisible). Post chain: N8AO (subtle, tinted) → bloom (alert lamps only) →
 * Khronos Neutral tone mapping → SMAA. No vignette and no tilt-shift.
 *
 * Quality tiers: high (HDRI, AO, 2048 shadows, DPR up to 2), mid (HDRI, half-res
 * AO, 1024 shadows, pixel budget), low (procedural sky, no AO, no shadows, DPR 1).
 * A frame-time governor steps quality down at runtime when frames run slow, steady
 * or not (a steady 30 fps display or power-saver cap is left alone).
 *
 * The render loop starts only after warm(): shaders are compiled first and the
 * first frame is drawn while the poster still covers the canvas.
 *
 * Page chrome laid over the canvas (a sibling .scene-head / .net-head row, or any
 * sibling with [data-scene-overlay]) is measured into `stage.frame`: the free
 * area that scenes frame their subject in and keep their labels inside.
 */
import {
  BackSide,
  BufferAttribute,
  Color,
  DataUtils,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type ColorRepresentation,
  type DataTexture,
  type Material,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export type Tier = 'high' | 'mid' | 'low';

export interface StageOptions {
  fov?: number;
  near?: number;
  far?: number;
  /** Ambient occlusion radius in metres (0 disables). */
  ao?: number;
  /** Bloom intensity (only emissive alert lamps exceed the threshold). */
  bloom?: number;
  exposure?: number;
  /** Override the background (CSS colour); default: the host section's background. */
  background?: ColorRepresentation;
}

/** A rectangle of the canvas in CSS px (edges measured from its top-left corner). */
export interface FreeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Stage {
  el: HTMLElement;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  tier: Tier;
  /** Phone/tablet-sized or touch-first: scenes use fewer particles and wider shots. */
  isMobile: boolean;
  size: { width: number; height: number };
  pointer: { x: number; y: number };
  /** Part of the canvas not covered by overlaid page chrome (CSS px); updated before resize callbacks run. */
  frame: FreeArea;
  /** Linear background colour, pre-compensated for tone mapping (also the fog colour). */
  bg: Color;
  /** Resolves once the image-based lighting is in place (HDRI or the procedural sky). */
  envReady: Promise<void>;
  onFrame(cb: (t: number, dt: number) => void): void;
  onResize(cb: (w: number, h: number) => void): void;
  /**
   * Compiles the scene's shader programs (off the main thread where KHR_parallel_shader_compile is
   * supported) as the variants the post chain draws them with: linear output into its HalfFloat target.
   */
  compile(): Promise<void>;
  /**
   * Waits for the environment (max 2.5 s), compiles the shaders, renders the first frame while the
   * canvas is still hidden behind the poster, then starts the render loop (which never runs before).
   */
  warm(): Promise<void>;
  /** True once the WebGL context has been lost, even if it was restored since (a restored scene is remounted). */
  readonly contextLost: boolean;
  /**
   * After a context loss, loses the restored context too, so disposing GPU objects that died with the old
   * one is a quiet no-op (three would otherwise delete stale handles on the new context and WebGL logs
   * "object does not belong to this context"). Called by destroy(); a cast disposing before it calls it too.
   */
  releaseLostContext(): void;
  destroy(): void;
}

/** Poly Haven CC0 1k pure-sky HDRI (see /credits). Loaded on high and mid tiers only. */
const HDRI_URL = '/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr';
/** The HDRI's sun is clamped out (the DirectionalLight is the sun), so shadows keep their contrast. */
const HDRI_CLAMP = 16;
/** Share of the sky's blue kept in the environment (1 = as shot); a neutral fill reads as daylight, not a blue cast. */
const SKY_SATURATION = 0.45;
const ENV_INTENSITY = 0.75;
const FALLBACK_BG = '#eaeff4';
/** Sibling elements a page lays over the top of the canvas. */
const OVERLAY_SELECTOR = '.scene-head, .net-head, [data-scene-overlay]';

// ---------------------------------------------------------------- colour helpers
const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** Khronos PBR Neutral, as three.js implements it (exposure already applied). */
function neutral(c: number[]) {
  const SC = 0.76;
  const x = Math.min(c[0], c[1], c[2]);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  const v = c.map((k) => k - off);
  const peak = Math.max(v[0], v[1], v[2]);
  if (peak < SC) return v;
  const d = 1 - SC;
  const np = 1 - (d * d) / (peak + d - SC);
  const s = v.map((k) => (k * np) / peak);
  const g = 1 - 1 / (0.15 * (peak - np) + 1);
  return s.map((k) => k * (1 - g) + np * g);
}

/**
 * Linear colour that comes out of Neutral tone mapping as the given sRGB colour,
 * so the clear colour and fog match the CSS background exactly.
 */
function compensate(srgb: [number, number, number], exposure: number) {
  const t = srgb.map((c) => Math.min(0.97, s2l(c)));
  let x = t.slice();
  for (let i = 0; i < 160; i++) {
    const y = neutral(x);
    x = x.map((v, k) => Math.min(30, Math.max(0, v + (t[k] - y[k]) * 2.5)));
  }
  return new Color().setRGB(x[0] / exposure, x[1] / exposure, x[2] / exposure, LinearSRGBColorSpace);
}

/** Parses rgb()/rgba()/color(srgb …) computed values. Returns sRGB 0..1 plus alpha. */
function parseCss(v: string): [number, number, number, number] | null {
  const nums = v.match(/-?[\d.]+%?/g)?.map((n) => (n.endsWith('%') ? parseFloat(n) / 100 : parseFloat(n)));
  if (!nums || nums.length < 3) return null;
  if (v.startsWith('color(')) return [nums[0], nums[1], nums[2], nums[3] ?? 1];
  if (v.startsWith('rgb')) return [nums[0] / 255, nums[1] / 255, nums[2] / 255, nums[3] ?? 1];
  return null;
}

/** First non-transparent background behind the scene element; light fallback for dark or unknown hosts. */
function hostBackground(el: HTMLElement): [number, number, number] {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const c = parseCss(getComputedStyle(n).backgroundColor);
    if (c && c[3] > 0.5) {
      const lum = 0.2126 * s2l(c[0]) + 0.7152 * s2l(c[1]) + 0.0722 * s2l(c[2]);
      if (lum > 0.4) return [c[0], c[1], c[2]];
      break; // A dark host: 3D scenes are daylight scenes, so keep the light fallback.
    }
  }
  return cssToSrgb(FALLBACK_BG);
}

function cssToSrgb(c: ColorRepresentation): [number, number, number] {
  const col = new Color(c); // working (linear) space
  const srgb = col.clone().convertLinearToSRGB();
  return [srgb.r, srgb.g, srgb.b];
}

// ---------------------------------------------------------------- tiers
function detectTier(gl: WebGL2RenderingContext): Tier {
  const coarse = matchMedia('(pointer: coarse)').matches;
  let gpu = '';
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    /* ignore */
  }
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 'low';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (coarse || cores <= 4 || mem <= 4) return 'mid';
  return /intel/i.test(gpu) && !/\barc\b/i.test(gpu) ? 'mid' : 'high';
}

/** Pixel budgets (device pixels) per tier; DPR is derived from the canvas size, capped at 2. */
const BUDGET: Record<Tier, number> = { high: 4.2e6, mid: 1.6e6, low: 0 };

// ---------------------------------------------------------------- environment
/** Zero-download sky: a gradient sphere matched to the HDRI's average radiance by elevation (sun removed). */
function skyScene() {
  const geo = new SphereGeometry(10, 48, 24);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  // [elevation°, r, g, b] linear radiance, from kloofendal_48d_partly_cloudy_puresky (clamped).
  const stops: [number, number, number, number][] = [
    [-90, 0.15, 0.16, 0.23],
    [-30, 0.16, 0.19, 0.29],
    [-8, 0.32, 0.36, 0.47],
    [0, 0.44, 0.47, 0.57],
    [8, 0.4, 0.47, 0.64],
    [22, 0.36, 0.43, 0.65],
    [45, 0.43, 0.5, 0.73],
    [90, 0.47, 0.51, 0.68],
  ];
  for (let i = 0; i < pos.count; i++) {
    const el = (Math.asin(Math.max(-1, Math.min(1, pos.getY(i) / 10))) * 180) / Math.PI;
    let k = 0;
    while (k < stops.length - 2 && el > stops[k + 1][0]) k++;
    const [e0, ...a] = stops[k];
    const [e1, ...b] = stops[k + 1];
    const f = Math.max(0, Math.min(1, (el - e0) / (e1 - e0)));
    const rgb = desat(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
    col.set(rgb, i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const s = new Scene();
  s.add(new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
  return s;
}

/** Desaturate toward luminance, keeping luminance. */
function desat(r: number, g: number, b: number, k = SKY_SATURATION): [number, number, number] {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [l + (r - l) * k, l + (g - l) * k, l + (b - l) * k];
}

/**
 * Clamp the sun out of the half-float HDR and neutralise the sky tint, in place
 * (RGBA half floats). Runs in slices so it never blocks the main thread for long.
 */
async function prepareHdr(tex: DataTexture, max: number) {
  const data = tex.image.data as unknown as Uint16Array;
  const { fromHalfFloat: from, toHalfFloat: to } = DataUtils;
  const SLICE = 4 * 65536;
  for (let start = 0; start < data.length; start += SLICE) {
    const end = Math.min(data.length, start + SLICE);
    for (let i = start; i < end; i += 4) {
      const [r, g, b] = desat(Math.min(max, from(data[i])), Math.min(max, from(data[i + 1])), Math.min(max, from(data[i + 2])));
      data[i] = to(r);
      data[i + 1] = to(g);
      data[i + 2] = to(b);
    }
    await new Promise((res) => setTimeout(res, 0));
  }
  tex.needsUpdate = true;
}

// ---------------------------------------------------------------- stage
export function createStage(el: HTMLElement, opts: StageOptions = {}): Stage {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
  const tier = detectTier(renderer.getContext() as WebGL2RenderingContext);
  const isMobile = matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const exposure = opts.exposure ?? 1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping; // tone mapping happens in the post chain
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = tier !== 'low';
  renderer.shadowMap.type = PCFShadowMap;
  // Shader info-log checks stall compilation and print D3D compiler notes; only useful while developing.
  renderer.debug.checkShaderErrors = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

  const bg = compensate(opts.background !== undefined ? cssToSrgb(opts.background) : hostBackground(el), exposure);
  renderer.setClearColor(bg, 1);

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'scene-canvas';
  el.appendChild(canvas);

  const scene = new Scene();
  scene.background = bg;
  scene.environmentIntensity = ENV_INTENSITY;

  const camera = new PerspectiveCamera(opts.fov ?? 30, 1, opts.near ?? 0.5, opts.far ?? 900);

  // ---- image-based lighting
  let envRT: WebGLRenderTarget | null = null;
  let destroyed = false;
  const setEnv = (rt: WebGLRenderTarget) => {
    envRT?.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  };
  const skyEnv = () => {
    const pmrem = new PMREMGenerator(renderer);
    const sky = skyScene();
    setEnv(pmrem.fromScene(sky, 0.02));
    sky.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as Material | undefined)?.dispose?.();
    });
    pmrem.dispose();
  };
  const loadEnv = async () => {
    skyEnv(); // instant, matches the HDRI on average, so the swap is barely visible
    if (tier === 'low') return;
    try {
      const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
      const tex = (await new HDRLoader().setDataType(HalfFloatType).loadAsync(HDRI_URL)) as DataTexture;
      if (destroyed) return tex.dispose();
      if ((tex.image.data as unknown as Uint16Array).length !== tex.image.width * tex.image.height * 4) throw new Error('unexpected HDR layout');
      await prepareHdr(tex, HDRI_CLAMP);
      if (destroyed) return tex.dispose();
      const pmrem = new PMREMGenerator(renderer);
      setEnv(pmrem.fromEquirectangular(tex as Texture));
      tex.dispose();
      pmrem.dispose();
    } catch (err) {
      console.warn('[stage] HDRI unavailable, using the procedural sky', err);
    }
  };
  const envReady = loadEnv();

  // ---- post-processing
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  let ao: N8AOPostPass | null = null;
  if (tier !== 'low' && (opts.ao ?? 1.2) > 0) {
    ao = new N8AOPostPass(scene, camera, 1, 1);
    ao.configuration.aoRadius = opts.ao ?? 1.2;
    ao.configuration.distanceFalloff = 1.0;
    ao.configuration.intensity = 2.0;
    ao.configuration.color.set(0x1e2630);
    ao.configuration.gammaCorrection = false;
    ao.configuration.halfRes = tier !== 'high';
    ao.setQualityMode(tier === 'high' ? 'Medium' : 'Performance');
    composer.addPass(ao);
  }
  const effects = [
    ...(tier !== 'low' ? [new BloomEffect({ intensity: opts.bloom ?? 0.6, mipmapBlur: true, luminanceThreshold: 2.5, luminanceSmoothing: 0.1, radius: 0.55, levels: 6 })] : []),
    new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
  ];
  composer.addPass(new EffectPass(camera, ...effects));
  composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: tier === 'high' ? SMAAPreset.HIGH : SMAAPreset.MEDIUM })));

  // ---- sizing
  const size = { width: 1, height: 1 };
  const pointer = { x: 0, y: 0 };
  const frameCbs: ((t: number, dt: number) => void)[] = [];
  const resizeCbs: ((w: number, h: number) => void)[] = [];
  let budget = BUDGET[tier];
  const dprFor = (w: number, h: number) =>
    budget <= 0 ? 1 : Math.max(1, Math.min(Math.sqrt(budget / (w * h)), Math.min(window.devicePixelRatio || 1, 2)));

  // Page chrome overlaid on the canvas: sibling rows the page positions over its top (eyebrow, caption, legend).
  const overlays = el.parentElement
    ? [...el.parentElement.children].filter((n): n is HTMLElement => n !== el && n instanceof HTMLElement && n.matches(OVERLAY_SELECTOR))
    : [];
  const free: FreeArea = { left: 0, top: 0, right: 1, bottom: 1 };
  /** Free area: below any overlay whose content sits over the top half of the canvas, with an 8 px gap. */
  const measureFrame = (w: number, h: number) => {
    let top = 0;
    if (overlays.length) {
      const r = el.getBoundingClientRect();
      for (const o of overlays) {
        if (getComputedStyle(o).position !== 'absolute' && getComputedStyle(o).position !== 'fixed') continue;
        // The row's visible content (a full-width container is mostly empty), clipped to the canvas.
        const kids = o.children.length ? [...o.children] : [o];
        for (const k of kids) {
          const kr = k.getBoundingClientRect();
          if (!kr.height || kr.bottom <= r.top || kr.top >= r.top + h / 2) continue;
          top = Math.max(top, Math.min(h / 2, kr.bottom - r.top + 8));
        }
      }
    }
    free.left = 0;
    free.top = Math.round(top);
    free.right = w;
    free.bottom = h;
  };

  const resize = () => {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    size.width = w;
    size.height = h;
    measureFrame(w, h);
    renderer.setPixelRatio(dprFor(w, h));
    composer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeCbs.forEach((cb) => cb(w, h));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  // Overlay rows re-wrap (fonts, breakpoints): re-measure the free area and re-frame.
  overlays.forEach((o) => ro.observe(o));
  resize();

  const onPointer = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  // ---- loop + frame-time governor
  let last = 0;
  let raf = 0;
  let onScreen = false;
  let elapsed = 0;
  let govSkip = 40;
  let govLevel = 0;
  const GOV_N = 90;
  const govWin: number[] = [];

  /**
   * Steps quality down after a 90-frame window that averages slower than 25 ms a frame, whether the
   * frames are uneven or steadily slow (an overloaded GPU on a 60 Hz display usually settles into a
   * steady 50 ms). Only the band of a display or power-saver cap is left alone: iOS Low Power Mode and
   * Chrome Energy Saver run rAF at 30 fps, frames ~33 ms apart (on a 144 Hz display a mix of 27.8 and
   * 34.7 ms vsyncs), so none faster than 26 ms and nine in ten under 38 ms; frames that also miss the
   * cap step down. CPU timing around render() would not see GPU time, so cadence is all we use.
   */
  const govern = (raw: number) => {
    if (govSkip > 0) return void govSkip--;
    if (raw > 0.2) return; // tab switch or a one-off hitch
    govWin.push(raw);
    if (govWin.length < GOV_N) return;
    const sorted = govWin.slice().sort((a, b) => a - b);
    govWin.length = 0;
    const avg = sorted.reduce((a, b) => a + b, 0) / GOV_N;
    const p10 = sorted[Math.floor(GOV_N * 0.1)];
    const p90 = sorted[Math.floor(GOV_N * 0.9)];
    const capped = p10 > 0.026 && p90 < 0.038;
    if (avg <= 0.025 || capped || govLevel >= 3) return;
    govLevel++;
    if (govLevel === 1) budget *= 0.55;
    else if (govLevel === 2 && ao) ao.enabled = false;
    else budget = 0;
    govSkip = 20;
    resize();
  };

  const frame = (dt: number) => {
    elapsed += dt;
    for (const cb of frameCbs) cb(elapsed, dt);
    composer.render(dt);
  };
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const raw = (now - last) / 1000;
    last = now;
    govern(raw);
    try {
      frame(Math.min(raw, 1 / 20));
    } catch (err) {
      // A scene that throws every frame would flood the console and burn the GPU: stop, hand back to the poster.
      failed = true;
      stop();
      console.warn('[stage] frame failed; showing the poster', err);
      el.dispatchEvent(new CustomEvent('scene:error'));
    }
  };
  let failed = false;
  /** Set by warm(): nothing renders before the shaders are compiled and the first frame is drawn. */
  let warmed = false;
  const start = () => {
    if (raf || !warmed || !onScreen || document.hidden || lost || destroyed || failed) return;
    last = performance.now();
    govSkip = Math.max(govSkip, 20);
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    onScreen ? start() : stop();
  });
  io.observe(el);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  // ---- context loss: pause and hand back to the poster; Scene.astro remounts on restore.
  let lost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    stop();
    el.classList.remove('is-live');
    el.dispatchEvent(new CustomEvent('scene:lost'));
  };
  const onRestored = () => el.dispatchEvent(new CustomEvent('scene:restored'));
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  const gl = renderer.getContext();
  const releaseLostContext = () => {
    if (lost && !gl.isContextLost()) renderer.forceContextLoss();
  };

  /**
   * compileAsync builds programs for the render target bound when it is called. With none bound that
   * is sRGB output, but every scene draws through the composer's linear HalfFloat target, so bind that
   * one for the synchronous part of the call (WebGLPrograms takes the output colour space from it).
   */
  const compile = async () => {
    if (destroyed || lost) return;
    const prev = renderer.getRenderTarget();
    let ready: Promise<unknown> = Promise.resolve();
    try {
      renderer.setRenderTarget(composer.inputBuffer);
      if (typeof renderer.compileAsync === 'function') ready = renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch {
      /* compiled lazily on first draw */
    } finally {
      renderer.setRenderTarget(prev);
    }
    await ready.catch(() => undefined);
  };

  const stage: Stage = {
    el,
    renderer,
    scene,
    camera,
    tier,
    isMobile,
    size,
    pointer,
    frame: free,
    bg,
    envReady,
    onFrame: (cb) => frameCbs.push(cb),
    onResize: (cb) => {
      resizeCbs.push(cb);
      cb(size.width, size.height);
    },
    compile,
    async warm() {
      await Promise.race([envReady, new Promise((r) => setTimeout(r, 2500))]);
      if (destroyed) return;
      await compile();
      if (destroyed || lost) return;
      // Post-chain and shadow programs compile in this first frame, still hidden behind the poster.
      frame(1 / 60);
      warmed = true;
      start();
    },
    get contextLost() {
      return lost;
    },
    releaseLostContext,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      // After a context loss the disposals below only unhook three's records (calls on a lost context are no-ops).
      releaseLostContext();
      const textures = new Set<Texture>();
      scene.traverse((o: any) => {
        o.geometry?.dispose?.();
        if (o.isInstancedMesh || o.isLight) o.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((mm: any) => {
          for (const k in mm) if (mm[k]?.isTexture) textures.add(mm[k]);
          mm.dispose?.();
        });
      });
      textures.forEach((t) => t.dispose());
      envRT?.dispose();
      scene.environment = null;
      frameCbs.length = 0;
      resizeCbs.length = 0;
      composer.dispose();
      renderer.dispose();
      if (!gl.isContextLost()) renderer.forceContextLoss();
      canvas.remove();
    },
  };
  // Lets the host (Scene.astro) clean up a stage whose scene failed to finish mounting.
  el.dispatchEvent(new CustomEvent('scene:stage', { detail: stage }));
  return stage;
}
