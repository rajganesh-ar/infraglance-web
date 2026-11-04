# Infraglance website

Marketing site for Infraglance: vision AI for industry and infrastructure.

- **Stack:** Astro 5 (static output, MDX insights), three.js 0.186 with postprocessing and N8AO for the 3D scenes, GSAP for the product mockups, IBM Plex Sans and IBM Plex Mono (self-hosted through Fontsource).
- **Hosting:** Cloudflare Workers with static assets. Every page is prerendered HTML. One Worker route, `/api/contact`, uses D1 (lead storage), Turnstile (spam check) and, optionally, Email Routing (lead notifications).
- **Delivery:** a private GitHub repository connected to Cloudflare Workers Builds. A push to `main` deploys, and other branches get preview versions. GitHub Actions runs a type-check and build on every push to `main` and every pull request.

## Prerequisites

- **Node 22** (pinned in `.nvmrc`, `engines` requires `>=22.12.0`) and npm.
- **ffmpeg and ffprobe** on `PATH`, only for `npm run media`.
- A Cloudflare account, only for deploying.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # Cloudflare's public Turnstile TEST secret, for the contact form
npm run db:migrate:local         # creates the local D1 leads table (.wrangler/, gitignored)
npm run dev                      # http://localhost:4321, hot reload
```

Without `PUBLIC_TURNSTILE_SITE_KEY`, the contact form uses Cloudflare's always-pass **test** site key. It pairs with the test secret in `.dev.vars`, so you can submit the form locally without real keys.

To run the production build on the real Workers runtime, with the asset routing and `_headers` that Cloudflare applies:

```bash
npm run preview                  # astro build && wrangler dev → http://localhost:8787
```

Other commands:

| Command | What it does |
|---|---|
| `npm run check` | Astro and TypeScript diagnostics |
| `npm run ci` | `astro check && astro build`, the same gate GitHub Actions runs |
| `npm run db:leads` | Shows the 20 newest leads from the **remote** D1 database |

Append `?nowebgl` to any URL to see the static fallbacks that reduced-motion and no-WebGL visitors get.

## Repository

**Keep the GitHub repository private.** The stock photo and video licences (Unsplash, Pexels, Pixabay, Mixkit, Coverr) allow use on this site. They do not allow redistributing the files as a collection, and a public repository would do exactly that.

What is committed and what is not:

- **Committed:** `public/media/` (the encoded, content-hashed photos and video the build ships), `public/models/` and `public/hdri/` (3D people and lighting), `src/data/media.json`, `src/data/credits-3d.json`, `assets/credits.json` and `package-lock.json`. No file is near GitHub's 100 MB limit, so Git LFS is not needed.
- **Not committed (`.gitignore`):** `assets/raw/` (original downloads, about 175 MB; back it up separately), `dist/`, `.astro/`, `.wrangler/` (local D1 data, including test leads), `.dev.vars`, `.env*` and `.claude/`.
- `.gitattributes` stores text with LF line endings and marks media as binary, so Windows checkouts do not rewrite files.

First push, from the real project folder:

```bash
git init -b main
git add -A
git commit -m "Initial commit"
gh repo create infraglance-web --private --source . --push
```

If a large HTTPS push fails on Windows, run `git config http.postBuffer 524288000` and push again.

## Deploy: GitHub → Cloudflare Workers Builds

### One-time setup

1. **Log in:** `npx wrangler login`.
2. **Add the domain:** add `infraglance.com` to your Cloudflare account (DNS on Cloudflare).
3. **Create the lead database:**
   ```bash
   npx wrangler d1 create infraglance-leads
   ```
   Paste the returned `database_id` into the existing `d1_databases` entry in `wrangler.jsonc`, replacing the all-zero placeholder, and commit it. A D1 id is an identifier, not a secret. If wrangler offers to add the binding for you, decline, because the binding already exists. Then create the table:
   ```bash
   npm run db:migrate:remote
   ```
4. **Turnstile:** in the dashboard, open Turnstile and add a widget in Managed mode. Add every hostname that will show the form: `infraglance.com`, `www.infraglance.com` and, for testing, `<your-subdomain>.workers.dev`. That one entry covers the workers.dev copy and every branch preview host (`<version>-infraglance-web.<your-subdomain>.workers.dev`). Keep the **site key** and the **secret key** for the steps below.
5. **Lead emails (optional, recommended):** Email Routing can only deliver to a **verified destination address**, which must be a real external mailbox (Google Workspace, Microsoft 365, Gmail and so on). An alias such as `sales@infraglance.com` that only forwards cannot be verified.
   1. Open infraglance.com → Email → Email Routing and enable it.
   2. Under Destination addresses, add and verify the inbox.
   3. In `wrangler.jsonc`, uncomment the `send_email` block and put that inbox in both `destination_address` and `vars.LEAD_TO`.
   4. Also create routing rules for `hello@`, `sales@` and `careers@infraglance.com` that forward to the same inbox, because the site links to those addresses.

   Until this step is done, leads are stored in D1 only.
6. **Connect the repository:** go to Workers & Pages → Create → Import a repository, then pick the GitHub repo. To connect an existing Worker instead, open it and go to Settings → Builds → Connect.

   | Setting | Value |
   |---|---|
   | Worker name | `infraglance-web` (must equal `name` in `wrangler.jsonc`) |
   | Production branch | `main` |
   | Root directory | *(empty)* |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Non-production branch deploy command | `npx wrangler versions upload` (the default) |

   Workers Builds installs with `npm ci` and picks up Node 22 from `.nvmrc`. If a build log shows another Node version, also add a `NODE_VERSION` = `22` build variable.
7. **Build variables:** open Settings → Build → Variables and secrets. These are inlined into the HTML at **build** time, so runtime variables cannot replace them.
   - `PUBLIC_TURNSTILE_SITE_KEY` = the Turnstile site key (**required**)
   - `PUBLIC_CF_BEACON_TOKEN` = the Web Analytics token (optional; see step 10)
8. **Runtime secret:** after the first deploy has created the Worker, either open Settings → Variables and secrets → Add → Secret, or run:
   ```bash
   npx wrangler secret put TURNSTILE_SECRET
   ```
   Secrets persist across deploys. Until this secret is set, the form answers "not configured".
9. **Custom domain:** open the Worker → Settings → Domains & Routes → Add → Custom domain, and add `infraglance.com` and `www.infraglance.com`. The other way is to uncomment `routes` in `wrangler.jsonc`. Add a Redirect Rule from `www` to the apex domain (301). Once the domain serves the site, set `"workers_dev": false` so the copy on `*.workers.dev` is not indexed as duplicate content. Leave `"preview_urls": true` in place so branch previews keep working.
10. **Analytics (optional):** there are two ways. Either enable Web Analytics' automatic setup for the zone, or add a site manually and set its token as the `PUBLIC_CF_BEACON_TOKEN` build variable, then rebuild. Use one or the other, not both, or every visit is counted twice. The CSP in `public/_headers` already allows the beacon.

### Release guard

A build stops with a clear message, rather than deploying a site that looks fine but captures no leads, when **any** of these is true:

- `PUBLIC_TURNSTILE_SITE_KEY` is missing or is a Cloudflare test key.
- `wrangler.jsonc` still has the placeholder `database_id`.
- `send_email` is enabled while `LEAD_TO` is still the placeholder.

The guard runs on Workers Builds (`WORKERS_CI=1`) and on `npm run deploy`. Local builds and GitHub Actions only print a note. To deploy the test key on purpose, for example to a throwaway staging Worker, set `ALLOW_TEST_TURNSTILE=1`. The guard is `releaseGuard()` in `astro.config.mjs`.

### Variables and secrets

| Name | Kind | Where it is set | Needed for |
|---|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | build variable | Workers Builds → Build variables (locally: `.env`) | Turnstile widget |
| `PUBLIC_CF_BEACON_TOKEN` | build variable | Workers Builds → Build variables (locally: `.env`) | Web Analytics (optional) |
| `TURNSTILE_SECRET` | runtime secret | `wrangler secret put` or the dashboard (locally: `.dev.vars`) | Server-side Turnstile check |
| `LEAD_FROM`, `LEAD_TO` | runtime vars | `wrangler.jsonc` → `vars` (overwritten on every deploy) | Lead email |
| `DB` | D1 binding | `wrangler.jsonc` → `d1_databases` | Lead storage |
| `LEAD_MAIL` | send_email binding | `wrangler.jsonc` → `send_email` (commented out until Email Routing is set up) | Lead email |

### Everyday flow

- **Production:** push or merge to `main`, then Workers Builds builds and runs `wrangler deploy`. Wrangler uploads only changed asset hashes, so after the first upload (about 180 MB) deploys are small.
- **Previews:** other branches run `wrangler versions upload` and get a preview URL (`"preview_urls": true` in `wrangler.jsonc` keeps them on, even after `workers_dev` is turned off). Previews share the production bindings, so a test submission lands in the real leads table. Such leads are tagged `[preview]` in the stored message and the email subject. Local tests are tagged `[local]`.
- **Database changes:** add `migrations/000N_description.sql`. Run `npm run db:migrate:local` to test it, then run `npm run db:migrate:remote` before merging code that needs it. Builds do not run migrations.
- **Reading leads:** run `npm run db:leads`, or open the dashboard → D1 → infraglance-leads → Console.

### Checks after the first deploy

```bash
H=https://infraglance.com
curl -sI $H/platform | head -1            # 200, served without a redirect
curl -sI $H/platform/ | grep -i location  # 307 → /platform
curl -sI $H/does-not-exist | head -1      # 404 (the site's 404 page)
curl -sI $H/ | grep -i content-security   # CSP present
curl -sI $H/_astro/<any-file>.js | grep -i cache-control      # immutable
curl -s -o /dev/null -D - -H "Range: bytes=0-1" $H/media/v/<any-clip>.mp4 | head -3
```

- **Video byte ranges:** the last command should return `206` with a `content-range` header. Safari and iOS need 206 responses to play `<video>`. If you get `200`, test on an iPhone. If the loops do not play there, serve `public/media/v` from an R2 bucket on a custom domain, which supports ranges, and add that host to `media-src` and `img-src` in `public/_headers`.
- **Contact form:** send one real request through the form. Then check that `npm run db:leads` shows it and that the email arrived.
- **Console:** open `/`, `/platform`, `/solutions/inspect` and `/contact` in Chrome DevTools and confirm the console shows no CSP or Permissions-Policy errors.

## Contact form flow

`src/components/ContactForm.astro` posts to `src/pages/api/contact.ts`.

- **With JavaScript:** the form sends JSON with `fetch`. It checks fields inline, moves focus to the first invalid field, and blocks double submits. On success it shows a thank-you state.
- **Without JavaScript**, or if the script fails to load: a normal `POST`. The API answers with a `303` redirect to `/contact?sent=1#sent` or `/contact?error=1#form-error`, and CSS `:target` rules show the matching message. Personal data never goes into a URL.
- **Order of steps in the API:** validation → honeypot → Turnstile (fails closed) → rate limit (5 per IP per hour, using a hashed IP) → D1 insert → email. The request only fails when neither storage nor email worked. Logs record the failing step, never the lead.

