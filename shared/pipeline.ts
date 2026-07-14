import { ruleBasedOptimize } from './ruleBased';
import {
  AdapterError,
  DEFAULT_OPTIONS,
  LENGTH_MODES,
  TONES,
  type LengthMode,
  type ModelAdapter,
  type OptimizeOptions,
  type OptimizeRequest,
  type OptimizeResponse,
  type Tone,
} from './types';

/**
 * Above this the model path stops being useful: quality degrades, the response
 * risks exceeding the output cap, and latency blows the 5s budget. The
 * deterministic optimizer has no context limit, so long prompts route there
 * rather than being silently truncated.
 */
export const MODEL_PROMPT_CHAR_LIMIT = 48_000;

/** Refuse outright past this. Purely a resource guard on a public endpoint. */
export const HARD_PROMPT_CHAR_LIMIT = 400_000;

export const DEFAULT_TIMEOUT_MS = 20_000;

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

/** Coerce untrusted request JSON into a valid OptimizeRequest, or throw a 400. */
export function parseRequest(body: unknown): OptimizeRequest {
  if (typeof body !== 'object' || body === null) {
    throw new RequestError('Request body must be a JSON object.', 400);
  }
  const record = body as Record<string, unknown>;

  const prompt = typeof record.prompt === 'string' ? record.prompt : '';
  if (!prompt.trim()) {
    throw new RequestError('Enter a prompt before optimizing.', 400);
  }
  if (prompt.length > HARD_PROMPT_CHAR_LIMIT) {
    throw new RequestError(
      `That prompt is ${prompt.length.toLocaleString()} characters, over the ${HARD_PROMPT_CHAR_LIMIT.toLocaleString()} limit. Split it into sections and optimize them separately.`,
      413,
    );
  }

  const tone = (TONES as readonly string[]).includes(record.tone as string)
    ? (record.tone as Tone)
    : DEFAULT_OPTIONS.tone;

  const length = (LENGTH_MODES as readonly string[]).includes(record.length as string)
    ? (record.length as LengthMode)
    : DEFAULT_OPTIONS.length;

  const rawVariations = Number(record.variations);
  const variations = Number.isFinite(rawVariations)
    ? Math.min(3, Math.max(1, Math.trunc(rawVariations)))
    : DEFAULT_OPTIONS.variations;

  const feedback = typeof record.feedback === 'string' ? record.feedback.slice(0, 2_000) : undefined;
  const previousPrompt =
    typeof record.previousPrompt === 'string' ? record.previousPrompt.slice(0, 48_000) : undefined;

  return { prompt, tone, length, variations, feedback, previousPrompt };
}

function degradedResult(prompt: string, options: OptimizeOptions, reason: string): OptimizeResponse {
  return {
    ...ruleBasedOptimize(prompt, options),
    engine: 'rule-based',
    degraded: true,
    degradedReason: reason,
  };
}

export interface PipelineDeps {
  adapters: ModelAdapter[];
  timeoutMs?: number;
  /** Injected for tests; must never receive prompt content. */
  log?: (message: string) => void;
}

/**
 * Try each adapter in order, then fall back to the deterministic optimizer.
 * Always resolves — an optimizer that 500s is worse than one that degrades.
 */
export async function optimize(
  request: OptimizeRequest,
  { adapters, timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {} }: PipelineDeps,
): Promise<OptimizeResponse> {
  const { prompt, ...options } = request;

  if (prompt.length > MODEL_PROMPT_CHAR_LIMIT) {
    log(`prompt ${prompt.length} chars exceeds model limit; using rule-based`);
    return degradedResult(
      prompt,
      options,
      `This prompt is longer than the model backend can rewrite well (${prompt.length.toLocaleString()} of ${MODEL_PROMPT_CHAR_LIMIT.toLocaleString()} characters), so it was structured offline instead. Optimizing it in sections will give a better result.`,
    );
  }

  if (adapters.length === 0) {
    return degradedResult(prompt, options, 'No model backend is configured on this deployment.');
  }

  let lastError: AdapterError | undefined;

  for (const adapter of adapters) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await adapter.optimize(prompt, options, controller.signal);
      return { ...result, engine: adapter.name, degraded: false };
    } catch (error) {
      const adapterError =
        error instanceof AdapterError
          ? error
          : new AdapterError((error as Error).message, 'unavailable', true);

      // Log the failure, never the prompt.
      log(`adapter ${adapter.name} failed: ${adapterError.kind} — ${adapterError.message}`);
      lastError = adapterError;

      if (!adapterError.retryable) break;
    } finally {
      clearTimeout(timer);
    }
  }

  return degradedResult(prompt, options, explain(lastError));
}

function explain(error: AdapterError | undefined): string {
  switch (error?.kind) {
    case 'rate_limit':
      return 'The free model tier is rate-limited right now, so this was optimized offline. Try again in a minute for a full rewrite.';
    case 'timeout':
      return 'The model took too long to respond, so this was optimized offline. Try again for a full rewrite.';
    case 'unauthorized':
      return 'The model backend is misconfigured on this deployment, so this was optimized offline.';
    case 'bad_response':
      return 'The model returned an unusable response, so this was optimized offline. Try again for a full rewrite.';
    default:
      return 'The model backend is unreachable, so this was optimized offline. Try again shortly for a full rewrite.';
  }
}
