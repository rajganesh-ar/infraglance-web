// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

/** Cloudflare's published Turnstile test site keys (always pass / always fail / force interactive). */
const TEST_SITE_KEY = /^[123]x0{20}[A-F]{2}$/;
const ZERO_UUID = /"database_id"\s*:\s*"0{8}-0{4}-0{4}-0{4}-0{12}"/;

/**
 * Release guard. A release build is a Cloudflare Workers Builds run (WORKERS_CI=1) or `npm run deploy`.
 * It stops when a value that only fails at runtime is missing, instead of shipping a site that looks
 * fine but captures no leads:
 *   - PUBLIC_TURNSTILE_SITE_KEY: inlined at build time; without it the always-pass TEST key ships and
 *     every real submission fails verification. Set it under Worker → Settings → Build → Variables.
 *   - wrangler.jsonc database_id: the all-zero placeholder makes `wrangler deploy` fail.
 * ALLOW_TEST_TURNSTILE=1 deliberately allows the test key (e.g. a throwaway staging Worker).
 * Local builds only log a note.
 * @returns {import('astro').AstroIntegration}
 */
function releaseGuard() {
  return {
    name: 'infraglance:release-guard',
    hooks: {
      'astro:config:setup': ({ command, logger }) => {
        if (command !== 'build') return;
        const release = process.env.WORKERS_CI === '1' || process.env.npm_lifecycle_event === 'deploy';
        /** @type {string[]} */
        const problems = [];

        const env = loadEnv(process.env.NODE_ENV === 'development' ? 'development' : 'production', process.cwd(), 'PUBLIC_');
        const key = (env.PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
        if ((!key || TEST_SITE_KEY.test(key)) && process.env.ALLOW_TEST_TURNSTILE !== '1') {
          problems.push(
            'PUBLIC_TURNSTILE_SITE_KEY is not set (or is a Cloudflare test key), so the contact form would ship the always-pass TEST key. ' +
              'Set it as a BUILD variable: Workers & Pages → infraglance-web → Settings → Build → Variables and secrets.',
          );
        }

        let mailOff = false;
        try {
          const wrangler = readFileSync(new URL('./wrangler.jsonc', import.meta.url), 'utf8');
          if (ZERO_UUID.test(wrangler)) {
            problems.push(
              'wrangler.jsonc still has the placeholder D1 database_id. Run `npx wrangler d1 create infraglance-leads`, paste the id, then `npm run db:migrate:remote`.',
            );
          }
          // An uncommented send_email block needs a real, verified LEAD_TO inbox.
          mailOff = !/^\s*"send_email"\s*:/m.test(wrangler);
          if (!mailOff && /"LEAD_TO"\s*:\s*"[^"]*\.example"/.test(wrangler)) {
            problems.push('wrangler.jsonc enables send_email but vars.LEAD_TO is still the placeholder inbox.');
          }
        } catch {
          /* no wrangler.jsonc: nothing to check */
        }
        if (release && mailOff) logger.warn('Lead e-mails are off (send_email is commented out in wrangler.jsonc): leads are stored in D1 only.');

        if (!problems.length) return;
        if (release) throw new Error(`Release build stopped:\n  - ${problems.join('\n  - ')}`);
        logger.info(`Local build (fine for development):\n  - ${problems.join('\n  - ')}`);
      },
    },
  };
}

// Pages are prerendered to static HTML; only routes that opt out with
// `export const prerender = false` (the contact API) run on the Worker.
//
// URLs have no trailing slash (/platform, not /platform/). Pages build as platform/index.html and
// wrangler.jsonc sets assets.html_handling = "drop-trailing-slash", so Cloudflare serves /platform
// directly (no 307) and redirects /platform/ → /platform. Astro.url, canonicals and the sitemap all
// use the same slash-less form. (build.format 'file' would make Astro.url.pathname end in .html at
// build time, which breaks canonicals and active-nav matching, so it is deliberately not used.)
export default defineConfig({
  site: 'https://infraglance.com',
  output: 'static',
  trailingSlash: 'never',
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'passthrough',
  }),
  integrations: [
    releaseGuard(),
    mdx(),
    // Insight categories with fewer than two posts are noindex; keep them out of the sitemap too.
    // Keep this list in step with the noindex rule in src/pages/insights/category/[cat].astro.
    sitemap({ filter: (page) => !/\/insights\/category\/(infrastructure|edge-platform|strategy|regulation)\/?$/.test(page) }),
  ],
  build: { format: 'directory', inlineStylesheets: 'auto' },
  vite: {
    build: {
      // three.js core is ~700 kB minified (~180 kB brotli) and loads only on pages with a 3D scene.
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Stable vendor chunks: a scene or kit change no longer invalidates the cached three.js core.
          manualChunks(id) {
            if (/[\\/]node_modules[\\/]three[\\/]build[\\/]/.test(id)) return 'three';
            if (/[\\/]node_modules[\\/](postprocessing|n8ao)[\\/]/.test(id)) return 'postfx';
            return undefined;
          },
        },
      },
    },
  },
});