## Media pipeline (photos and video)

Stock media is free-licence (Unsplash, Pexels, Pixabay, Mixkit, Coverr, Wikimedia CC0 / CC BY). Each file is listed with author and licence in `assets/credits.json` and shown on `/credits`. Pages refer to media only by **key** (see `docs/media-shotlist.md`), through `src/lib/media.ts` and the `Picture` / `Video` components.

1. Put raw files in `assets/raw/photos/<key>.jpg` and `assets/raw/video/<key>.mp4`.
2. Add an entry for each file to `assets/credits.json`.
3. Run `npm run media`. It colour-grades every asset towards the site palette (one 3D LUT per asset, shared by a video and its poster) and writes:
   - photos as AVIF and JPEG at 640–2600 px, in `public/media/p/`
   - video as loops of up to 10 s in H.264 and VP9 at 1920 and 1280 px, with a graded poster, in `public/media/v/`
   - the manifest `src/data/media.json` (dimensions, dominant colour, srcsets, credits)

Flags: `--photos`, `--videos`, `--only=key1,key2`, `--force` (re-encode) and `--clean` (delete outputs the manifest no longer references). Run with `--clean` before committing re-encoded media.

Output names contain a hash of the source **and** the grade settings, so `/media/*` can be cached as immutable. Changing the grade produces new URLs. A missing key renders a neutral placeholder, never a broken image.

