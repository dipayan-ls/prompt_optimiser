import { INTENSITIES, TONES, type Intensity, type OptimizeOptions, type Tone } from '../../shared/types';
import { cn } from '../lib/utils';

const TONE_LABELS: Record<Tone, string> = {
  neutral: 'Neutral',
  professional: 'Professional',
  creative: 'Creative',
  concise: 'Concise',
  technical: 'Technical',
  friendly: 'Friendly',
  academic: 'Academic',
};

const INTENSITY_LABELS: Record<Intensity, { label: string; hint: string }> = {
  compress: {
    label: 'Compress',
    hint: 'Same prompt, fewer tokens. For prompts that already work.',
  },
  balanced: {
    label: 'Balanced',
    hint: 'Same length, sharper. Fixes ambiguity and structure.',
  },
  engineer: {
    label: 'Engineer',
    hint: 'Builds a full specification: role, assumptions, tasks, deliverables, verification. Expect it to get much longer.',
  },
};

interface Props {
  options: OptimizeOptions;
  disabled: boolean;
  onChange: (options: OptimizeOptions) => void;
}

export function OptimizerControls({ options, disabled, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Intensity</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
          {INTENSITIES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              title={INTENSITY_LABELS[mode].hint}
              onClick={() => onChange({ ...options, intensity: mode })}
              className={cn(
                'flex-1 px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                options.intensity === mode ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {INTENSITY_LABELS[mode].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{INTENSITY_LABELS[options.intensity].hint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tone</span>
          <select
            value={options.tone}
            disabled={disabled}
            onChange={(e) => onChange({ ...options, tone: e.target.value as Tone })}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            {TONES.map((tone) => (
              <option key={tone} value={tone}>
                {TONE_LABELS[tone]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Variations</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                disabled={disabled}
                title={count > 1 ? 'Each variation uses a different strategy, not just different wording.' : undefined}
                onClick={() => onChange({ ...options, variations: count })}
                className={cn(
                  'flex-1 px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                  options.variations === count ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
