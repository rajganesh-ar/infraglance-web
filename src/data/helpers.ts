import type { Product } from './products';

/**
 * Lowercase the first letter of a title so it reads naturally mid-sentence,
 * without breaking acronyms: "Micro-stops & OEE" → "micro-stops & OEE",
 * "PPE compliance" stays "PPE compliance", "Construction & EPC" → "construction & EPC".
 */
export const lcFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** Bind a spaced em/en dash to the word before it (no-break space), so no line starts with "— …". */
export const nb = (t: string) => t.replace(/\s+([—–])\s+/g, ' $1 ');

/** nb() applied to every string in a data structure (arrays and plain objects), keeping its shape. */
export const nbDeep = <T>(v: T): T =>
  (typeof v === 'string'
    ? nb(v)
    : Array.isArray(v)
      ? v.map(nbDeep)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, nbDeep(x)]))
        : v) as T;

/**
 * Grid class for a list of `n` cards, chosen so no row is left half-empty:
 * multiples of 4 → 4 columns (2 on tablet), multiples of 6 → 3 columns (2 on tablet),
 * exactly 2 → two columns, anything else → the balanced grid that centres the last row.
 */
export const gridFor = (n: number) =>
  n % 4 === 0 ? 'grid grid-4' : n % 6 === 0 ? 'grid grid-3' : n === 2 ? 'grid grid-2' : 'grid-bal';

/**
 * Backdrops that suit a closing call to action: quiet, cool and legible behind white text, with no
 * legible third-party brand marks at full width (port-terminal is kept to thumbnails for that reason).
 */
export const ctaPool = ['industrial-night', 'steel-plant', 'cement-plant', 'robot-cell', 'v-refinery-night', 'chemical-plant-night'];

/** ctaPool rotated by a seed (e.g. a slug), so pages built from one template don't all fall back to the same backdrop. */
export const ctaPoolFor = (seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const i = h % ctaPool.length;
  return [...ctaPool.slice(i), ...ctaPool.slice(0, i)];
};

/**
 * First media key from `candidates` that the page does not already show, so one page never
 * repeats a photo (e.g. a CTA backdrop that is also a card two sections up).
 */
export function freshImage(candidates: (string | undefined)[], used: Iterable<string | undefined>, fallback = 'industrial-night') {
  const seen = new Set([...used].filter(Boolean));
  return candidates.find((k): k is string => !!k && !seen.has(k)) ?? fallback;
}

/** Media keys a page shows inside a pillar's app mockup (so cards and backdrops avoid them). */
export const mockImages: Record<string, string[]> = {
  guard: ['v-warehouse-forklift'],
  infra: ['concrete-crack'],
};

/** Primary call to action for a product, honest about its phase. */
export function phaseCta(it: Pick<Product, 'phase' | 'slug'>) {
  if (it.phase === 'Available') return { label: 'Book a demo', href: `/contact?topic=demo-${it.slug}` };
  if (it.phase === 'Early access') return { label: 'Join early access', href: `/contact?topic=early-access-${it.slug}` };
  return { label: 'Register interest', href: `/contact?topic=roadmap-${it.slug}` };
}
