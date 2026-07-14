import type { Intensity, ModelResult, OptimizeOptions, PromptFormat, Variation } from './types';

/**
 * Deterministic optimizer. This is the floor: it runs when every model backend
 * is unreachable, rate-limited, or returns junk, and it runs entirely in the
 * caller's process (browser or worker) so it can never itself fail over.
 *
 * It cannot rewrite meaning — only a model can. What it can do reliably is
 * remove filler, impose structure, and name what is missing. That is a smaller
 * promise than the model path, and the UI labels it as such.
 */

/**
 * Wordy constructions with a shorter form that means the same thing.
 *
 * Order matters: the politeness wrappers must be stripped before the phrases
 * nested inside them. "please make sure that you write X" has to reduce to
 * "write X" — rewriting the inner phrase first would strand the verb and yield
 * "ensure write X".
 */
const FILLER_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Politeness wrappers around an imperative — drop the wrapper, keep the verb.
  [/\bI would like you to\s+/gi, ''],
  [/\bI want you to\s+/gi, ''],
  [/\b(?:can|could|would) you (?:please\s+)?/gi, ''],
  [/\b(?:please\s+)?make sure (?:that\s+)?you\s+/gi, ''],
  [/\bplease\s+/gi, ''],

  // "make sure" with no following subject is a plain verb swap.
  [/\bmake sure that\b/gi, 'ensure'],
  [/\bmake sure\b/gi, 'ensure'],

  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bfor the purpose of\b/gi, 'to'],
  [/\bin the event that\b/gi, 'if'],
  [/\bit is important to note that\s+/gi, ''],
  [/\bit should be noted that\s+/gi, ''],
  [/\bnote that\s+/gi, ''],
  [/\bwith regard to\b/gi, 'regarding'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\ba large number of\b/gi, 'many'],
  [/\bthe majority of\b/gi, 'most'],
  [/\bis able to\b/gi, 'can'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bbasically\s+/gi, ''],
  [/\bactually\s+/gi, ''],
  [/\bvery\s+/gi, ''],
  [/\breally\s+/gi, ''],
  [/\bjust\s+/gi, ''],
];

/** Trailing abbreviations that end in a period but not a sentence. */
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf|approx|fig|no|dr|mr|mrs|ms|st)\.$/i;

/**
 * Dropping a leading "Please" or "Due to the fact that" leaves the next word
 * lowercased mid-sentence. Restore sentence case — but never inside a prompt
 * that carries code, where "obj. method()" must not become "obj. Method()".
 */
