import { AdapterError } from '../types';

/**
 * Map transport-level outcomes onto AdapterError kinds so the pipeline can
 * decide whether trying the next backend is worthwhile.
 */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw new AdapterError('Model request timed out', 'timeout', true);
    }
    throw new AdapterError(
      `Could not reach the model backend: ${(error as Error).message}`,
      'unavailable',
      true,
    );
  }

  if (response.status === 401 || response.status === 403) {
    // A bad key is a deploy problem. Failing over would mask it.
    throw new AdapterError('Model backend rejected our credentials', 'unauthorized', false);
  }
  if (response.status === 429) {
    throw new AdapterError('Model backend rate limit reached', 'rate_limit', true);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AdapterError(
      `Model backend returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      'unavailable',
      true,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new AdapterError('Model backend returned malformed JSON', 'bad_response', true);
  }
}
