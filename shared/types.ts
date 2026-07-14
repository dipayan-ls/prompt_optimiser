/**
 * Core contracts shared by the browser client and the edge worker.
 * Nothing in this file may import browser- or worker-specific globals.
 */

export const TONES = [
  'neutral',
  'professional',
  'creative',
  'concise',
  'technical',
  'friendly',
  'academic',
] as const;

export type Tone = (typeof TONES)[number];

/**
 * How hard to work on the prompt. This is the product's main axis.
 *
 * `compress` and `engineer` pull in opposite directions on purpose:
 * compression minimizes tokens for a prompt that already works, while
 * engineering spends tokens to buy precision on a prompt that doesn't. Treating
 * "fewer tokens" as the universal goal was the original design mistake — a
 * vague prompt's problem is that it is vague, not that it is long.
 */
export const INTENSITIES = ['compress', 'balanced', 'engineer'] as const;
export type Intensity = (typeof INTENSITIES)[number];

/**
 * The scaffold families the model picks between. Selection is the model's job,
 * not a regex's — it reads intent far better than keyword matching can.
 */
export const TASK_TYPES = [
  'engineering',
  'research',
  'writing',
  'analysis',
  'data',
  'conversational',
  'other',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const FORMATS = ['Text', 'XML', 'JSON', 'Markdown'] as const;
export type PromptFormat = (typeof FORMATS)[number];

/** Everything the user can tune from the UI. */
export interface OptimizeOptions {
  tone: Tone;
  intensity: Intensity;
  /** How many alternative rewrites to return (1-3). */
  variations: number;
  /** Free-text steer for a follow-up refinement pass. */
  feedback?: string;
  /** The rewrite the feedback refers to, for multi-turn refinement. */
  previousPrompt?: string;
}

// `engineer` is the default because it is what people actually come here for:
// paste something rough, get something you would be happy to send.
export const DEFAULT_OPTIONS: OptimizeOptions = {
  tone: 'neutral',
  intensity: 'engineer',
  variations: 1,
};

export interface OptimizeRequest extends OptimizeOptions {
  prompt: string;
}

/** A single rewrite produced by the model. */
export interface Variation {
  optimizedPrompt: string;
  optimizedFormat: PromptFormat;
  /** Why this variation differs from the others. Empty when only one was asked for. */
  rationale: string;
}

/** The shape an adapter must return. Token math is added downstream, not by the model. */
export interface ModelResult {
  /** Which scaffold family the model judged this prompt to be. */
  taskType: TaskType;
  variations: Variation[];
  /**
   * Domain details the rewrite invented to make the prompt specific.
   *
   * Engineering a vague prompt REQUIRES inventing specifics — that is the whole
   * value — but an invented specific the user never sees is indistinguishable
   * from a hallucination. Surfacing these is what makes the invention safe:
   * the user can correct any one of them before sending.
   */
  assumptions: string[];
  /** Genuine ambiguities no reasonable assumption can settle. */
  openQuestions: string[];
  recommendations: string[];
}

export interface OptimizeResponse extends ModelResult {
  /** Which adapter served this, e.g. "groq:llama-3.3-70b-versatile" or "rule-based". */
  engine: string;
  /**
   * True when the model path failed and the deterministic optimizer answered
   * instead. The UI surfaces this so results are never silently weaker.
   */
  degraded: boolean;
  /** Present only when degraded, explaining what fell back and why. */
  degradedReason?: string;
}

/**
 * A model backend. Implementations must be pure request/response — no retries,
 * no fallback logic, no logging of prompt content. The pipeline owns all three.
 */
export interface ModelAdapter {
  /** Stable id used in the `engine` field and in logs. */
  readonly name: string;
  optimize(prompt: string, options: OptimizeOptions, signal: AbortSignal): Promise<ModelResult>;
}

/** Thrown by adapters so the pipeline can distinguish "retry elsewhere" from "give up". */
export class AdapterError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'rate_limit' | 'unavailable' | 'bad_response' | 'unauthorized',
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}
