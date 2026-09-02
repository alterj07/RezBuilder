import React, { useState } from 'react';
import {
  Briefcase,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  ExternalLink,
  Edit3,
  Sliders,
  ChevronDown,
  Layers,
  Award,
} from 'lucide-react';
import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { AtsPresetName, AtsScoreResult } from '../../types/scoring';
import { calculateAtsScore } from '../../services/scoring/atsEngine';
import { compareResumesAgainstJob } from '../../services/scoring/multiResumeComparator';

interface JobTabProps {
  job: JobPosting | null;
  resumes: Resume[];
  activeResume: Resume | null;
  onSelectResume: (id: string) => void;
  onRefreshScrape: () => void;
  onManualJobSave: (job: JobPosting) => void;
  onNavigateToTailor: () => void;
  isLoading: boolean;
  scrapeNotice?: string | null;
}

export const JobTab: React.FC<JobTabProps> = ({
  job,
  resumes,
  activeResume,
  onSelectResume,
  onRefreshScrape,
  onManualJobSave,
  onNavigateToTailor,
  isLoading,
  scrapeNotice = null,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<AtsPresetName>('standard');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [showKeywordList, setShowKeywordList] = useState(false);

  // Compute ATS Score if job and active resume exist
  const scoreResult: AtsScoreResult | null =
    job && activeResume ? calculateAtsScore(job, activeResume, selectedPreset) : null;

  // Compute multi-resume comparison if multiple resumes exist
  const comparisonResult = job && resumes.length > 1 ? compareResumesAgainstJob(job, resumes, selectedPreset) : null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualDesc) return;

    const newJob: JobPosting = {
      id: 'manual_' + Date.now(),
      title: manualTitle.trim(),
      company: manualCompany.trim() || 'Target Company',
      description: manualDesc.trim(),
      requiredSkills: [],
      url: '',
      source: 'manual',
      scrapedAt: new Date().toISOString(),
    };

    onManualJobSave(newJob);
    setShowManualModal(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
          <Briefcase className="w-3.5 h-3.5 text-brand-400" />
          <span>Active Job Posting</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowManualModal(true)}
            className="p-1.5 rounded-lg border border-surface-800 bg-surface-900 text-surface-300 hover:text-white hover:border-surface-700 text-xs flex items-center gap-1 transition-all"
            title="Paste Job Description Manually"
          >
            <Edit3 className="w-3 h-3" />
            <span className="text-[11px]">Paste JD</span>
          </button>
          <button
            onClick={onRefreshScrape}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-surface-800 bg-surface-900 text-surface-300 hover:text-white hover:border-surface-700 text-xs flex items-center gap-1 transition-all disabled:opacity-50"
            title="Re-scrape current tab"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-brand-400' : ''}`} />
            <span className="text-[11px]">Scrape Tab</span>
          </button>
        </div>
      </div>

      {/* Scrape Outcome Notice */}
      {scrapeNotice && (
        <div
          data-testid="scrape-notice"
          className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300 leading-snug"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{scrapeNotice}</span>
        </div>
      )}

      {/* Active Job Card */}
      {job ? (
        <div className="rounded-xl border border-surface-800 bg-surface-900/80 p-4 space-y-3 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
                  {job.source}
                </span>
                {job.remoteStatus && job.remoteStatus !== 'Unspecified' && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-surface-800 text-surface-300 border border-surface-700 font-medium">
                    {job.remoteStatus}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-semibold text-white mt-1.5 leading-snug">{job.title}</h2>
              <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                <span className="text-surface-200 font-medium">{job.company}</span>
                {job.location && (
                  <span className="flex items-center gap-0.5 text-surface-400">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                )}
              </div>
            </div>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-surface-500 hover:text-brand-400 transition-colors p-1"
                title="Open job posting"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Job Skills Pills */}
          {(job.requiredSkills || []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {(job.requiredSkills || []).slice(0, 8).map((skill, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-surface-950 text-surface-300 border border-surface-800"
                >
                  {skill}
                </span>
              ))}
              {(job.requiredSkills || []).length > 8 && (
                <span className="text-[10px] px-1.5 py-0.5 text-surface-500">
                  +{(job.requiredSkills || []).length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-surface-800 bg-surface-900/30 flex flex-col items-center text-center space-y-2">
          <Briefcase className="w-8 h-8 text-surface-500" />
          <h3 className="text-xs font-semibold text-surface-200">No Job Posting Detected</h3>
          <p className="text-[11px] text-surface-400 max-w-xs">
            Open a job on LinkedIn, Indeed, Greenhouse, or Lever. RezBuilder will auto-capture it, or paste text above.
          </p>
        </div>
      )}

      {/* ATS Scoring Section */}
      {job && (
        <div className="space-y-3">
          {/* Base Resume Selector & ATS Preset Bar */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-900/60 border border-surface-800">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-surface-400 font-medium flex items-center gap-1">
                <Layers className="w-3 h-3 text-brand-400" />
                <span>Base Resume:</span>
              </label>
              {resumes.length > 0 ? (
                <select
                  value={activeResume?.id || ''}
                  onChange={(e) => onSelectResume(e.target.value)}
                  className="bg-surface-950 border border-surface-700 text-surface-100 text-xs rounded-lg px-2 py-1 outline-none focus:border-brand-500"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.tag})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] text-amber-400">No resumes uploaded yet</span>
              )}
            </div>

            {/* Platform Presets */}
            <div className="flex items-center justify-between pt-1 border-t border-surface-800/80">
              <span className="text-[11px] text-surface-400 flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                <span>ATS Engine:</span>
              </span>
              <div className="flex items-center gap-1">
                {(['standard', 'enterprise', 'modern'] as AtsPresetName[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPreset(p)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all capitalize ${
                      selectedPreset === p
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                        : 'text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-Resume Recommendation Badge */}
          {comparisonResult && comparisonResult.recommendation && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-brand-950/40 to-surface-900 border border-brand-500/30 flex items-start gap-2.5">
              <Award className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-brand-300 flex items-center gap-1.5">
                  Best Fit: {comparisonResult.recommendation.resumeName}
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300">
                    {comparisonResult.recommendation.scoreResult.overallScore}%
                  </span>
                </div>
                <p className="text-[11px] text-surface-300 mt-0.5 leading-snug">
                  {comparisonResult.recommendation.recommendationReason}
                </p>
              </div>
            </div>
          )}

          {/* RezBuilder Composite Score Card */}
          {scoreResult ? (
            <div className="rounded-xl border border-surface-800 bg-surface-900/90 p-4 space-y-4 shadow-sm">
              {/* Overall Score Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-mono tracking-wider text-surface-400">
                    RezBuilder ATS Match Score
                  </div>
                  <div className="text-xs text-surface-400 mt-0.5">
                    Preset: <span className="text-surface-200 capitalize font-medium">{selectedPreset} ATS</span> (W1={scoreResult.weights.keywordMatch}% W2={scoreResult.weights.placement}% W3={scoreResult.weights.sectionCompleteness}% W4={scoreResult.weights.parseSuccess}% W5={scoreResult.weights.relevance}%)
                  </div>
                </div>
                <div
                  className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-bold shadow-lg ${getScoreColor(
                    scoreResult.overallScore
                  )}`}
                >
                  <span className="text-xl leading-none">{scoreResult.overallScore}</span>
                  <span className="text-[9px] font-normal opacity-80">/ 100</span>
                </div>
              </div>

              {/* 5-Factor Weighted Score Breakdown Bars */}
              <div className="space-y-2 pt-2 border-t border-surface-800">
                {/* 1. Keyword Match */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-300 font-medium flex items-center gap-1">
                      <span>1. Keyword Match</span>
                      <span className="text-[10px] text-surface-500 font-mono">({scoreResult.weights.keywordMatch}%)</span>
                    </span>
                    <span className="font-mono text-surface-200">
                      {scoreResult.keywordScore}% ({scoreResult.keywordDetails.matchedKeywords}/{scoreResult.keywordDetails.totalKeywords})
                    </span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBg(scoreResult.keywordScore)}`}
                      style={{ width: `${scoreResult.keywordScore}%` }}
                    />
                  </div>
                </div>

                {/* 2. Placement Multiplier */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-300 font-medium flex items-center gap-1">
                      <span>2. Keyword Placement</span>
                      <span className="text-[10px] text-surface-500 font-mono">({scoreResult.weights.placement}%)</span>
                    </span>
                    <span className="font-mono text-surface-200">{scoreResult.placementScore}%</span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBg(scoreResult.placementScore)}`}
                      style={{ width: `${scoreResult.placementScore}%` }}
                    />
                  </div>
                </div>

                {/* 3. Section Completeness */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-300 font-medium flex items-center gap-1">
                      <span>3. Section Completeness</span>
                      <span className="text-[10px] text-surface-500 font-mono">({scoreResult.weights.sectionCompleteness}%)</span>
                    </span>
                    <span className="font-mono text-surface-200">{scoreResult.sectionScore}%</span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBg(scoreResult.sectionScore)}`}
                      style={{ width: `${scoreResult.sectionScore}%` }}
                    />
                  </div>
                </div>

                {/* 4. Parse Success */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-300 font-medium flex items-center gap-1">
                      <span>4. Parse Success & ATS Format</span>
                      <span className="text-[10px] text-surface-500 font-mono">({scoreResult.weights.parseSuccess}%)</span>
                    </span>
                    <span className="font-mono text-surface-200">
                      {scoreResult.parseScore}% ({scoreResult.parseDetails.cleanlinessRating})
                    </span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBg(scoreResult.parseScore)}`}
                      style={{ width: `${scoreResult.parseScore}%` }}
                    />
                  </div>
                </div>

                {/* 5. Relevance Boost */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-300 font-medium flex items-center gap-1">
                      <span>5. Role Relevance & Tenure</span>
                      <span className="text-[10px] text-surface-500 font-mono">({scoreResult.weights.relevance}%)</span>
                    </span>
                    <span className="font-mono text-surface-200">{scoreResult.relevanceScore}%</span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getScoreBg(scoreResult.relevanceScore)}`}
                      style={{ width: `${scoreResult.relevanceScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Matched vs Missing Keywords Dropdown */}
              <div className="pt-2 border-t border-surface-800">
                <button
                  onClick={() => setShowKeywordList(!showKeywordList)}
                  className="w-full flex items-center justify-between text-xs text-surface-300 hover:text-white py-1"
                >
                  <span className="font-medium flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-400" />
                    <span>Keyword Breakdown ({scoreResult.keywordDetails.matchedKeywords} Matched, {scoreResult.keywordDetails.missingKeywords} Missing)</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showKeywordList ? 'rotate-180' : ''}`} />
                </button>

                {showKeywordList && (
                  <div className="pt-2 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase font-mono text-emerald-400 mb-1">
                        Matched Keywords ({scoreResult.keywordDetails.matchedKeywords})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {scoreResult.keywordDetails.items
                          .filter((k) => k.foundInResume)
                          .map((k, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {k.keyword}
                            </span>
                          ))}
                      </div>
                    </div>

                    {scoreResult.keywordDetails.missingKeywords > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-mono text-amber-400 mb-1">
                          Missing From Resume ({scoreResult.keywordDetails.missingKeywords})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {scoreResult.keywordDetails.items
                            .filter((k) => !k.foundInResume)
                            .map((k, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 flex items-center gap-1"
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                                {k.keyword}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actionable Recommendations */}
              {scoreResult.recommendations.length > 0 && (
                <div className="pt-2 border-t border-surface-800 space-y-1.5">
                  <div className="text-[11px] font-semibold text-surface-200">Recommended Next Steps:</div>
                  <ul className="space-y-1 text-xs text-surface-400">
                    {scoreResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-brand-400 shrink-0">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tailor CTA */}
              <button
                onClick={onNavigateToTailor}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tailor Resume for this Role</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-surface-800 bg-surface-900/40 text-center text-xs text-surface-400">
              Upload a resume in the <strong className="text-surface-200">Resumes</strong> tab to calculate your ATS match score.
            </div>
          )}
        </div>
      )}

      {/* Manual Job Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl w-full max-w-md p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Paste Job Description</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-surface-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-surface-400 block mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-surface-400 block mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Stripe"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-surface-400 block mb-1">Job Description Text</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Paste the full job posting text here..."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full bg-surface-950 border border-surface-800 rounded-lg p-2 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-surface-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold shadow-md shadow-brand-500/20"
                >
                  Save & Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
