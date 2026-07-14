/**
 * Token counting.
 *
 * The previous version asked the model to *estimate* token counts. Language
 * models cannot count their own tokens — those numbers were guesses presented
 * as measurements. This counts for real instead.
 *
 * Only OpenAI publishes its tokenizer, so o200k_base is exact and the other two
 * families are scaled from it using published ratios. The UI labels which is
 * which; never present the scaled numbers as measured.
 */

export interface TokenCount {
  family: string;
  tokens: number;
  exact: boolean;
  note: string;
}

type Encoder = (text: string) => number[];

let encoderPromise: Promise<Encoder | null> | null = null;

/**
 * The o200k encoder table is ~1.5MB, so it is fetched lazily on first analysis
 * rather than shipped in the initial bundle.
 */
async function loadEncoder(): Promise<Encoder | null> {
  if (!encoderPromise) {
    encoderPromise = import('gpt-tokenizer/encoding/o200k_base')
      .then((module) => module.encode as Encoder)
      .catch(() => null);
  }
  return encoderPromise;
}

/** Fallback when the encoder cannot load. Deliberately coarse, and labelled as such. */
function approximateTokens(text: string): number {
  if (!text) return 0;
  // ~4 chars/token for Latin scripts; CJK runs closer to ~1.5.
  const cjk = (text.match(/[　-鿿가-힯]/g) ?? []).length;
  const rest = text.length - cjk;
  return Math.ceil(rest / 4 + cjk / 1.5);
}

/** Ratios relative to o200k_base for the same English text. */
const FAMILY_RATIOS: ReadonlyArray<{ family: string; ratio: number; note: string }> = [
  { family: 'ChatGPT', ratio: 1, note: 'Exact — counted with the o200k_base tokenizer.' },
  {
    family: 'Claude',
    ratio: 1.16,
    note: "Approximate — Anthropic's tokenizer is not public; scaled from o200k_base.",
  },
  {
    family: 'Gemini',
    ratio: 1.05,
    note: "Approximate — Google's tokenizer is not public; scaled from o200k_base.",
  },
];

export async function countTokens(text: string): Promise<TokenCount[]> {
  const encoder = await loadEncoder();
  const base = encoder ? encoder(text).length : approximateTokens(text);

  return FAMILY_RATIOS.map(({ family, ratio, note }) => ({
    family,
    tokens: ratio === 1 ? base : Math.round(base * ratio),
    exact: encoder !== null && ratio === 1,
    note: encoder ? note : 'Rough estimate — the tokenizer failed to load.',
  }));
}

/** Percentage reduction from `before` to `after`. Negative means the prompt grew. */
export function savingsPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 100);
}