function recapitalize(text: string): string {
  if (/```|^\s*[{[<]/.test(text)) return text;

  return text
    .replace(/^(\s*)([a-z])/, (_match, space: string, char: string) => space + char.toUpperCase())
    .replace(
      /([.!?])(\s+)([a-z])/g,
      (match, punct: string, space: string, char: string, offset: number, full: string) => {
        if (ABBREVIATION.test(full.slice(0, offset + 1))) return match;
        return punct + space + char.toUpperCase();
      },
    );
}

const ROLE_HINT = /\b(you are|act as|as an? (expert|senior|professional)|your role is)\b/i;
const FORMAT_HINT = /\b(format|json|xml|markdown|table|bullet|respond with|output as|return a)\b/i;
const EXAMPLE_HINT = /\b(example|e\.g\.|for instance|such as|sample)\b/i;
const STEPS_HINT = /\b(step[- ]by[- ]step|think through|reason|explain your)\b/i;
const NEGATIVE_HINT = /\b(do not|don't|avoid|never|exclude)\b/i;

export function compressFiller(text: string): string {
  let out = text;
  for (const [pattern, replacement] of FILLER_PATTERNS) {
    out = out.replace(pattern, replacement);
  }

  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

  return recapitalize(out);
}

/** Split a prompt into its instruction lines, preserving existing list structure. */
function toBullets(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Already a list — keep the author's segmentation.
  if (lines.length > 1) {
    return lines.map((l) => l.replace(/^[-*•]\s*|^\d+[.)]\s*/, ''));
  }

  // One blob — split on sentence boundaries, but only if that yields real parts.
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  return sentences.length > 1 ? sentences : [text.trim()];
}

interface Gaps {
  role: boolean;
  format: boolean;
  example: boolean;
  steps: boolean;
  negative: boolean;
}

function findGaps(text: string): Gaps {
  return {
    role: !ROLE_HINT.test(text),
    format: !FORMAT_HINT.test(text),
    example: !EXAMPLE_HINT.test(text),
    steps: !STEPS_HINT.test(text),
    negative: !NEGATIVE_HINT.test(text),
  };
}

function chooseFormat(text: string, intensity: Intensity): PromptFormat {
  if (/\b(api|json|payload|schema|endpoint|serializ)/i.test(text)) return 'JSON';
  if (intensity === 'compress') return 'Text';
  const bullets = toBullets(text);
  return bullets.length >= 3 ? 'XML' : 'Text';
}

function buildXml(bullets: string[], gaps: Gaps, tone: string): string {
  const sections: string[] = [];

  if (gaps.role) {
    sections.push('<role>\n[Describe the expertise the model should assume, e.g. "Senior data engineer".]\n</role>');
  }

  sections.push(`<instructions>\n${bullets.map((b) => `- ${b}`).join('\n')}\n</instructions>`);

  if (tone !== 'neutral') {
    sections.push(`<tone>\n${tone}\n</tone>`);
  }

  if (gaps.format) {
    sections.push('<output_format>\n[Specify the exact shape of the expected answer.]\n</output_format>');
  }

  if (gaps.negative) {
    sections.push('<constraints>\n- [List what the model must NOT do.]\n</constraints>');
  }

  return sections.join('\n\n');
}

function buildJson(bullets: string[], gaps: Gaps, tone: string): string {
  return JSON.stringify(
    {
      role: gaps.role ? '[Expertise the model should assume]' : undefined,
      task: bullets[0],
      requirements: bullets.slice(1),
      tone: tone === 'neutral' ? undefined : tone,
      output_format: gaps.format ? '[Exact expected shape]' : undefined,
      constraints: gaps.negative ? ['[What the model must NOT do]'] : undefined,
    },
    null,
    2,
  );
}

function recommendationsFor(gaps: Gaps, compressed: boolean): string[] {
  const recs: string[] = [];
  if (gaps.role) {
    recs.push(
      'Add a role: open with "You are a [specific expert]" so the model anchors its vocabulary and depth to the right domain.',
    );
  }
  if (gaps.format) {
    recs.push(
      'Specify the output format explicitly. Naming the exact shape you want prevents the model from padding its answer with unwanted prose.',
    );
  }
  if (gaps.negative) {
    recs.push(
      'Add negative constraints. Stating what NOT to do rules out entire classes of wrong answers that positive instructions miss.',
    );
  }
  if (gaps.example) {
    recs.push(
      'Include one worked example. A single input/output pair conveys format expectations more reliably than describing them.',
    );
  }
  if (gaps.steps) {
    recs.push(
      'For multi-step reasoning, ask the model to work through it step by step before answering — it materially improves accuracy on complex tasks.',
    );
  }
  if (compressed) {
    recs.push(
      'Filler phrases like "in order to" and "it is important to note that" cost tokens without adding meaning. Prefer direct imperatives.',
    );
  }
  return recs.slice(0, 5);
}

export function ruleBasedOptimize(prompt: string, options: OptimizeOptions): ModelResult {
  const original = prompt.trim();
  const compressed = compressFiller(original);
  const gaps = findGaps(compressed);
  const bullets = toBullets(compressed);
  const format = chooseFormat(compressed, options.intensity);

  let optimizedPrompt: string;
  if (options.intensity === 'compress' || format === 'Text') {
    optimizedPrompt = compressed;
  } else if (format === 'JSON') {
    optimizedPrompt = buildJson(bullets, gaps, options.tone);
  } else {
    optimizedPrompt = buildXml(bullets, gaps, options.tone);
  }

  const variation: Variation = {
    optimizedPrompt,
    optimizedFormat: format,
    rationale:
      'Produced by the offline optimizer: filler removed and structure applied. Placeholders in [brackets] need your input.',
  };

  return {
    // Classifying intent needs a model; regexes cannot do it honestly.
    taskType: 'other',
    variations: [variation],
    // The offline path invents nothing, so it has nothing to disclose. Engineer
    // mode is precisely what it cannot deliver — the UI's degraded banner says so.
    assumptions: [],
    openQuestions:
      options.intensity === 'engineer'
        ? ['Engineering a prompt needs a model. Retry when the backend is reachable for a full specification.']
        : [],
    recommendations: recommendationsFor(gaps, compressed.length < original.length),
  };
}
