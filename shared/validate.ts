import { AdapterError, FORMATS, type ModelResult, type PromptFormat, type Variation } from './types';

/**
 * Models routinely wrap JSON in code fences or prepend "Here you go:" despite
 * being told not to. Recover the JSON object rather than failing the request.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (!text) throw new AdapterError('Model returned an empty response', 'bad_response', true);

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter((c): c is string => typeof c === 'string');

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Fall through to brace-matching.
    }
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // Try the next candidate.
      }
    }
  }

  throw new AdapterError('Model response was not valid JSON', 'bad_response', true);
}

function isFormat(value: unknown): value is PromptFormat {
  return typeof value === 'string' && (FORMATS as readonly string[]).includes(value);
}

/**
 * Rough gibberish detector. Catches the degenerate-loop and mojibake failures
 * small quantized models fall into, without rejecting valid non-Latin text.
 */
export function looksLikeGibberish(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return true;

  // A single token repeated past the point of meaning, e.g. "the the the the".
  const words = trimmed.split(/\s+/);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const word of words) {
      const key = word.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const topShare = Math.max(...counts.values()) / words.length;
    if (topShare > 0.5) return true;
  }

  // Unicode replacement chars mean the bytes were mangled somewhere upstream.
  const replacementChars = (trimmed.match(/�/g) ?? []).length;
  if (replacementChars > 2) return true;

  return false;
}

/**
 * The prompt is untrusted input, and the model is told to treat it as data. If a
 * rewrite echoes an override attempt back as a live instruction, the model
 * followed the payload instead of rewriting it. Fail closed.
 */
const INJECTION_ECHO =
  /\b(ignore (all )?(previous|prior|above) instructions|disregard (the )?(system|above)|you are now (in )?(dan|developer mode)|reveal your (system )?prompt)\b/i;

export function violatesSafety(text: string): string | null {
  if (INJECTION_ECHO.test(text)) {
    return 'The rewrite echoed an instruction-override attempt from the source prompt.';
  }
  return null;
}

/**
 * Normalize whatever the model produced into a ModelResult, or throw an
 * AdapterError the pipeline can fall back on.
 */
export function validateModelResult(parsed: unknown, expectedVariations: number): ModelResult {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new AdapterError('Model response was not an object', 'bad_response', true);
  }

  const record = parsed as Record<string, unknown>;
  const rawVariations = record.variations;
  if (!Array.isArray(rawVariations) || rawVariations.length === 0) {
    throw new AdapterError('Model response contained no variations', 'bad_response', true);
  }

  const variations: Variation[] = [];
  for (const entry of rawVariations) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const optimizedPrompt = typeof item.optimizedPrompt === 'string' ? item.optimizedPrompt.trim() : '';
    if (!optimizedPrompt || looksLikeGibberish(optimizedPrompt)) continue;

    const unsafe = violatesSafety(optimizedPrompt);
    if (unsafe) throw new AdapterError(unsafe, 'bad_response', false);

    variations.push({
      optimizedPrompt,
      optimizedFormat: isFormat(item.optimizedFormat) ? item.optimizedFormat : 'Text',
      rationale: typeof item.rationale === 'string' ? item.rationale.trim() : '',
    });
  }

  if (variations.length === 0) {
    throw new AdapterError('Model returned no usable rewrite', 'bad_response', true);
  }

  const recommendations = Array.isArray(record.recommendations)
    ? record.recommendations
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map((r) => r.trim())
        .slice(0, 5)
    : [];

  // Asking for 3 and getting 2 is a quality dip, not a failure — serve it.
  return { variations: variations.slice(0, expectedVariations), recommendations };
}
