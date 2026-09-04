import React, { useState } from 'react';
import { Target, ShieldAlert, CheckCircle2, ArrowRight, ChevronDown, Info } from 'lucide-react';
import { FitResult } from '../../types/fit';
import { FitFactorRow } from './FitFactorRow';
import { SkillMatchChip } from './SkillMatchChip';

interface BestFitCardProps {
  result: FitResult;
}

const HARD_BLOCKER_CAP = 35;
const CONFIDENCE_TOOLTIP = 'Based on how much profile and posting data was available';

function bandClasses(percent: number): { text: string; ring: string; bg: string } {
  if (percent >= 75) return { text: 'text-emerald-400', ring: 'border-emerald-500/40', bg: 'bg-emerald-500/10' };
  if (percent >= 50) return { text: 'text-amber-400', ring: 'border-amber-500/40', bg: 'bg-amber-500/10' };
  return { text: 'text-rose-400', ring: 'border-rose-500/40', bg: 'bg-rose-500/10' };
}

function bandLabel(percent: number): string {
  if (percent >= 75) return 'Strong fit';
  if (percent >= 50) return 'Partial fit';
  return 'Weak fit';
}

function confidenceClasses(confidence: FitResult['confidence']): string {
  if (confidence === 'high') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (confidence === 'medium') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-surface-800 text-surface-300 border-surface-700';
}

function confidenceLabel(confidence: FitResult['confidence']): string {
  if (confidence === 'high') return 'High confidence';
  if (confidence === 'medium') return 'Medium confidence';
  return 'Low confidence';
}

/**
 * Best Fit % summary: headline score, confidence, hard blockers, strengths,
 * improvements, then a collapsible per-factor breakdown and skill chips.
 * Everything is derived from `FitResult`; no scoring happens here.
 */
export const BestFitCard: React.FC<BestFitCardProps> = ({ result }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!result) return null;

  const percent = Math.max(0, Math.min(100, Math.round(Number(result.fitPercent) || 0)));
  const band = bandClasses(percent);
  const hardBlockers = result.hardBlockers || [];
  const strengths = result.strengths || [];
  const improvements = result.improvements || [];
  const factors = result.factors || [];
  const matchedSkills = result.matchedSkills || [];
  const missingSkills = result.missingSkills || [];

  return (
    <div
      data-testid="best-fit-card"
      className="rounded-xl border border-surface-800 bg-surface-900/90 p-4 space-y-4 shadow-sm"
    >
      {/* Headline */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase font-mono tracking-wider text-surface-400 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-brand-400" />
            <span>Best Fit</span>
          </div>
          <div className={`text-2xl font-bold font-mono leading-tight mt-1 ${band.text}`}>
            Best Fit <span data-testid="best-fit-percent">{percent}%</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] font-medium ${band.text}`}>{bandLabel(percent)}</span>
            <span
              data-testid="best-fit-confidence"
              title={CONFIDENCE_TOOLTIP}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${confidenceClasses(result.confidence)}`}
            >
              <Info className="w-2.5 h-2.5" />
              {confidenceLabel(result.confidence)}
            </span>
          </div>
        </div>
        <div
          className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-mono font-bold shrink-0 ${band.ring} ${band.bg} ${band.text}`}
          aria-hidden="true"
        >
          <span className="text-lg leading-none">{percent}</span>
        </div>
      </div>

      {/* Hard blockers */}
      {hardBlockers.length > 0 && (
        <div className="space-y-1.5">
          {hardBlockers.map((blocker, idx) => (
            <div
              key={idx}
              data-testid="best-fit-blocker"
              className="flex items-start gap-2 p-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-[11px] text-rose-200 leading-snug"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-px" />
              <span>{blocker}</span>
            </div>
          ))}
          <p className="text-[10px] text-rose-300/80 leading-snug">
            Score capped at {HARD_BLOCKER_CAP}% because of a hard requirement
          </p>
        </div>
      )}

      {/* Strengths / improvements */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="grid grid-cols-1 gap-3 pt-3 border-t border-surface-800">
          {strengths.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-mono text-emerald-400 mb-1">Strengths</div>
              <ul className="space-y-1">
                {strengths.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[11px] text-surface-200 leading-snug">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-px" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-mono text-amber-400 mb-1">Ways to improve</div>
              <ul className="space-y-1">
                {improvements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[11px] text-surface-300 leading-snug">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Factor breakdown */}
      <div className="pt-2 border-t border-surface-800">
        <button
          type="button"
          data-testid="best-fit-breakdown-toggle"
          onClick={() => setShowBreakdown((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-surface-300 hover:text-white py-1"
          aria-expanded={showBreakdown}
        >
          <span className="font-medium">Factor breakdown</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
        </button>

        {showBreakdown && (
          <div className="pt-2 space-y-3">
            <div className="space-y-2.5">
              {factors.map((factor) => (
                <FitFactorRow key={factor.key} factor={factor} />
              ))}
            </div>

            {matchedSkills.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-mono text-emerald-400 mb-1">
                  Matched skills ({matchedSkills.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {matchedSkills.map((match, idx) => (
                    <SkillMatchChip key={`${match?.name || 'skill'}-${idx}`} match={match} />
                  ))}
                </div>
              </div>
            )}

            {missingSkills.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-mono text-rose-400 mb-1">
                  Missing skills ({missingSkills.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {missingSkills.map((name, idx) => (
                    <span
                      key={`${name}-${idx}`}
                      data-testid={`fit-missing-skill-${name}`}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-transparent text-rose-300 border border-rose-500/40"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
