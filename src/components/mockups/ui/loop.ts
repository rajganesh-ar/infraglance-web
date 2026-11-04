/**
 * Looping GSAP timeline for a Glance UI mockup.
 *
 * - The server-rendered markup is the HERO frame: a complete, populated
 *   screen. No-JS views, crawlers, failed chunk loads, screenshots and
 *   prefers-reduced-motion all show it. With reduced motion GSAP is never loaded.
 * - Every timeline starts on the hero frame and animates CHANGES from it
 *   (a new event, a re-run, a live value), ending on (or next to) the hero
 *   frame again. Never reset a window to empty or zeroed values at t = 0.
 * - GSAP is imported lazily when the mockup gets within `prepMargin` of the
 *   viewport; the timeline plays only while visible and pauses when scrolled away.
 * - Everything is torn down on `astro:before-swap` or when the root leaves
 *   the DOM (checked on every loop and visibility change).
 *
 * Motion convention: enter 0.25 s power2.out (opacity + whole-px y/x),
 * exit 0.2 s power2.in, value changes 1.2 s power2.out, draws and reveals
 * 1.2 s power1.inOut, no back/elastic eases, no scale on anything with text.
 * Inside a timeline, fromTo() calls must pass `immediateRender: false` so
 * building the timeline never paints a from-state over the hero frame. At
 * each repeat GSAP rewinds every child to its start values, so a property
 * whose FIRST tween is a fromTo() also needs `tl.set(target, hero, 0)`.
 * Text written in onUpdate/call is not rewound: end each loop on hero text.
 */
import type { gsap as GSAP } from 'gsap';

type Gsap = typeof GSAP;
type Timeline = gsap.core.Timeline;

export interface LoopOptions {
  /** Hold on the final (hero) frame between loops, in seconds (default 2). */
  repeatDelay?: number;
  /** Re-record start values and function-based values on every repeat (default false).
   *  Off by default: with it on, GSAP re-applies fromTo() start values at the loop seam. */
  refresh?: boolean;
  /** Re-evaluate function-based values when the root width changes. */
  invalidateOnResize?: boolean;
  /** How early to load GSAP and build the timeline (default 600px). */
  prepMargin?: string;
}

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Round to whole pixels so resting text never sits on a half pixel. */
export const px = (n: number) => Math.round(n);

export function mockLoop(
  root: HTMLElement,
  build: (gsap: Gsap, tl: Timeline) => void,
  opts: LoopOptions = {},
): () => void {
  if (reducedMotion() || typeof IntersectionObserver === 'undefined') return () => {};

  let tl: Timeline | null = null;
  let visible = false;
  let dead = false;
  let ro: ResizeObserver | undefined;

  const kill = () => {
    if (dead) return;
    dead = true;
    prep.disconnect();
    vis.disconnect();
    ro?.disconnect();
    tl?.kill();
    tl = null;
    document.removeEventListener('visibilitychange', sync);
    document.removeEventListener('astro:before-swap', kill);
  };

  const sync = () => {
    if (!root.isConnected) return kill();
    if (!tl) return;
    if (visible && !document.hidden) tl.play();
    else tl.pause();
  };

  const init = async () => {
    let gsap: Gsap;
    try {
      ({ gsap } = await import('gsap'));
    } catch (err) {
      // Markup already shows the hero frame; just stay static.
      console.warn('[mockup] animation unavailable', err);
      return;
    }
    if (dead || !root.isConnected) return kill();
    tl = gsap.timeline({
      paused: true,
      repeat: -1,
      repeatDelay: opts.repeatDelay ?? 2,
      repeatRefresh: opts.refresh ?? false,
      onRepeat: () => { if (!root.isConnected) kill(); },
    });
    try {
      build(gsap, tl);
    } catch (err) {
      // A broken timeline must never leave a half-built frame on screen.
      console.warn('[mockup] timeline failed', err);
      tl.kill();
      tl = null;
      return;
    }
    // The timeline opens on the hero frame, so rendering its start is a no-op visually.
    tl.time(0, true);
    if (opts.invalidateOnResize && typeof ResizeObserver !== 'undefined') {
      let w = root.clientWidth;
      ro = new ResizeObserver(() => {
        const nw = root.clientWidth;
        if (Math.abs(nw - w) > 1) { w = nw; tl?.invalidate(); }
      });
      ro.observe(root);
    }
    sync();
  };

  const prep = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) { prep.disconnect(); void init(); }
    },
    { rootMargin: opts.prepMargin ?? '600px 0px' },
  );
  const vis = new IntersectionObserver(
    (entries) => { visible = entries[entries.length - 1].isIntersecting; sync(); },
    { rootMargin: '40px 0px' },
  );
  prep.observe(root);
  vis.observe(root);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('astro:before-swap', kill, { once: true });
  return kill;
}
