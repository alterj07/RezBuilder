import React from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';

interface GapAlertCardProps {
  unresolvedGaps: string[];
}

export const GapAlertCard: React.FC<GapAlertCardProps> = ({ unresolvedGaps }) => {
  if (!unresolvedGaps || unresolvedGaps.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2.5">
      <div className="flex items-center gap-2 text-amber-400">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <h4 className="text-xs font-semibold tracking-tight">
          Unresolved JD Requirements & Gaps ({unresolvedGaps.length})
        </h4>
      </div>
      <p className="text-[11px] text-amber-200/80 leading-relaxed">
        To maintain 100% truthfulness, RezBuilder does not fabricate skills. The following requirements from the JD
        were not found in your base resume. Consider addressing them in your cover letter or interview:
      </p>
      <ul className="space-y-1.5 pt-1">
        {unresolvedGaps.map((gap, idx) => (
          <li
            key={idx}
            className="text-xs text-amber-100 bg-amber-900/30 border border-amber-800/40 rounded-lg p-2 flex items-start gap-2"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{gap}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
