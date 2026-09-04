import React, { useRef, useState } from 'react';
import { Linkedin, FileText, FileSpreadsheet, ExternalLink, AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { Resume } from '../../types/resume';
import { selectClass, secondaryButtonClass, primaryButtonClass, ghostButtonClass, hintTextClass } from './fieldStyles';

export const LINKEDIN_SKILLS_URL = 'https://www.linkedin.com/in/me/details/skills/';

export type ImportSource = 'linkedin' | 'resume' | 'export';

export type ImportStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; source: ImportSource; message: string }
  | { kind: 'success'; message: string; warnings: string[] }
  | { kind: 'error'; message: string; warnings: string[] };

interface ImportRowProps {
  resumes: Resume[];
  status: ImportStatus;
  onImportLinkedIn: () => void;
  onImportResume: (resumeId: string) => void;
  onImportExportFiles: (files: File[]) => void;
  /** Opens a URL in a new tab (chrome.tabs.create when available). */
  onOpenUrl: (url: string) => void;
  onDismissStatus: () => void;
}

/** The scraper's "Only N skills visible; open /details/skills/ …" warning. */
function isSkillsVisibilityWarning(warning: string): boolean {
  return /skills?/i.test(warning) && /(visible|details\/skills)/i.test(warning);
}

/**
 * Three import entry points shared by the wizard and the editor. Presentational:
 * the async work happens in ProfileTab, which passes back `status`.
 */
export const ImportRow: React.FC<ImportRowProps> = ({
  resumes,
  status,
  onImportLinkedIn,
  onImportResume,
  onImportExportFiles,
  onOpenUrl,
  onDismissStatus,
}) => {
  const [resumePickerOpen, setResumePickerOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(resumes[0]?.id || '');
  const [showExportHelp, setShowExportHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status.kind === 'busy';
  const hasResumes = resumes.length > 0;
  const effectiveResumeId = resumes.some((r) => r.id === selectedResumeId) ? selectedResumeId : resumes[0]?.id || '';

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) onImportExportFiles(files);
    e.target.value = '';
  };

  return (
    <div className="space-y-2" data-testid="import-row">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-surface-500 font-semibold tracking-wider">Import</span>
        <span className={hintTextClass}>Merges into your profile; nothing is overwritten.</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          data-testid="import-linkedin"
          onClick={onImportLinkedIn}
          disabled={busy}
          title="Opens linkedin.com/in/me in a new tab and reads your profile"
          className={`${secondaryButtonClass} justify-center`}
        >
          {status.kind === 'busy' && status.source === 'linkedin' ? (
            <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Linkedin className="w-3.5 h-3.5 text-brand-400" />
          )}
          <span className="truncate">LinkedIn</span>
        </button>

        <button
          type="button"
          data-testid="import-resume"
          onClick={() => setResumePickerOpen((open) => !open)}
          disabled={busy || !hasResumes}
          title={hasResumes ? 'Build your profile from a stored resume' : 'Upload a resume in the Resumes tab first'}
          className={`${secondaryButtonClass} justify-center`}
        >
          {status.kind === 'busy' && status.source === 'resume' ? (
            <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-brand-400" />
          )}
          <span className="truncate">Resume</span>
        </button>

        <button
          type="button"
          data-testid="import-export"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title="Import the CSV files from LinkedIn's data export"
          className={`${secondaryButtonClass} justify-center`}
        >
          {status.kind === 'busy' && status.source === 'export' ? (
            <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5 text-brand-400" />
          )}
          <span className="truncate">Data export</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,text/csv"
          data-testid="import-export-input"
          onChange={handleFiles}
          className="hidden"
        />
      </div>

      {!hasResumes && (
        <p className={hintTextClass} data-testid="import-resume-hint">
          Upload a resume in the Resumes tab first to import from it.
        </p>
      )}

      {resumePickerOpen && hasResumes && (
        <div className="p-2.5 rounded-lg border border-surface-800 bg-surface-900/60 space-y-2 animate-fadeIn">
          <label className="text-[11px] text-surface-400 block">Which resume?</label>
          <select
            data-testid="import-resume-select"
            value={effectiveResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
            className={selectClass}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.tag ? ` — ${r.tag}` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" onClick={() => setResumePickerOpen(false)} className={ghostButtonClass}>
              Cancel
            </button>
            <button
              type="button"
              data-testid="import-resume-confirm"
              disabled={!effectiveResumeId || busy}
              onClick={() => {
                setResumePickerOpen(false);
                onImportResume(effectiveResumeId);
              }}
              className={primaryButtonClass}
            >
              Import
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        data-testid="import-export-help-toggle"
        onClick={() => setShowExportHelp((v) => !v)}
        className={`${ghostButtonClass} -ml-2`}
      >
        <HelpCircle className="w-3 h-3" />
        How do I get my LinkedIn data export?
      </button>
      {showExportHelp && (
        <div
          data-testid="import-export-help"
          className="p-2.5 rounded-lg border border-surface-800 bg-surface-900/60 text-[11px] text-surface-300 leading-relaxed space-y-1"
        >
          <p>
            LinkedIn → <strong>Settings</strong> → <strong>Data privacy</strong> → <strong>Get a copy of your data</strong> →{' '}
            <em>Want something in particular?</em> → check <strong>Profile</strong>, <strong>Positions</strong>,{' '}
            <strong>Education</strong>, <strong>Skills</strong> and <strong>Certifications</strong>.
          </p>
          <p className="text-surface-500">
            Unzip the archive LinkedIn emails you, then pick the CSV files above (you can select several at once).
          </p>
        </div>
      )}

      {status.kind === 'busy' && (
        <div
          data-testid="import-status"
          className="p-2.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-200 text-[11px] flex items-center gap-2"
        >
          <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      {(status.kind === 'success' || status.kind === 'error') && (
        <div
          data-testid="import-status"
          className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 animate-fadeIn ${
            status.kind === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-start gap-1.5">
              {status.kind === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              )}
              <span data-testid="import-status-message">{status.message}</span>
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismissStatus}
              className="text-current opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {status.warnings.length > 0 && (
            <ul className="space-y-1 pl-5" data-testid="import-warnings">
              {status.warnings.map((warning) => (
                <li key={warning} className="text-amber-200/90 list-disc">
                  <span>{warning}</span>
                  {isSkillsVisibilityWarning(warning) && (
                    <button
                      type="button"
                      data-testid="open-linkedin-skills"
                      onClick={() => onOpenUrl(LINKEDIN_SKILLS_URL)}
                      className="ml-1.5 inline-flex items-center gap-0.5 text-brand-300 hover:underline"
                    >
                      Open your full skills list
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
