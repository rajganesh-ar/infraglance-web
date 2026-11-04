import type { PillarSlug } from './pillars';
import type { IndustrySlug } from './industries';

/**
 * A use-case page (/use-cases/[slug]). Photo and video keys come from
 * docs/media-shotlist.md; product slugs from src/data/products.ts.
 */
export interface UseCase {
  slug: string;
  title: string; // short, e.g. "Forklift–pedestrian safety"
  pillar: PillarSlug;
  industries: IndustrySlug[];
  headline: string; // hero headline, one sentence
  summary: string; // 1–2 sentences for cards and meta description
  hero: string; // photo key
  heroAlt: string;
  video?: string; // optional video key (v-…)
  /** Why this problem matters: 2–3 short paragraphs. */
  problem: string[];
  /** What goes wrong with today's approaches: 3–5 bullets. */
  gaps: string[];
  /** How Infraglance solves it: 4–5 steps from capture to action. */
  workflow: { title: string; text: string }[];
  /** What the system detects or measures. */
  detects: string[];
  /** Hardware / setup needed. */
  setup: string[];
  /** KPIs to agree and measure in a pilot — no invented numbers. */
  measure: string[];
  /** Secondary photo key shown mid-page, with caption. */
  gallery: { img: string; alt: string; caption: string }[];
  products: string[]; // product slugs
  faq: { q: string; a: string }[];
}
