import React from 'react';
import { Lock, Circle, ArrowRight } from 'lucide-react';
import { ProfileCompleteness } from '../../types/profile';

interface ProfileGateCardProps {
  completeness: ProfileCompleteness;
  onGoToProfile: () => void;
}

/**
 * Onboarding gate shown in place of the Job / Tailor / Prep tabs until the
 * Candidate Profile passes `checkProfileCompleteness`.
 */
export const ProfileGateCard: React.FC<ProfileGateCardProps> = ({ completeness, onGoToProfile }) => {
  const score = Math.max(0, Math.min(100, Math.round(Number(completeness?.score) || 0)));
  const missing = completeness?.missing || [];

  return (
    <div
      data-testid="profile-gate-card"
      className="p-5 rounded-xl border border-dashed border-surface-700 bg-surface-900/40 flex flex-col items-center text-center space-y-3"
    >
      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
        <Lock className="w-5 h-5 text-amber-400" />
      </div>
      <h3 className="text-sm font-semibold text-white">Set up your Candidate Profile first</h3>
      <p className="text-[11px] text-surface-400 max-w-xs leading-snug">
        Best Fit %, tailoring and interview prep all read from your profile. It takes a couple of minutes and stays on
        this device.
      </p>

      <div className="w-full max-w-xs space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-400">
          <span>Profile completeness</span>
          <span data-testid="profile-gate-score" className="text-surface-200">
            {score}%
          </span>
        </div>
        <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${score}%` }} />
        </div>
      </div>

      {missing.length > 0 && (
        <ul className="w-full max-w-xs text-left space-y-1">
          {missing.map((item, idx) => (
            <li
              key={idx}
              data-testid="profile-gate-missing"
              className="flex items-start gap-1.5 text-[11px] text-surface-300 leading-snug"
            >
              <Circle className="w-3 h-3 text-amber-400 shrink-0 mt-px" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        data-testid="profile-gate-cta"
        onClick={onGoToProfile}
        className="w-full max-w-xs py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.99]"
      >
        <span>Complete profile</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
