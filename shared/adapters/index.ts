import type { ModelAdapter } from '../types';
import { GroqAdapter } from './groq';
import { OllamaAdapter } from './ollama';
import { WorkersAiAdapter, type AiBinding } from './workersAi';

export { GroqAdapter, OllamaAdapter, WorkersAiAdapter };
export type { AiBinding };

export interface AdapterEnv {
  /** auto | groq | workers-ai | ollama | rule-based. Defaults to auto. */
  MODEL_BACKEND?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  /** Cloudflare Workers AI binding, present only when configured in wrangler.toml. */
  AI?: AiBinding;
}

/**
 * Build the adapter chain for this environment, most-preferred first.
 *
 * `auto` (the default when MODEL_BACKEND is unset) prefers Groq for quality and
 * speed, then Workers AI, which needs no third-party key. An empty chain is
 * valid and means every request is served by the deterministic optimizer.
 */
export function createAdapters(env: AdapterEnv): ModelAdapter[] {
  const backend = (env.MODEL_BACKEND ?? 'auto').trim().toLowerCase();

  const groq = () => (env.GROQ_API_KEY ? new GroqAdapter(env.GROQ_API_KEY, env.GROQ_MODEL) : null);
  const workersAi = () => (env.AI ? new WorkersAiAdapter(env.AI) : null);
  const ollama = () => new OllamaAdapter(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);

  switch (backend) {
    case 'rule-based':
      return [];
    case 'groq':
      return compact([groq()]);
    case 'workers-ai':
      return compact([workersAi()]);
    case 'ollama':
      return [ollama()];
    case 'auto':
    default:
      return compact([groq(), workersAi()]);
  }
}

function compact(adapters: Array<ModelAdapter | null>): ModelAdapter[] {
  return adapters.filter((a): a is ModelAdapter => a !== null);
}
