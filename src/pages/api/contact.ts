import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { site } from '../../data/site';

// The only on-demand route: runs on the Worker (wrangler.jsonc routes /api/* to it first).
export const prerender = false;

/**
 * Demo-request endpoint: validation → Turnstile → rate limit → D1 → email.
 *
 * Accepts two encodings:
 *   - JSON (the form's fetch path)       → always answers JSON { ok } / { error, fields? }
 *   - a normal form post (no-JS fallback) → answers 303 to /contact?sent=1#sent or ?error=1#form-error
 *
 * Personal data never goes into a URL or a log line. Logs carry only the failing step and the
 * error message.
 */

const MAX_BODY = 32 * 1024;
const RATE_LIMIT = 5; // submissions per IP per hour
const SALES = site.salesEmail;

const Lead = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(1).max(160),
  role: z.string().trim().max(120).optional().nullable(),
  industry: z.string().trim().max(60).optional().nullable(),
  interests: z.array(z.string().trim().max(30)).max(10).optional().default([]),
  message: z.string().trim().max(4000).optional().nullable(),
  topic: z.string().trim().max(40).optional().nullable(),
  hp_url: z.string().optional().nullable(), // honeypot: people never see it, bots fill it
  token: z.string().max(4096).optional().nullable(),
});
type Lead = z.infer<typeof Lead>;

const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8' } });

const seeOther = (request: Request, ok: boolean) =>
  new Response(null, {
    status: 303,
    headers: { ...HEADERS, location: new URL(ok ? '/contact?sent=1#sent' : '/contact?error=1#form-error', request.url).href },
  });

/** Error message only — never the request, the lead or a stack with values in it. */
const why = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads the body with a running byte count and stops at MAX_BODY, so a chunked upload (or HTTP/2
 * without Content-Length) cannot make the Worker buffer an arbitrarily large body. Null when too big.
 */
async function readCapped(request: Request) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    buf.set(c, at);
    at += c.byteLength;
  }
  return buf;
}

/** Reads JSON or a form post into a plain object. Returns null when the body is unusable. */
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  // Fast path: a declared length over the cap is refused before any byte is read.
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return null;
  const rawType = request.headers.get('content-type') ?? '';
  const type = rawType.toLowerCase();

  const buf = await readCapped(request);
  if (!buf) return null;

  if (type.includes('multipart/form-data')) {
    // The original header, not the lowercased copy: the multipart boundary is case-sensitive.
    const fd = await new Response(buf, { headers: { 'content-type': rawType } }).formData();
    const out: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && k !== 'interests') out[k] = v;
    });
    out.interests = fd.getAll('interests').filter((v): v is string => typeof v === 'string');
    out.token = out['cf-turnstile-response'] ?? null;
    return out;
  }

  const raw = new TextDecoder().decode(buf);

  if (type.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    const out: Record<string, unknown> = {};
    params.forEach((v, k) => {
      if (k !== 'interests') out[k] = v;
    });
    out.interests = params.getAll('interests');
    out.token = params.get('cf-turnstile-response');
    return out;
  }

  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

type Verdict = 'ok' | 'rejected' | 'unavailable';

/** Server-side Turnstile check. Fails closed. */
async function verifyTurnstile(secret: string, token: string, ip: string): Promise<Verdict> {
  if (!token) return 'rejected';
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[contact] turnstile siteverify HTTP', res.status);
      return 'unavailable';
    }
    const data = (await res.json()) as { success?: boolean; action?: string; 'error-codes'?: string[] };
    if (data.success !== true) {
      console.warn('[contact] turnstile rejected', (data['error-codes'] ?? []).join(','));
      return 'rejected';
    }
    // Cloudflare's test keys return an empty action; a real widget returns 'contact'.
    if (data.action && data.action !== 'contact') return 'rejected';
    return 'ok';
  } catch (err) {
    console.error('[contact] turnstile siteverify failed:', why(err));
    return 'unavailable';
  }
}

// ---------------------------------------------------------------- email (RFC 5322 / 2045 / 2047)

const CRLF = '\r\n';
const utf8 = (s: string) => new TextEncoder().encode(s);