## 3D people pipeline

The animated site workers in the 3D scenes are **Microsoft Rocketbox** avatars (MIT licence). The daylight HDRI is from **Poly Haven** (CC0). Both are credited on `/credits` via `src/data/credits-3d.json`.

```bash
npm run people              # download missing sources → convert (FBX2glTF) → optimise (meshopt) → write outputs
npm run people -- --check   # only verify the existing outputs (sizes, bones, clip targets)
```

- Sources are cached in `assets/raw/3d/` (gitignored).
- Outputs are `public/models/people/worker-{m1,m2,f1}.glb`, `public/models/anim/{m,f}-{walk,idle}.glb`, the HDRI in `public/hdri/` and `src/data/credits-3d.json`.
- The Rocketbox MIT notice ships next to the models as `public/models/LICENSE-Rocketbox.txt`.
- `src/three/core/people.ts` loads the models with `GLTFLoader` and the meshopt decoder. For this reason the CSP allows `'wasm-unsafe-eval'` and `blob:`.
- `/models/*` and `/hdri/*` file names are **not** hashed, so they are cached for 7 days with 30 days of stale-while-revalidate (`public/_headers`). A regenerated model reaches returning visitors within about a week; rename the file only if it must show up immediately.

## Project layout

| Path | What it is |
|---|---|
| `src/data/` | Site content: pillars, products, industries, use cases, FAQ, site details (`site.ts`), media manifest |
| `src/pages/` | Routes. `solutions/[pillar]`, `products/[slug]`, `industries/[slug]` and `use-cases/[slug]` are generated from `src/data` |
| `src/pages/api/contact.ts` | Demo-request endpoint (the only Worker route) |
| `src/content/insights/` | Insight articles (MDX). `<Figure img="key" …/>` and `<Callout>` work without imports |
| `src/styles/` | `tokens.css` (type scale, spacing, colours, tones) and `global.css` |
| `src/three/` | three.js scenes. `core/stage.ts` is the renderer and post chain, `core/kit.ts` holds materials and primitives, `core/people.ts` the animated workers, `scenes/*` the scenes, `registry.ts` the lazy loaders |
| `src/components/Scene.astro` | Lazy island that mounts a scene when it scrolls into view |
| `src/components/mockups/` | Animated software mockups (HTML/SVG + GSAP), all labelled "Demo data" |
| `src/components/media/` | `Picture` (AVIF/JPEG srcset) and `Video` (lazy muted loops with poster) |
| `scripts/` | `media.mjs` (photo/video pipeline), `people.mjs` (3D people), `og.mjs` (regenerates `public/og/default.png`) |
| `public/_headers` | Security headers (CSP, HSTS…) and long-term caching for hashed assets |
| `wrangler.jsonc` | Worker, asset routing, D1 and email bindings (with setup notes) |
| `migrations/` | D1 schema migrations |
| `.github/workflows/ci.yml` | Type-check and build on push and pull request (no secrets) |

