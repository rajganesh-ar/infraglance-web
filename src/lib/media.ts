import manifest from '../data/media.json';

export type Src = [number, string];
export interface PhotoEntry {
  type: 'photo';
  w: number;
  h: number;
  /** Average colour of the graded image: the loading placeholder. */
  color: string;
  /** Mean Rec.709 luma (0–1) of the graded image, for scrims that adapt to it (--media-lum). */
  lum?: number;
  /** Focal point as CSS object-position (e.g. "50% 20%"), so crops keep heads and subjects in frame. */
  pos?: string;
  alt: string;
  avif: Src[];
  jpg: Src[];
  credit?: Credit;
}
export interface VideoEntry {
  type: 'video';
  w: number;
  h: number;
  /** Seconds in the published loop. */
  duration: number;
  color: string;
  lum?: number;
  /** Focal point (CSS object-position) for the clip and its poster. */
  pos?: string;
  alt: string;
  sources: Record<string, { mp4: string; webm: string }>;
  poster: PhotoEntry;
  credit?: Credit;
}
export interface Credit {
  author: string;
  source: string;
  url: string;
  license: string;
  licenseUrl?: string;
  title: string;
}

const m = manifest as unknown as Record<string, PhotoEntry | VideoEntry>;

export function photo(key: string | undefined): PhotoEntry | undefined {
  if (!key) return undefined;
  const e = m[key];
  if (!e) return undefined;
  if (e.type !== 'video') return e;
  // A video's poster inherits the clip's focal point unless it has its own.
  return e.pos && !e.poster.pos ? { ...e.poster, pos: e.pos } : e.poster;
}

/** Focal point (CSS object-position) of a photo or video key, if the manifest sets one. */
export function focus(key: string | undefined): string | undefined {
  const e = key ? m[key] : undefined;
  if (!e) return undefined;
  return e.pos ?? (e.type === 'video' ? e.poster.pos : undefined);
}

export function video(key: string | undefined): VideoEntry | undefined {
  const e = key ? m[key] : undefined;
  return e?.type === 'video' ? e : undefined;
}

/**
 * Mean luma (0–1) of a photo or video key, for `style={`--media-lum:${lum(key)}`}`.
 * Tries each key in order (e.g. a video then its photo fallback); unknown keys give `fallback`.
 */
export function lum(keys: string | undefined | (string | undefined)[], fallback = 0.45): number {
  for (const k of Array.isArray(keys) ? keys : [keys]) {
    const e = k ? m[k] : undefined;
    const v = e?.lum ?? (e?.type === 'video' ? e.poster.lum : undefined);
    if (typeof v === 'number') return v;
  }
  return fallback;
}

export const srcset = (list: Src[]) => list.map(([w, s]) => `${s} ${w}w`).join(', ');

/** The JPEG closest to (but not smaller than) a target width — for og:image and CSS backgrounds. */
export function pick(list: Src[], target = 1280) {
  return (list.find(([w]) => w >= target) ?? list[list.length - 1])?.[1];
}

export function allCredits() {
  return Object.entries(m)
    .filter(([, e]) => e.credit)
    .map(([key, e]) => ({ key, type: e.type, ...(e.credit as Credit) }));
}
