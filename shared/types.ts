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

export const LENGTH_MODES = ['shorten', 'preserve', 'expand'] as const;
export type LengthMode = (typeof LENGTH_MODES)[number];

export const FORMATS = ['Text', 'XML', 'JSON', 'Markdown'] as const;
export type PromptFormat = (typeof FORMATS)[number];

/** Everything the user can tune from the UI. */
export interface OptimizeOptions {
  tone: Tone;
  length: LengthMode;
  /** How many alternative rewrites to return (1-3). */
  variations: number;
  /** Free-text steer for a follow-up refinement pass. */
  feedback?: string;
  /** The rewrite the feedback refers to, for multi-turn refinement. */
  previousPrompt?: string;
}

export const DEFAULT_OPTIONS: OptimizeOptions = {
  tone: 'neutral',
  length: 'preserve',
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
  variations: Variation[];
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
