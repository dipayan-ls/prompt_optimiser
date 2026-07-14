import { ruleBasedOptimize } from '../../shared/ruleBased';
import type { OptimizeOptions, OptimizeResponse } from '../../shared/types';

/**
 * Where the optimize endpoint lives. Set VITE_API_BASE at build time:
 *   - same-origin route (Cloudflare rule):  /api
 *   - standalone Worker:                    https://<name>.<sub>.workers.dev
 * Empty means "no backend configured" — the app then runs fully offline in the
 * browser rather than showing an error.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export const hasBackend = API_BASE.length > 0;

const CLIENT_TIMEOUT_MS = 30_000;

/**
 * Optimize a prompt. Never throws for backend problems — if the network or the
 * Worker is unavailable, the same deterministic optimizer the Worker would have
 * used runs here in the browser, and the result is flagged as degraded.
 *
 * It throws only for input the user must fix (empty prompt), which the UI
 * surfaces directly.
 */
export async function optimizePrompt(
  prompt: string,
  options: OptimizeOptions,
): Promise<OptimizeResponse> {
  if (!prompt.trim()) {
    throw new Error('Enter a prompt before optimizing.');
  }

  if (!hasBackend) {
    return offline(prompt, options, 'No model backend is configured for this build.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...options }),
      signal: controller.signal,
    });

    if (response.status === 400 || response.status === 413 || response.status === 429) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new UserFacingError(body.error ?? 'That request could not be processed.');
    }

    if (!response.ok) {
      return offline(prompt, options, 'The optimizer service is unavailable right now.');
    }

    return (await response.json()) as OptimizeResponse;
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    const reason =
      (error as Error).name === 'AbortError'
        ? 'The optimizer service took too long to respond.'
        : 'Could not reach the optimizer service.';
    return offline(prompt, options, reason);
  } finally {
    clearTimeout(timer);
  }
}

/** An error the user can act on, as opposed to one we should absorb and degrade past. */
export class UserFacingError extends Error {}

function offline(prompt: string, options: OptimizeOptions, reason: string): OptimizeResponse {
  return {
    ...ruleBasedOptimize(prompt, options),
    engine: 'rule-based (browser)',
    degraded: true,
    degradedReason: `${reason} Your prompt was structured offline in your browser instead.`,
  };
}
