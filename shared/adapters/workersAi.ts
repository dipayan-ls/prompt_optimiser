import { maxOutputTokens, systemPrompt, userPrompt } from '../prompt';
import { AdapterError, type ModelAdapter, type ModelResult, type OptimizeOptions } from '../types';
import { extractJson, validateModelResult } from '../validate';

/** The subset of Cloudflare's Ai binding we depend on. */
export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/**
 * Cloudflare Workers AI. Notable because it needs no third-party key at all —
 * inference is billed to the Worker's own account against a free daily
 * allocation. That makes it the natural secondary when Groq is rate-limited.
 */
export class WorkersAiAdapter implements ModelAdapter {
  readonly name: string;

  constructor(
    private readonly ai: AiBinding,
    private readonly model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  ) {
    this.name = `workers-ai:${model}`;
  }

  async optimize(prompt: string, options: OptimizeOptions, signal: AbortSignal): Promise<ModelResult> {
    // The Ai binding takes no AbortSignal, so honour cancellation by racing it.
    const inference = this.ai.run(this.model, {
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: userPrompt(prompt, options) },
      ],
      temperature: options.variations > 1 ? 0.7 : 0.3,
      max_tokens: maxOutputTokens(options),
    });

    const aborted = new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new AdapterError('Model request timed out', 'timeout', true));
      signal.addEventListener(
        'abort',
        () => reject(new AdapterError('Model request timed out', 'timeout', true)),
        { once: true },
      );
    });

    let payload: unknown;
    try {
      payload = await Promise.race([inference, aborted]);
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(
        `Workers AI call failed: ${(error as Error).message}`,
        'unavailable',
        true,
      );
    }

    const content = (payload as any)?.response;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AdapterError('Workers AI returned an empty completion', 'bad_response', true);
    }

    return validateModelResult(extractJson(content), options.variations);
  }
}
