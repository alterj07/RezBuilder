import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  Printer,
  Edit2,
  Save,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { JobPosting } from '../../types/job';
import { Resume, TailoredResume, ResumeSections } from '../../types/resume';
import { DiffViewer } from '../../components/tailor/DiffViewer';
import { GapAlertCard } from '../../components/tailor/GapAlertCard';
import { generateDocxResume } from '../../services/export/docxExporter';
import { printResumeToPdf } from '../../services/export/pdfExporter';
import { tailorService, TailoredResumeResult } from '../../services/tailor/tailorService';
import { getStoredSettings } from '../../services/ai/aiFactory';
import { UserSettings } from '../../types/settings';

interface TailorTabProps {
  job: JobPosting | null;
  resumes: Resume[];
  activeResume: Resume | null;
  onSelectResume: (id: string) => void;
  tailoredResume: TailoredResume | null;
  onSaveTailoredResume: (tailored: TailoredResume) => void;
}

export const TailorTab: React.FC<TailorTabProps> = ({
  job,
  resumes,
  activeResume,
  onSelectResume,
  tailoredResume,
  onSaveTailoredResume,
}) => {
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSections, setEditedSections] = useState<ResumeSections | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<TailoredResumeResult | null>(null);

  const handleTailor = async () => {
    if (!job || !activeResume) return;

    setIsTailoring(true);
    setTailorError(null);
    setExportSuccess(null);

    try {
      const settings: UserSettings = await getStoredSettings();
      let apiKey = settings.anthropicApiKey;
      let model = settings.anthropicModel;

      if (settings.aiProvider === 'openai') {
        apiKey = settings.openaiApiKey || '';
        model = settings.openaiModel || 'gpt-4o';
      } else if (settings.aiProvider === 'gemini') {
        apiKey = settings.geminiApiKey || '';
        model = settings.geminiModel || 'gemini-1.5-pro';
      }

      const result = await tailorService.tailorResume(job, activeResume, {
        provider: settings.aiProvider,
        apiKey,
        model,
      });

      setTailorResult(result);
      onSaveTailoredResume(result.tailoredResume);
      setEditedSections(result.tailoredResume.sections);
    } catch (err: any) {
      console.error(err);
      setTailorError(err.message || 'Failed to tailor resume.');
    } finally {
      setIsTailoring(false);
    }
  };

  const currentSections = editedSections || tailoredResume?.sections || activeResume?.sections;

  const handleExportDocx = async () => {
    if (!currentSections) return;
    try {
      const candidateName = currentSections.contact.name || 'Tailored_Resume';
      const blob = await generateDocxResume(currentSections, candidateName);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${candidateName.replace(/\s+/g, '_')}_Tailored_${job?.company || 'Job'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess('DOCX downloaded successfully!');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setTailorError('Failed to generate DOCX file.');
    }
  };

  const handleExportPdf = () => {
    if (!currentSections) return;
    const candidateName = currentSections.contact.name || 'Tailored_Resume';
    printResumeToPdf(currentSections, candidateName);
    setExportSuccess('Opened print dialog for PDF export!');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header & Target Summary */}
      <div className="p-3.5 rounded-xl bg-surface-900 border border-surface-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-surface-400">
            <Layers className="w-3.5 h-3.5 text-brand-400" />
            <span>Target:</span>
            <span className="text-white font-medium truncate max-w-[180px]">
              {job ? `${job.title} @ ${job.company}` : 'No active job'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {tailorResult?.strategy === 'ai_llm'
              ? `AI (${tailorResult.provider || 'LLM'})`
              : '100% Local Engine'}
          </span>
        </div>

        {/* Base Resume Switcher */}
        {resumes.length > 1 && (
          <div className="flex items-center justify-between pt-1 border-t border-surface-800 text-[11px]">
            <span className="text-surface-400">Base Resume:</span>
            <select
              value={activeResume?.id || ''}
              onChange={(e) => onSelectResume(e.target.value)}
              className="bg-surface-950 border border-surface-700 text-surface-200 text-xs rounded px-2 py-0.5 outline-none focus:border-brand-500"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.tag})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tailor Action Card */}
      {!tailoredResume && (
        <div className="p-5 rounded-xl border border-surface-800 bg-surface-900/60 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-brand-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Deterministic ATS Customization</h3>
            <p className="text-xs text-surface-400 max-w-xs mx-auto mt-1 leading-relaxed">
              Standardizes action verbs, aligns keywords with the job posting, elevates high-relevance achievements, and surfaces skill gaps instantly without external LLM calls or API keys.
            </p>
          </div>

          <button
            onClick={handleTailor}
            disabled={isTailoring || !job || !activeResume}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Tailored Resume (Instant Local)</span>
          </button>

          {(!job || !activeResume) && (
            <p className="text-[11px] text-amber-400">
              Please ensure both a Job Posting and a Resume are selected.
            </p>
          )}
        </div>
      )}

      {tailorError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
          {tailorError}
        </div>
      )}

      {exportSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Tailored Results View */}
      {tailoredResume && activeResume && (
        <div className="space-y-4">
          {/* Action Header & Export Toolbar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-900 border border-surface-800">
            <div className="flex items-center gap-1.5 text-xs text-brand-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>Tailored Version Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportDocx}
                className="px-2.5 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                title="Download ATS-Friendly Word Document"
              >
                <Download className="w-3.5 h-3.5 text-brand-400" />
                <span>DOCX</span>
              </button>
              <button
                onClick={handleExportPdf}
                className="px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                title="Print or Save clean PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                onClick={handleTailor}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
                title="Re-run Local Customization"
              >
                <Zap className="w-3.5 h-3.5 text-brand-400" />
              </button>
            </div>
          </div>

          {/* Changes Summary Badge */}
          {tailoredResume.changesSummary && tailoredResume.changesSummary.length > 0 && (
            <div className="p-3 rounded-xl bg-surface-900/60 border border-surface-800 space-y-1.5 text-xs">
              <div className="font-semibold text-surface-200 text-[11px] uppercase tracking-wider font-mono">
                Key Optimizations:
              </div>
              <ul className="space-y-1 text-surface-300 text-[11px]">
                {tailoredResume.changesSummary.map((change, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 text-brand-400 shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unresolved Gaps Card */}
          <GapAlertCard unresolvedGaps={tailoredResume.unresolvedGaps} />

          {/* Diff Views */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider font-mono">
              Before / After Comparisons
            </h4>

            {/* Summary Diff */}
            {tailoredResume.sections.summary && (
              <DiffViewer
                title="Professional Summary"
                originalText={activeResume.sections.summary || 'No summary provided in base resume.'}
                tailoredText={tailoredResume.sections.summary}
                rationale="Refocused summary around target role responsibilities and key tools."
              />
            )}

            {/* Experience Bullets Diffs */}
            {tailoredResume.sections.experience.map((tailoredExp, idx) => {
              const baseExp = activeResume.sections.experience[idx];
              const originalBullets = (baseExp?.bullets || []).join('\n• ');
              const tailoredBullets = tailoredExp.bullets.join('\n• ');

              return (
                <DiffViewer
                  key={idx}
                  title={`${tailoredExp.title} @ ${tailoredExp.company}`}
                  originalText={originalBullets ? `• ${originalBullets}` : ''}
                  tailoredText={tailoredBullets ? `• ${tailoredBullets}` : ''}
                  bulletDiffs={tailoredExp.bulletDiffs}
                  rationale="Reordered and sharpened bullet points with strong action verbs and matched keywords."
                />
              );
            })}
          </div>

          {/* Inline Edit Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-surface-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-brand-400" />
              <span>{isEditing ? 'Close Manual Editor' : 'Edit Tailored Text Manually Before Export'}</span>
            </button>

            {isEditing && currentSections && (
              <div className="mt-3 p-4 rounded-xl bg-surface-950 border border-surface-800 space-y-3 text-xs">
                <div>
                  <label className="text-[11px] text-surface-400 block mb-1">Tailored Summary</label>
                  <textarea
                    rows={3}
                    value={currentSections.summary}
                    onChange={(e) =>
                      setEditedSections({ ...currentSections, summary: e.target.value })
                    }
                    className="w-full bg-surface-900 border border-surface-800 rounded-lg p-2 text-xs text-white outline-none focus:border-brand-500 font-sans"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-surface-400 block mb-1">Tailored Skills List</label>
                  <input
                    type="text"
                    value={currentSections.skills.join(', ')}
                    onChange={(e) =>
                      setEditedSections({
                        ...currentSections,
                        skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full bg-surface-900 border border-surface-800 rounded-lg p-2 text-xs text-white outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (editedSections) {
                        onSaveTailoredResume({ ...tailoredResume, sections: editedSections });
                        setIsEditing(false);
                        setExportSuccess('Manual edits saved!');
                        setTimeout(() => setExportSuccess(null), 3000);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save Edits</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
