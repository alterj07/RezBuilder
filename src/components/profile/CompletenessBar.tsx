import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { ProfileCompleteness } from '../../types/profile';

interface CompletenessBarProps {
  completeness: ProfileCompleteness;
  /** Render the missing / suggestion lists under the bar. */
  showDetails?: boolean;
}

export const CompletenessBar: React.FC<CompletenessBarProps> = ({ completeness, showDetails = false }) => {
  const { score, isComplete, missing, suggestions } = completeness;
  const barColor = isComplete ? 'bg-brand-500' : score >= 50 ? 'bg-amber-400' : 'bg-rose-400';

  return (
    <div className="space-y-2" data-testid="completeness-bar">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-surface-400 font-mono uppercase tracking-wider">Profile completeness</span>
        <span
          data-testid="completeness-score"
          className={`font-mono font-semibold ${isComplete ? 'text-brand-300' : 'text-surface-200'}`}
        >
          {score}%
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-surface-800 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      {showDetails && (
        <div className="space-y-1.5">
          {missing.length > 0 && (
            <ul className="space-y-0.5" data-testid="completeness-missing">
              {missing.map((m) => (
                <li key={m} className="text-[11px] text-rose-300 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
          {isComplete && (
            <p className="text-[11px] text-brand-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>All required sections are filled in.</span>
            </p>
          )}
          {suggestions.length > 0 && (
            <ul className="space-y-0.5" data-testid="completeness-suggestions">
              {suggestions.map((s) => (
                <li key={s} className="text-[11px] text-surface-500 flex items-start gap-1">
                  <span className="text-surface-600">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
