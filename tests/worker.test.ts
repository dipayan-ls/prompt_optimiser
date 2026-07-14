import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../worker/index';

/**
 * Integration tests: these drive the real Worker fetch handler end-to-end —
 * routing, CORS, rate limiting, the pipeline, and the fallback. Only the
 * outbound HTTP call to the model provider is mocked, so everything between the
 * request and the response is the code that ships.
 */

const ORIGIN = 'https://dipayan.shop';

function env(overrides: Partial<Env> = {}): Env {
  return { ALLOWED_ORIGINS: ORIGIN, RATE_LIMIT_PER_MINUTE: '0', ...overrides };
}

function post(body: unknown, origin: string | null = ORIGIN): Request {
  return new Request('https://api.example.com/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {}),
      'CF-Connecting-IP': '203.0.113.1',
    },
    body: JSON.stringify(body),
  });
}

/** A Groq-shaped success response. */
function groqReply(content: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const MODEL_OUTPUT = {
  taskType: 'writing',
  variations: [
    { optimizedPrompt: 'You are a senior copywriter. Draft a post about cats.', optimizedFormat: 'Text', rationale: 'Added a role.' },
  ],
  assumptions: ['Assumed the audience is cat owners, not veterinarians.'],
  openQuestions: [],
  recommendations: ['Add a role.', 'Name the audience.', 'Specify length.'],
};

afterEach(() => vi.unstubAllGlobals());

describe('worker routing', () => {
  it('answers preflight with the allowed origin', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.com/optimize', { method: 'OPTIONS', headers: { Origin: ORIGIN } }),
      env(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('omits the allow-origin header for a disallowed origin', async () => {
    const response = await worker.fetch(post({ prompt: 'hi' }, 'https://evil.example'), env());
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('reports configured engines on /health', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.com/health', { headers: { Origin: ORIGIN } }),
      env({ GROQ_API_KEY: 'gsk_test' }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      engines: ['groq:llama-3.3-70b-versatile'],
    });
  });

  it('404s an unknown route', async () => {
    const response = await worker.fetch(new Request('https://api.example.com/nope'), env());
    expect(response.status).toBe(404);
  });

  it('400s a malformed JSON body', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.com/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: 'not json',
      }),
      env(),
    );
    expect(response.status).toBe(400);
  });

  it('400s an empty prompt with an actionable message', async () => {
    const response = await worker.fetch(post({ prompt: '' }), env());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Enter a prompt before optimizing.' });
  });
});

describe('worker optimize', () => {
  it('returns a model-backed rewrite when the provider succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => groqReply(MODEL_OUTPUT)));

    const response = await worker.fetch(post({ prompt: 'write about cats' }), env({ GROQ_API_KEY: 'gsk_test' }));
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(false);
    expect(body.engine).toContain('groq');
    expect(body.variations[0].optimizedPrompt).toContain('senior copywriter');
  });

  it('never caches a response containing a user prompt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => groqReply(MODEL_OUTPUT)));
    const response = await worker.fetch(post({ prompt: 'write about cats' }), env({ GROQ_API_KEY: 'gsk_test' }));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('degrades to rule-based when the provider is rate-limited', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })));

    const response = await worker.fetch(post({ prompt: 'write about cats' }), env({ GROQ_API_KEY: 'gsk_test' }));
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(true);
    expect(body.engine).toBe('rule-based');
    expect(body.degradedReason).toContain('rate-limited');
  });

  it('degrades when the provider returns gibberish', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        groqReply({ variations: [{ optimizedPrompt: 'aa aa aa aa aa aa aa aa aa aa', optimizedFormat: 'Text', rationale: '' }] }),
      ),
    );

    const response = await worker.fetch(post({ prompt: 'write about cats' }), env({ GROQ_API_KEY: 'gsk_test' }));
    const body = (await response.json()) as any;
    expect(body.degraded).toBe(true);
  });

  it('serves rule-based when no key is configured, rather than erroring', async () => {
    const response = await worker.fetch(post({ prompt: 'In order to write a post about cats' }), env());
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(true);
    expect(body.variations[0].optimizedPrompt).not.toContain('In order to');
  });

  it('works with MODEL_BACKEND unset, defaulting to auto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => groqReply(MODEL_OUTPUT)));
    const withoutBackend = env({ GROQ_API_KEY: 'gsk_test' });
    delete withoutBackend.MODEL_BACKEND;

    const response = await worker.fetch(post({ prompt: 'write about cats' }), withoutBackend);
    await expect(response.json()).resolves.toMatchObject({ degraded: false });
  });

  it('never sends the API key to the browser', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => groqReply(MODEL_OUTPUT)));
    const response = await worker.fetch(post({ prompt: 'write about cats' }), env({ GROQ_API_KEY: 'gsk_SUPERSECRET' }));
    expect(await response.text()).not.toContain('gsk_SUPERSECRET');
  });

  it('enforces the rate limit once the budget is spent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => groqReply(MODEL_OUTPUT)));
    const limited = env({ GROQ_API_KEY: 'gsk_test', RATE_LIMIT_PER_MINUTE: '2' });

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await worker.fetch(post({ prompt: 'write about cats' }), limited)).status);
    }

    expect(statuses.slice(0, 2)).toEqual([200, 200]);
    expect(statuses[3]).toBe(429);
  });
});
