import { systemPrompt, userPrompt } from '../prompt';
import { AdapterError, type ModelAdapter, type ModelResult, type OptimizeOptions } from '../types';
import { extractJson, validateModelResult } from '../validate';
import { postJson } from './http';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/** Groq's free tier is the hosted default: OpenAI-compatible, and fast enough for the <5s budget. */
export class GroqAdapter implements ModelAdapter {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'llama-3.3-70b-versatile',
  ) {
    if (!apiKey) throw new Error('GroqAdapter requires an API key');
    this.name = `groq:${model}`;
  }

  async optimize(prompt: string, options: OptimizeOptions, signal: AbortSignal): Promise<ModelResult> {
    const payload = await postJson(
      ENDPOINT,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: userPrompt(prompt, options) },
        ],
        temperature: options.variations > 1 ? 0.7 : 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      },
      { Authorization: `Bearer ${this.apiKey}` },
      signal,
    );

    const content = (payload as any)?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AdapterError('Groq returned an empty completion', 'bad_response', true);
    }

    return validateModelResult(extractJson(content), options.variations);
  }
}
