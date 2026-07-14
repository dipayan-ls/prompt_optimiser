import { LENGTH_MODES, TONES, type LengthMode, type OptimizeOptions, type Tone } from '../../shared/types';
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

const LENGTH_LABELS: Record<LengthMode, string> = {
  shorten: 'Shorten',
  preserve: 'Preserve',
  expand: 'Expand',
};

interface Props {
  options: OptimizeOptions;
  disabled: boolean;
  onChange: (options: OptimizeOptions) => void;
}

export function OptimizerControls({ options, disabled, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Length</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
          {LENGTH_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...options, length: mode })}
              className={cn(
                'flex-1 px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                options.length === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {LENGTH_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Variations</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
          {[1, 2, 3].map((count) => (
            <button
              key={count}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...options, variations: count })}
              className={cn(
                'flex-1 px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                options.variations === count
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
