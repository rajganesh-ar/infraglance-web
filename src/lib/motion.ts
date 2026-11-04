import type { gsap as GSAP } from 'gsap';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calls onEnter / onLeave as the element enters or leaves the viewport. Returns a disconnect function. */
export function onVisible(el: Element, onEnter: () => void, onLeave?: () => void, rootMargin = '0px') {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? onEnter() : onLeave?.())),
    { rootMargin },
  );
  io.observe(el);
  return () => io.disconnect();
}

/**
 * Builds a looping GSAP timeline for a mockup that only plays while visible and the tab is shown.
 * With reduced motion, the timeline is parked on a representative frame.
 * If GSAP cannot be loaded, the root gets `.is-static` (global CSS shows the final frame) and null is returned.
 * Pass `refresh: true` when tweens use function-based values that depend on layout (re-evaluated each loop).
 */
export async function loopTimeline(
  root: HTMLElement,
  build: (gsap: typeof GSAP, tl: gsap.core.Timeline) => void,
  opts: { staticAt?: number; repeatDelay?: number; refresh?: boolean } = {},
): Promise<gsap.core.Timeline | null> {
  let gsap: typeof GSAP;
  try {
    ({ gsap } = await import('gsap'));
  } catch (err) {
    root.classList.add('is-static');
    console.warn('[mockup] animation unavailable', err);
    return null;
  }
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: opts.repeatDelay ?? 1.2, repeatRefresh: !!opts.refresh });
  try {
    build(gsap, tl);
  } catch (err) {
    root.classList.add('is-static');
    console.warn('[mockup] animation failed to build', err);
    tl.kill();
    return null;
  }
  if (prefersReducedMotion()) {
    tl.progress(opts.staticAt ?? 0.8).pause();
    return tl;
  }
  let visible = false;
  const sync = () => (visible && !document.hidden ? tl.play() : tl.pause());
  onVisible(root, () => { visible = true; sync(); }, () => { visible = false; sync(); }, '80px');
  document.addEventListener('visibilitychange', sync);
  return tl;
}

/** Elements with [data-reveal] fade up once they scroll into view. */
function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }),
    { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
  );
  els.forEach((el) => io.observe(el));
  // Anything already above the fold on load (e.g. after a hash jump) appears immediately.
  requestAnimationFrame(() => {
    els.forEach((el) => {
      if (el.getBoundingClientRect().bottom < 0) {
        el.classList.add('is-in');
        io.unobserve(el);
      }
    });
  });
}

/** Counts [data-count] numbers up from zero when visible. */
function initCounters() {
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count || '0');
    const decimals = (el.dataset.count || '').split('.')[1]?.length ?? 0;
    if (prefersReducedMotion()) return;
    el.textContent = (0).toFixed(decimals);
    const stop = onVisible(el, () => {
      stop();
      const t0 = performance.now();
      const dur = 1400;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
}

export function initMotion() {
  (window as unknown as { __igMotion?: boolean }).__igMotion = true;
  initReveal();
  initCounters();
}
