import React, { useState } from 'react';
import { CaretDown, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { FitFactor } from '../../types/fit';

interface FitFactorRowProps {
  factor: FitFactor;
}

function barColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * One row of the Best Fit factor breakdown: label, weight chip, progress bar,
 * and an expandable list of the evidence / gaps behind the score.
 */
export const FitFactorRow: React.FC<FitFactorRowProps> = ({ factor }) => {
  const [expanded, setExpanded] = useState(false);
  const evidence = factor?.evidence || [];
  const gaps = factor?.gaps || [];
  const applicable = factor?.applicable !== false && (factor?.weight || 0) > 0;
  const score = Math.max(0, Math.min(100, Number(factor?.score) || 0));
  const hasDetails = evidence.length > 0 || gaps.length > 0;

  return (
    <div data-testid={`fit-factor-${factor?.key}`} className={`space-y-1 ${applicable ? '' : 'opacity-60'}`}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] gap-2"
        aria-expanded={expanded}
      >
        <span className="text-surface-300 font-medium flex items-center gap-1.5 min-w-0">
          <span className="truncate">{factor?.label}</span>
          {applicable ? (
            <span className="text-[9px] font-mono px-1 rounded bg-surface-800 text-surface-400 border border-surface-700 shrink-0">
              {factor.weight}%
            </span>
          ) : (
            <span className="text-[9px] font-mono px-1 rounded bg-surface-900 text-surface-500 border border-surface-800 shrink-0">
              n/a
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-surface-200">{applicable ? `${score}%` : '—'}</span>
          {hasDetails && (
            <CaretDown className={`w-3 h-3 text-surface-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          )}
        </span>
      </button>

      <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${applicable ? barColor(score) : 'bg-surface-700'}`} style={{ width: `${applicable ? score : 0}%` }} />
      </div>

      {!applicable && (
        <p className="text-[10px] text-surface-500 leading-snug">The posting gives no signal for this factor; its weight was redistributed.</p>
      )}

      {expanded && hasDetails && (
        <ul data-testid={`fit-factor-${factor?.key}-details`} className="pt-1 space-y-0.5">
          {evidence.map((item, idx) => (
            <li key={`e${idx}`} className="flex items-start gap-1.5 text-[10px] text-surface-300 leading-snug">
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-px" />
              <span>{item}</span>
            </li>
          ))}
          {gaps.map((item, idx) => (
            <li key={`g${idx}`} className="flex items-start gap-1.5 text-[10px] text-surface-400 leading-snug">
              <WarningCircle className="w-3 h-3 text-amber-400 shrink-0 mt-px" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
