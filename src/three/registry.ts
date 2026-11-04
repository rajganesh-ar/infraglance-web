import type { SafeArea } from './core/labels';

export type { SafeArea };

export interface SceneApi {
  destroy(): void;
  /** Journey: key index (0 overview … chapters … outro), fractional between keys. */
  setProgress?(p: number): void;
  /** Journey: snap to a key without easing. */
  jump?(k: number): void;
  /** DefectPart: 'defect' | 'color'. */
  setMode?(mode: string): void;
  /** Free area of the canvas not covered by HUD panels (CSS px); null = whole canvas. */
  setSafeArea?(r: SafeArea | null): void;
}

type Loader = () => Promise<{ mount: (el: HTMLElement) => SceneApi | Promise<SceneApi> }>;

// Each scene is its own chunk; three.js itself is shared between them.
export const scenes: Record<string, Loader> = {
  'journey': () => import('./scenes/Journey'),
  'edge-network': () => import('./scenes/EdgeNetwork'),
  'defect-part': () => import('./scenes/DefectPart'),
  'belt-flow': () => import('./scenes/BeltFlow'),
  'infra-bridge': () => import('./scenes/InfraBridge'),
  'guard-zone': () => import('./scenes/GuardZone'),
  'sense-scene': () => import('./scenes/SenseScene'),
};

/** Scenes with animated people (createCast): their avatars are fetched while the scene builds. */
export const peopleScenes = new Set(['journey', 'guard-zone', 'sense-scene', 'belt-flow', 'defect-part', 'infra-bridge']);

/** Starts loading the shared avatar kit (memoised in people.ts; cast.load() picks up the same promise). */
export function preloadPeople() {
  import('./core/people').then((m) => m.loadPeople()).catch(() => {
    /* cast.load() retries and falls back to simple figures */
  });
}

let available: boolean | undefined;

/**
 * WebGL2 (required by three r163+) without a major performance caveat
 * (software rendering). Checked once, and the probe context is released.
 */
export function webglAvailable() {
  if (available !== undefined) return available;
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    available = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    available = false;
  }
  return available;
}
