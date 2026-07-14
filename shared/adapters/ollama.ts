import { systemPrompt, userPrompt } from '../prompt';
import { AdapterError, type ModelAdapter, type ModelResult, type OptimizeOptions } from '../types';
import { extractJson, validateModelResult } from '../validate';
import { postJson } from './http';

/**
 * Local development backend. Requires Ollama running on the same machine, so it
 * is never a candidate for the hosted deployment — a visitor's browser cannot
 * reach the server's localhost, and the server is a static CDN either way.
 */
export class OllamaAdapter implements ModelAdapter {
  readonly name: string;

  constructor(
    private readonly baseUrl = 'http://localhost:11434',
    private readonly model = 'llama3.1:8b',
  ) {
    this.name = `ollama:${model}`;
  }

  async optimize(prompt: string, options: OptimizeOptions, signal: AbortSignal): Promise<ModelResult> {
    const payload = await postJson(
      `${this.baseUrl.replace(/\/$/, '')}/api/chat`,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: userPrompt(prompt, options) },
        ],
        format: 'json',
        stream: false,
        options: { temperature: options.variations > 1 ? 0.7 : 0.3 },
      },
      {},
      signal,
    );

    const content = (payload as any)?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AdapterError('Ollama returned an empty completion', 'bad_response', true);
    }

    return validateModelResult(extractJson(content), options.variations);
  }
}
