import { describe, expect, it } from 'vitest';
import { compressFiller, ruleBasedOptimize } from '../shared/ruleBased';
import { DEFAULT_OPTIONS, type OptimizeOptions } from '../shared/types';

const options = (o: Partial<OptimizeOptions> = {}): OptimizeOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe('compressFiller', () => {
  it('replaces wordy constructions with shorter equivalents', () => {
    expect(compressFiller('In order to win, act now.')).toBe('To win, act now.');
    expect(compressFiller('Due to the fact that it rained')).toBe('Because it rained');
  });

  it('strips filler intensifiers', () => {
    expect(compressFiller('This is very really good')).toBe('This is good');
  });

  it('collapses runs of whitespace and blank lines', () => {
    expect(compressFiller('a  b\n\n\n\nc')).toBe('A b\n\nc');
  });

  it('leaves already-tight text alone', () => {
    expect(compressFiller('Summarize the report.')).toBe('Summarize the report.');
  });

  // Regression: "make sure that you write" used to collapse to "ensure write",
  // stranding the verb. The politeness wrapper must be dropped whole.
  it('drops politeness wrappers without stranding the verb', () => {
    expect(compressFiller('Please make sure that you write a summary.')).toBe('Write a summary.');
    expect(compressFiller('I would like you to please make sure that you basically write a post.')).toBe(
      'Write a post.',
    );
    expect(compressFiller('Could you please summarize this?')).toBe('Summarize this?');
  });

  it('still swaps "make sure" when it is a plain verb', () => {
    expect(compressFiller('Make sure the output is valid JSON.')).toBe('Ensure the output is valid JSON.');
  });

  it('restores sentence case after a leading phrase is removed', () => {
    expect(compressFiller('Please write this. Due to the fact that it matters.')).toBe(
      'Write this. Because it matters.',
    );
  });

  it('does not capitalize after an abbreviation', () => {
    expect(compressFiller('Use a tool, e.g. ripgrep for this.')).toBe('Use a tool, e.g. ripgrep for this.');
  });

  it('leaves code-bearing prompts uncapitalized to avoid mangling identifiers', () => {
    const code = 'Refactor this:\n```js\nfoo. bar();\n```';
    expect(compressFiller(code)).toContain('foo. bar()');
  });

  it('always shortens or preserves — never grows the text', () => {
    const input = 'I would like you to please make sure that you basically summarize this.';
    expect(compressFiller(input).length).toBeLessThanOrEqual(input.length);
  });
});

describe('ruleBasedOptimize', () => {
  it('returns a usable rewrite and recommendations', () => {
    const result = ruleBasedOptimize('Write a blog post about cats.', options());
    expect(result.variations).toHaveLength(1);
    expect(result.variations[0].optimizedPrompt.trim().length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('recommends adding a role when none is present', () => {
    const result = ruleBasedOptimize('Summarize this article.', options());
    expect(result.recommendations.join(' ')).toMatch(/role/i);
  });

  it('does not recommend adding a role when one already exists', () => {
    const result = ruleBasedOptimize(
      'You are a senior editor. Summarize this article in JSON. Do not add commentary. For example: {"summary":"..."}. Think step by step.',
      options(),
    );
    expect(result.recommendations.join(' ')).not.toMatch(/Add a role/i);
  });

  it('picks JSON for API-shaped prompts', () => {
    const result = ruleBasedOptimize(
      'Build an endpoint. Return a payload. Validate the schema.',
      options({ length: 'expand' }),
    );
    expect(result.variations[0].optimizedFormat).toBe('JSON');
    expect(() => JSON.parse(result.variations[0].optimizedPrompt)).not.toThrow();
  });

  it('emits plain text when asked to shorten', () => {
    const result = ruleBasedOptimize(
      'In order to help. Please note that this matters. Do a thing.',
      options({ length: 'shorten' }),
    );
    expect(result.variations[0].optimizedFormat).toBe('Text');
    expect(result.variations[0].optimizedPrompt).not.toContain('In order to');
  });

  it('structures multi-instruction prompts as XML', () => {
    const result = ruleBasedOptimize(
      'Research the market.\nIdentify three competitors.\nSummarize their pricing.',
      options({ length: 'expand' }),
    );
    expect(result.variations[0].optimizedFormat).toBe('XML');
    expect(result.variations[0].optimizedPrompt).toContain('<instructions>');
  });

  it('handles a single-word prompt without throwing', () => {
    expect(() => ruleBasedOptimize('hello', options())).not.toThrow();
  });

  it('handles a very long prompt without throwing', () => {
    const long = 'Do the thing carefully. '.repeat(20_000);
    expect(() => ruleBasedOptimize(long, options())).not.toThrow();
  });

  it('preserves non-Latin text', () => {
    const result = ruleBasedOptimize('日本語で猫についての記事を書いてください。', options());
    expect(result.variations[0].optimizedPrompt).toContain('猫');
  });
});
