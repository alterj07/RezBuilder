import React, { useState } from 'react';
import { diffWords } from 'diff';
import { AlignLeft, CaretRight, Check, Columns, Sparkle } from '@phosphor-icons/react';
import { TailoredBulletDiff } from '../../types/resume';

interface DiffViewerProps {
  originalText: string;
  tailoredText: string;
  title: string;
  rationale?: string;
  bulletDiffs?: TailoredBulletDiff[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalText,
  tailoredText,
  title,
  rationale,
  bulletDiffs,
}) => {
  const [viewMode, setViewMode] = useState<'inline' | 'split'>('inline');

  const wordDiff = diffWords(originalText || '', tailoredText || '');

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/60 overflow-hidden shadow-sm transition-all hover:border-surface-700">
      {/* Diff Header */}
      <div className="px-4 py-2.5 bg-surface-850/80 border-b border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkle className="w-3.5 h-3.5 text-brand-400" />
          <h4 className="text-xs font-semibold text-white tracking-tight">{title}</h4>
        </div>
        <div className="flex items-center gap-1 bg-surface-950/80 p-0.5 rounded-lg border border-surface-800">
          <button
            onClick={() => setViewMode('inline')}
            className={`p-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              viewMode === 'inline'
                ? 'bg-surface-800 text-brand-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
            }`}
            title="Inline Unified Diff"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Inline</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`p-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              viewMode === 'split'
                ? 'bg-surface-800 text-brand-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
            }`}
            title="Side-by-side Split Diff"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>
        </div>
      </div>

      {/* Rationale / Changes Callout */}
      {rationale && (
        <div className="px-4 py-2 bg-brand-500/5 border-b border-surface-800/80 text-[11px] text-brand-300 flex items-start gap-1.5">
          <CaretRight className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
          <span>{rationale}</span>
        </div>
      )}

      {/* Diff Content */}
      <div className="p-4 text-xs font-mono leading-relaxed">
        {bulletDiffs && bulletDiffs.length > 0 ? (
          <div className="space-y-3 font-sans">
            {bulletDiffs.map((diff, idx) => {
              const bDiff = diffWords(diff.original || '', diff.tailored || '');
              return (
                <div key={idx} className="p-2.5 rounded-lg bg-surface-950/60 border border-surface-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
                      Bullet #{idx + 1}
                    </span>
                    {diff.reason && (
                      <span className="text-[10px] text-surface-400 font-sans italic">{diff.reason}</span>
                    )}
                  </div>

                  {viewMode === 'inline' ? (
                    <p className="text-xs text-surface-200 leading-normal">
                      {bDiff.map((part, pIdx) => {
                        if (part.added) {
                          return (
                            <span key={pIdx} className="bg-brand-500/25 text-brand-300 px-1 py-0.5 rounded font-medium">
                              {part.value}
                            </span>
                          );
                        }
                        if (part.removed) {
                          return (
                            <span key={pIdx} className="bg-red-500/20 text-red-400 line-through px-1 py-0.5 rounded opacity-75">
                              {part.value}
                            </span>
                          );
                        }
                        return <span key={pIdx}>{part.value}</span>;
                      })}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-surface-900 border border-surface-800 text-surface-400">
                        <div className="text-[10px] text-surface-500 font-mono mb-1">ORIGINAL</div>
                        {diff.original}
                      </div>
                      <div className="p-2 rounded bg-brand-950/30 border border-brand-800/30 text-surface-200">
                        <div className="text-[10px] text-brand-400 font-mono mb-1">TAILORED</div>
                        {diff.tailored}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'inline' ? (
          <div className="text-surface-200 font-sans leading-relaxed">
            {wordDiff.map((part, idx) => {
              if (part.added) {
                return (
                  <span key={idx} className="bg-brand-500/25 text-brand-300 px-1 py-0.5 rounded font-medium">
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span key={idx} className="bg-red-500/20 text-red-400 line-through px-1 py-0.5 rounded opacity-75">
                    {part.value}
                  </span>
                );
              }
              return <span key={idx}>{part.value}</span>;
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 font-sans">
            <div className="p-3 rounded-lg bg-surface-950 border border-surface-800 text-surface-400">
              <div className="text-[10px] text-surface-500 font-mono mb-1.5 flex items-center gap-1">
                <span>BEFORE</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{originalText || ''}</p>
            </div>
            <div className="p-3 rounded-lg bg-brand-950/20 border border-brand-800/30 text-surface-100">
              <div className="text-[10px] text-brand-400 font-mono mb-1.5 flex items-center gap-1">
                <Check className="w-3 h-3 text-brand-400" />
                <span>AFTER (TAILORED)</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{tailoredText || ''}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
