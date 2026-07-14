import { describe, expect, it, vi } from 'vitest';
import { MODEL_PROMPT_CHAR_LIMIT, optimize, parseRequest, RequestError } from '../shared/pipeline';
import {
  AdapterError,
  DEFAULT_OPTIONS,
  type ModelAdapter,
  type ModelResult,
  type OptimizeRequest,
} from '../shared/types';

const RESULT: ModelResult = {
  taskType: 'writing',
  variations: [
    { optimizedPrompt: 'You are a senior editor. Rewrite the passage below.', optimizedFormat: 'Text', rationale: 'Added a role.' },
  ],
  assumptions: ['Assumed the audience is a general reader.'],
  openQuestions: [],
  recommendations: ['Add a role.'],
};

/** A stub adapter — no real model call is ever made in unit tests. */
function stub(name: string, behaviour: ModelAdapter['optimize']): ModelAdapter {
  return { name, optimize: behaviour };
}

function request(overrides: Partial<OptimizeRequest> = {}): OptimizeRequest {
  return { prompt: 'write a blog post about cats', ...DEFAULT_OPTIONS, ...overrides };
}

describe('parseRequest', () => {
  // Engineer is the default deliberately: it is what the tool is for. A default
  // of "balanced" is what made rewrites come back as tidied summaries.
  it('defaults to engineer intensity', () => {
    const parsed = parseRequest({ prompt: 'hello world' });
    expect(parsed).toMatchObject({ tone: 'neutral', intensity: 'engineer', variations: 1 });
  });

  it('rejects an empty prompt', () => {
    expect(() => parseRequest({ prompt: '   ' })).toThrow(RequestError);
    expect(() => parseRequest({})).toThrow(RequestError);
  });

  it('rejects a non-object body', () => {
    expect(() => parseRequest('nope')).toThrow(RequestError);
    expect(() => parseRequest(null)).toThrow(RequestError);
  });

  it('rejects a prompt past the hard limit with a 413', () => {
    try {
      parseRequest({ prompt: 'x'.repeat(400_001) });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as RequestError).status).toBe(413);
    }
  });

  it('clamps variations into 1-3', () => {
    expect(parseRequest({ prompt: 'x', variations: 99 }).variations).toBe(3);
    expect(parseRequest({ prompt: 'x', variations: 0 }).variations).toBe(1);
    expect(parseRequest({ prompt: 'x', variations: 'abc' }).variations).toBe(1);
  });

  it('falls back to defaults for unknown tone and intensity', () => {
    const parsed = parseRequest({ prompt: 'x', tone: 'pirate', intensity: 'infinite' });
    expect(parsed.tone).toBe('neutral');
    expect(parsed.intensity).toBe('engineer');
  });

  it('accepts each valid intensity', () => {
    for (const intensity of ['compress', 'balanced', 'engineer'] as const) {
      expect(parseRequest({ prompt: 'x', intensity }).intensity).toBe(intensity);
    }
  });
});

describe('optimize', () => {
  it('returns the first adapter result and does not call the second', async () => {
    const second = vi.fn();
    const response = await optimize(request(), {
      adapters: [stub('primary', async () => RESULT), stub('secondary', second)],
    });

    expect(response.engine).toBe('primary');
    expect(response.degraded).toBe(false);
    expect(second).not.toHaveBeenCalled();
  });

  it('falls through to the next adapter on a retryable failure', async () => {
    const response = await optimize(request(), {
      adapters: [
        stub('primary', async () => {
          throw new AdapterError('rate limited', 'rate_limit', true);
        }),
        stub('secondary', async () => RESULT),
      ],
    });

    expect(response.engine).toBe('secondary');
    expect(response.degraded).toBe(false);
  });

  it('stops the chain on a non-retryable failure', async () => {
    const second = vi.fn();
    const response = await optimize(request(), {
      adapters: [
        stub('primary', async () => {
          throw new AdapterError('bad key', 'unauthorized', false);
        }),
        stub('secondary', second),
      ],
    });

    expect(second).not.toHaveBeenCalled();
    expect(response.degraded).toBe(true);
    expect(response.engine).toBe('rule-based');
  });

  it('degrades to rule-based when every adapter fails', async () => {
    const response = await optimize(request(), {
      adapters: [
        stub('a', async () => {
          throw new AdapterError('down', 'unavailable', true);
        }),
        stub('b', async () => {
          throw new AdapterError('down', 'unavailable', true);
        }),
      ],
    });

    expect(response.degraded).toBe(true);
    expect(response.engine).toBe('rule-based');
    expect(response.variations[0].optimizedPrompt.length).toBeGreaterThan(0);
    expect(response.degradedReason).toContain('unreachable');
  });

  it('degrades when no adapter is configured at all', async () => {
    const response = await optimize(request(), { adapters: [] });
    expect(response.degraded).toBe(true);
    expect(response.degradedReason).toContain('No model backend');
  });

  it('surfaces a rate-limit reason the user can act on', async () => {
    const response = await optimize(request(), {
      adapters: [
        stub('a', async () => {
          throw new AdapterError('429', 'rate_limit', true);
        }),
      ],
    });
    expect(response.degradedReason).toContain('rate-limited');
  });

  it('times out a hanging adapter and degrades', async () => {
    const response = await optimize(request(), {
      timeoutMs: 10,
      adapters: [
        stub('slow', (_p, _o, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new AdapterError('timed out', 'timeout', true)),
            );
          }),
        ),
      ],
    });

    expect(response.degraded).toBe(true);
    expect(response.degradedReason).toContain('too long');
  });

  it('routes an over-long prompt to rule-based without calling the model', async () => {
    const adapter = vi.fn();
    const response = await optimize(request({ prompt: 'a. '.repeat(MODEL_PROMPT_CHAR_LIMIT) }), {
      adapters: [stub('primary', adapter)],
    });

    expect(adapter).not.toHaveBeenCalled();
    expect(response.degraded).toBe(true);
    expect(response.degradedReason).toContain('longer than');
  });

  it('never logs prompt content', async () => {
    const log = vi.fn();
    const secret = 'CORRECT-HORSE-BATTERY-STAPLE';
    await optimize(request({ prompt: secret }), {
      adapters: [
        stub('a', async () => {
          throw new AdapterError('boom', 'unavailable', true);
        }),
      ],
      log,
    });

    for (const call of log.mock.calls) {
      expect(String(call[0])).not.toContain(secret);
    }
    expect(log).toHaveBeenCalled();
  });

  it('passes refinement feedback through to the adapter', async () => {
    const seen: unknown[] = [];
    await optimize(request({ feedback: 'make it shorter', previousPrompt: 'old rewrite' }), {
      adapters: [
        stub('a', async (_p, options) => {
          seen.push(options);
          return RESULT;
        }),
      ],
    });

    expect(seen[0]).toMatchObject({ feedback: 'make it shorter', previousPrompt: 'old rewrite' });
  });
});