function base64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Header text as RFC 2047 encoded-words: ≤ 42 UTF-8 bytes each, so a word is ≤ 68 chars and the first header line ≤ 78. */
function encodeHeader(text: string) {
  const words: string[] = [];
  let chunk = '';
  for (const ch of text) {
    if (chunk && utf8(chunk + ch).length > 42) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${base64(utf8(w))}?=`).join(`${CRLF} `);
}

/** Plain-text MIME message for the send_email binding; the body is base64 (no 998-char line limit issues). */
function mime(from: string, to: string, subject: string, text: string, replyTo: string) {
  const clean = (s: string) => s.replace(/[\r\n<>"]/g, '');
  const body = base64(utf8(text.replace(/\r?\n/g, CRLF))).replace(/.{76}(?=.)/g, `$&${CRLF}`);
  return [
    `From: Infraglance Website <${clean(from)}>`,
    `To: <${clean(to)}>`,
    `Reply-To: <${clean(replyTo)}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: <${crypto.randomUUID()}@${clean(from).split('@')[1] ?? 'infraglance.com'}>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join(CRLF);
}

async function sendLeadMail(env: Env, lead: Lead, interests: string, country: string | null, tag: string) {
  if (!env.LEAD_MAIL || !env.LEAD_FROM || !env.LEAD_TO) return false;
  const { EmailMessage } = await import('cloudflare:email');
  const text = [
    `New website lead${lead.topic ? ` (${lead.topic})` : ''}${tag ? ` ${tag}` : ''}`,
    '',
    `Name:      ${lead.name}`,
    `Email:     ${lead.email}`,
    `Company:   ${lead.company}`,
    `Role:      ${lead.role || '-'}`,
    `Industry:  ${lead.industry || '-'}`,
    `Interests: ${interests || '-'}`,
    `Country:   ${country ?? '-'}`,
    '',
    lead.message ?? '',
  ].join('\n');
  const subject = `${tag ? `${tag} ` : ''}Demo request: ${lead.company.slice(0, 80)}`;
  const raw = mime(env.LEAD_FROM, env.LEAD_TO, subject, text, lead.email);
  await env.LEAD_MAIL.send(new EmailMessage(env.LEAD_FROM, env.LEAD_TO, raw));
  return true;
}

/** Tags test traffic so it is easy to tell apart: version previews and local dev. */
function trafficTag(request: Request) {
  const host = new URL(request.url).hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return '[local]';
  // Preview URLs look like <version-or-alias>-<worker>.<subdomain>.workers.dev
  if (host.endsWith('.workers.dev') && host.split('.')[0].includes('-infraglance-web')) return '[preview]';
  return '';
}

// ---------------------------------------------------------------- handler

export const POST: APIRoute = async ({ request, locals }) => {
  const type = (request.headers.get('content-type') ?? '').toLowerCase();
  const isFormPost = type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data');
  const fail = (status: number, error: string, fields?: string[]) =>
    isFormPost ? seeOther(request, false) : json(status, fields?.length ? { error, fields } : { error });
  const succeed = () => (isFormPost ? seeOther(request, true) : json(200, { ok: true }));

  try {
    const env = locals.runtime?.env;
    if (!env) {
      console.error('[contact] no runtime env (bindings missing)');
      return fail(500, `The form is not configured yet. Please email ${SALES}.`);
    }

    let body: Record<string, unknown> | null;
    try {
      body = await readBody(request);
    } catch {
      body = null;
    }
    if (!body) return fail(400, 'Invalid request.');

    const parsed = Lead.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(Boolean);
      return fail(400, 'Please check your name, email and company.', fields);
    }
    const lead = parsed.data;

    // Bots fill the hidden field: pretend success, store nothing.
    if (lead.hp_url) return succeed();

    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const country = request.headers.get('cf-ipcountry') ?? null;
    const tag = trafficTag(request);

    // 1. Turnstile
    if (!env.TURNSTILE_SECRET) {
      console.error('[contact] TURNSTILE_SECRET is not set');
      return fail(500, `The form is not configured yet. Please email ${SALES}.`);
    }
    const verdict = await verifyTurnstile(env.TURNSTILE_SECRET, lead.token ?? '', ip);
    if (verdict === 'rejected') return fail(400, 'The spam check failed. Please try again.');
    if (verdict === 'unavailable') return fail(503, `The spam check is unavailable right now. Please try again in a minute, or email ${SALES}.`);

    // 2. Rate limit (best effort): max RATE_LIMIT submissions per IP per hour. The IP is only stored hashed.
    const ipHash = ip ? await sha256(`${ip}:${env.TURNSTILE_SECRET}`) : null;
    if (ipHash && env.DB) {
      try {
        const row = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')",
        )
          .bind(ipHash)
          .first<{ n: number }>();
        if ((row?.n ?? 0) >= RATE_LIMIT) return fail(429, `Too many requests from your network. Please email ${SALES} instead.`);
      } catch (err) {
        console.error('[contact] rate-limit query failed:', why(err));
      }
    }

    // 3. Store, then notify. The request only fails when neither worked.
    const interests = lead.interests.join(',');
    let stored = false;
    if (env.DB) {
      try {
        const message = [tag ? `${tag} ` : '', lead.topic ? `[${lead.topic}] ` : '', lead.message ?? ''].join('');
        await env.DB.prepare(
          'INSERT INTO leads (name, email, company, role, industry, interests, message, ip_hash, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
          .bind(lead.name, lead.email, lead.company, lead.role || null, lead.industry || null, interests, message, ipHash, country)
          .run();
        stored = true;
      } catch (err) {
        console.error('[contact] D1 insert failed:', why(err));
      }
    } else {
      console.error('[contact] D1 binding DB is missing');
    }

    let mailed = false;
    try {
      mailed = await sendLeadMail(env, lead, interests, country, tag);
    } catch (err) {
      console.error('[contact] lead email failed:', why(err));
    }

    if (!stored && !mailed) return fail(503, `We could not save your request. Please email ${SALES}.`);
    return succeed();
  } catch (err) {
    console.error('[contact] unexpected failure:', why(err));
    return fail(500, `Something went wrong on our side. Please email ${SALES}.`);
  }
};

export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
  });
