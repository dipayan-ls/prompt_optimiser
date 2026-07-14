import { createAdapters, type AdapterEnv } from '../shared/adapters';
import { optimize, parseRequest, RequestError } from '../shared/pipeline';

export interface Env extends AdapterEnv {
  /** Comma-separated origins allowed to call this Worker. */
  ALLOWED_ORIGINS?: string;
  /** Best-effort per-IP requests per minute. Set to "0" to disable. */
  RATE_LIMIT_PER_MINUTE?: string;
}

const DEFAULT_ORIGINS = ['https://dipayan.shop', 'http://localhost:3000', 'http://127.0.0.1:3000'];

function allowedOrigins(env: Env): string[] {
  const configured = env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

/**
 * Best-effort limiter. Worker isolates are per-location and short-lived, so this
 * only blunts casual abuse — see README for the WAF rule that does the real job.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string, perMinute: number): boolean {
  if (perMinute <= 0) return false;
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    if (hits.size > 10_000) {
      for (const [key, value] of hits) if (now > value.resetAt) hits.delete(key);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > perMinute;
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname.endsWith('/health')) {
      const adapters = createAdapters(env);
      return json(
        { ok: true, engines: adapters.map((a) => a.name), fallback: 'rule-based' },
        200,
        cors,
      );
    }

    if (request.method !== 'POST' || !url.pathname.endsWith('/optimize')) {
      return json({ error: 'Not found' }, 404, cors);
    }

    // Reject cross-origin callers that are not on the allowlist. Same-origin and
    // non-browser callers send no Origin header and are allowed through.
    const origin = request.headers.get('Origin');
    if (origin && !cors['Access-Control-Allow-Origin']) {
      return json({ error: 'Origin not allowed' }, 403, cors);
    }

    const perMinute = Number(env.RATE_LIMIT_PER_MINUTE ?? '12');
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (rateLimited(ip, Number.isFinite(perMinute) ? perMinute : 12)) {
      return json(
        { error: 'Too many requests. Wait a minute and try again.' },
        429,
        { ...cors, 'Retry-After': '60' },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400, cors);
    }

    try {
      const parsed = parseRequest(body);
      const result = await optimize(parsed, {
        adapters: createAdapters(env),
        // Log failures only. Prompt content never leaves this function.
        log: (message) => console.log(message),
      });
      return json(result, 200, { ...cors, 'Cache-Control': 'no-store' });
    } catch (error) {
      if (error instanceof RequestError) {
        return json({ error: error.message }, error.status, cors);
      }
      console.error('unexpected failure', (error as Error).message);
      return json({ error: 'Something went wrong optimizing that prompt.' }, 500, cors);
    }
  },
};
