/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
  LEAD_MAIL?: SendEmail;
  LEAD_FROM: string;
  LEAD_TO: string;
  TURNSTILE_SECRET?: string;
  ASSETS: Fetcher;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
}
