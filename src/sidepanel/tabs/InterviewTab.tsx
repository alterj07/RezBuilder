import React, { useState, useEffect } from 'react';
import { ArrowsClockwise, CaretDown, CaretUp, ChatCircleText, CheckCircle, Download, Medal, Question, Sparkle, Target, Terminal } from '@phosphor-icons/react';
import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { InterviewPrepBriefing } from '../../types/interview';
import { interviewService } from '../../services/interview/interviewService';
import { convertBriefingToMarkdown, downloadMarkdownFile } from '../../services/export/markdownExporter';

interface InterviewTabProps {
  job: JobPosting | null;
  activeResume: Resume | null;
}

export const InterviewTab: React.FC<InterviewTabProps> = ({ job, activeResume }) => {
  const [briefing, setBriefing] = useState<InterviewPrepBriefing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [expandedTechIndex, setExpandedTechIndex] = useState<number | null>(0);
  const [expandedBehavioralIndex, setExpandedBehavioralIndex] = useState<number | null>(0);

  // Load existing briefing if cached for active job
  useEffect(() => {
    if (job) {
      interviewService.getBriefingByJobId(job.id).then((saved) => {
        if (saved) setBriefing(saved);
        else setBriefing(null);
      });
    } else {
      setBriefing(null);
    }
  }, [job?.id]);

  const handleGenerate = async () => {
    if (!job) return;

    setIsLoading(true);
    setError(null);
    try {
      const generated = await interviewService.generateBriefing(job, activeResume || undefined);
      setBriefing(generated);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate interview briefing. Check API key in Settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!briefing) return;
    const md = convertBriefingToMarkdown(briefing);
    const filename = `${briefing.jobTitle.replace(/\s+/g, '_')}_Interview_CheatSheet.md`;
    downloadMarkdownFile(filename, md);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header Bar */}
      <div className="p-3.5 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-between">
        <div className="text-xs">
          <div className="text-surface-400">Target Role:</div>
          <div className="font-semibold text-white truncate max-w-[200px]">
            {job ? `${job.title} @ ${job.company}` : 'No active job'}
          </div>
        </div>

        {briefing && (
          <button
            onClick={handleDownloadMarkdown}
            className="px-2.5 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-brand-300 text-xs font-medium flex items-center gap-1.5 border border-surface-700 transition-colors"
            title="Download Markdown Cheat Sheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .MD</span>
          </button>
        )}
      </div>

      {/* Initial Empty State / Generator CTA */}
      {!briefing && (
        <div className="p-6 rounded-xl border border-surface-800 bg-surface-900/60 text-center space-y-3">
          <ChatCircleText className="w-8 h-8 text-brand-400 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-white">AI Interview Prep Briefing</h3>
            <p className="text-xs text-surface-400 max-w-xs mx-auto mt-1 leading-relaxed">
              Generates high-yield technical and behavioral questions, talking points, core concept summaries, and strategic questions for the interviewer based directly on the JD.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !job}
            className="w-full py-2.5 px-4 rounded-md bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? (
              <>
                <ArrowsClockwise className="w-4 h-4 animate-spin" />
                <span>Generating Interview Briefing...</span>
              </>
            ) : (
              <>
                <Sparkle className="w-4 h-4" />
                <span>Generate Prep Briefing</span>
              </>
            )}
          </button>

          {!job && (
            <p className="text-[11px] text-amber-400">Open or paste a Job Posting first.</p>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {downloadSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Markdown cheat sheet downloaded!</span>
        </div>
      )}

      {/* Structured Briefing View */}
      {briefing && (
        <div className="space-y-4 animate-fadeIn">
          {/* Role Synthesis Card */}
          <div className="p-4 rounded-xl bg-brand-900/25 border border-brand-500/30 space-y-2">
            <div className="flex items-center gap-2 text-brand-300 text-xs font-semibold">
              <Target className="w-4 h-4 text-brand-400" />
              <span>What This Role Actually Cares About</span>
            </div>
            <p className="text-xs text-surface-200 leading-relaxed">{briefing.roleSynthesis}</p>
          </div>

          {/* Core Technologies & Concepts */}
          {briefing.coreConcepts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-brand-400" />
                <span>Core Concepts to Know ({briefing.coreConcepts.length})</span>
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {briefing.coreConcepts.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface-900/80 border border-surface-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-surface-200 text-xs">{item.concept}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-800 text-surface-400 border border-surface-700">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-400 leading-snug">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Likely Technical Questions */}
          {briefing.technicalQuestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Question className="w-3.5 h-3.5 text-brand-400" />
                <span>Likely Technical Questions ({briefing.technicalQuestions.length})</span>
              </h4>
              <div className="space-y-2">
                {briefing.technicalQuestions.map((q, idx) => {
                  const isExpanded = expandedTechIndex === idx;
                  return (
                    <div key={idx} className="rounded-xl bg-surface-900/80 border border-surface-800 overflow-hidden">
                      <button
                        onClick={() => setExpandedTechIndex(isExpanded ? null : idx)}
                        className="w-full p-3 text-left flex items-start justify-between gap-2 hover:bg-surface-850 transition-colors"
                      >
                        <div className="flex items-start gap-2 text-xs font-medium text-surface-200">
                          <span className="text-brand-400 font-mono font-bold">{idx + 1}.</span>
                          <span className="leading-snug">{q.question}</span>
                        </div>
                        {isExpanded ? (
                          <CaretUp className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
                        ) : (
                          <CaretDown className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-3 bg-surface-950/60 border-t border-surface-800/80 space-y-2 text-xs">
                          <div className="text-[11px] font-semibold text-surface-400">Key Talking Points:</div>
                          <ul className="space-y-1 text-surface-300 text-[11px]">
                            {q.suggestedTalkingPoints.map((pt, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-1.5 leading-snug">
                                <span className="text-brand-400">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>

                          {q.keyTermsToMention.length > 0 && (
                            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-surface-500 font-mono">Terms to Drop:</span>
                              {q.keyTermsToMention.map((term, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-900 text-brand-300 border border-surface-800"
                                >
                                  {term}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Likely Behavioral Questions (STAR) */}
          {briefing.behavioralQuestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Medal className="w-3.5 h-3.5 text-brand-400" />
                <span>Behavioral Questions & STAR Tips ({briefing.behavioralQuestions.length})</span>
              </h4>
              <div className="space-y-2">
                {briefing.behavioralQuestions.map((b, idx) => {
                  const isExpanded = expandedBehavioralIndex === idx;
                  return (
                    <div key={idx} className="rounded-xl bg-surface-900/80 border border-surface-800 overflow-hidden">
                      <button
                        onClick={() => setExpandedBehavioralIndex(isExpanded ? null : idx)}
                        className="w-full p-3 text-left flex items-start justify-between gap-2 hover:bg-surface-850 transition-colors"
                      >
                        <div className="flex items-start gap-2 text-xs font-medium text-surface-200">
                          <span className="text-brand-400 font-mono font-bold">B{idx + 1}.</span>
                          <span className="leading-snug">{b.question}</span>
                        </div>
                        {isExpanded ? (
                          <CaretUp className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
                        ) : (
                          <CaretDown className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-3 bg-surface-950/60 border-t border-surface-800/80 space-y-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-surface-500 font-mono">Targeted Value:</span>
                            <span className="text-[10px] font-semibold text-brand-300">{b.targetedValue}</span>
                          </div>
                          <div className="p-2 rounded bg-surface-900 border border-surface-850 text-[11px] text-surface-300 leading-relaxed">
                            <span className="font-semibold text-surface-200">STAR Strategy: </span>
                            {b.starFrameworkTip}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Smart Questions to Ask Interviewer */}
          {briefing.questionsToAskInterviewer.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sparkle className="w-3.5 h-3.5 text-brand-400" />
                <span>Smart Questions to Ask Interviewer ({briefing.questionsToAskInterviewer.length})</span>
              </h4>
              <div className="space-y-2">
                {briefing.questionsToAskInterviewer.map((q, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface-900/80 border border-surface-800 space-y-1">
                    <p className="text-xs font-medium text-surface-100">"{q.question}"</p>
                    <p className="text-[11px] text-surface-400 italic">Purpose: {q.purpose}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-generate button */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-2 rounded-xl border border-surface-800 hover:border-surface-700 bg-surface-900 text-surface-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowsClockwise className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Re-generate Interview Briefing</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