To add a product, add an entry to `src/data/products.ts`. Its page, catalogue card and links are generated automatically.

## House style

- **British English (en-GB)** in all visible copy: colour, catalogue, programme, centre, digitise, behaviour, licence, aluminium. Pages declare `lang="en-GB"`.
- **One documented exception: "analog"**, as in analog gauges. It is the instrumentation term, and it is already in URLs (`/use-cases/analog-gauge-reading`, `/insights/digitising-analog-gauges-brownfield-plants`). Do not write "analogue".
- **"email"**, not "e-mail".
- **Curly apostrophes and quotes** (’ “ ”) in visible text, including MDX front matter, captions and alt text.
- **Slugs follow names**, for example `/products/inspect-colour` for Inspect Colour.
- **Titles** stay within 60 characters including " | Infraglance" and never end in a full stop. An insight with a long headline sets `seoTitle` (at most 46 characters). **Meta descriptions** stay within about 155 characters.
- **Honesty:** mockups keep their "Demo data" label and synthetic images their "Illustrative" label. Stock photos of people never stand in for Infraglance staff, labs, offices or deployments, and no photo with a legible third-party brand is used as a hero or backdrop (see `docs/media-shotlist.md`).

## Before launch

- [ ] D1 is created, `database_id` is committed, and `npm run db:migrate:remote` has run.
- [ ] The Turnstile widget covers all live hostnames. `PUBLIC_TURNSTILE_SITE_KEY` is set as a **build** variable and `TURNSTILE_SECRET` as a **secret**.
- [ ] Email Routing is enabled and the inbox is verified. `send_email` is uncommented and `LEAD_TO` set, or you have decided to read leads from D1.
- [ ] Routing rules exist for `hello@`, `sales@` and `careers@infraglance.com`, or `src/data/site.ts` has been changed to real addresses. Check the LinkedIn URL there too.
- [ ] The custom domain is live, the `www` redirect is in place, and `"workers_dev": false` is set.
- [ ] The post-deploy checks above pass, including video on iOS Safari and one real form submission.
- [ ] Legal has reviewed `src/pages/privacy.astro` and `src/pages/terms.astro` (review pending: see the comment at the top of each file), and the controller's registered legal name and postal address are added to the "Who is responsible" section of /privacy.
- [ ] Contact requests are purged after 24 months, as /privacy promises. Until a scheduled job exists, run this monthly:
      `npx wrangler d1 execute infraglance-leads --remote --command "DELETE FROM leads WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-24 months')"`
- [ ] Product phases (`Available` / `Early access` / `Roadmap`) in `src/data/products.ts` match what you can deliver.
- [ ] No customer logos, testimonials, certifications or metrics appear unless they are real and approved. Mockups keep their "Demo data" label.
- [ ] External facts in `src/content/insights/` are checked before publishing, especially EU AI Act dates.
- [ ] The repository is **private**.
