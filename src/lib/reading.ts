/** Minutes to read a Markdown/MDX body at ~220 words per minute (components and code stripped). */
export function readingTime(body = '') {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(import|export)\s.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|\-]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Short house date, e.g. "2 Sep 2026" (three-letter months, never "Sept"). Read in UTC so a
 * date-only front-matter value ("2026-09-02") never slips to the previous day on a build machine
 * west of Greenwich. Unparseable input is returned as given.
 */
export function fmtDate(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** ISO date (YYYY-MM-DD) for <time datetime>. */
export const isoDate = (d: Date | string) => {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? String(d) : x.toISOString().slice(0, 10);
};

/** URL slug for an insight category, e.g. "Edge & Platform" → "edge-platform". */
export const catSlug = (c: string) => c.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Lower-cases a title's first letter for use mid-sentence while leaving acronyms intact:
 * "Micro-stops & OEE" → "micro-stops & OEE", "PPE compliance" → "PPE compliance".
 */
export const lcFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
