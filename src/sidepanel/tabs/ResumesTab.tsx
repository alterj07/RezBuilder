import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  Tag,
  ChevronUp,
  Eye,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Award,
} from 'lucide-react';
import { Resume } from '../../types/resume';
import { parseResumeFile } from '../../services/parser';

interface ResumesTabProps {
  resumes: Resume[];
  activeResume: Resume | null;
  onSelectResume: (id: string) => void;
  onSaveResume: (resume: Resume) => void;
  onDeleteResume: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export const ResumesTab: React.FC<ResumesTabProps> = ({
  resumes,
  activeResume,
  onSelectResume,
  onSaveResume,
  onDeleteResume,
  onSetDefault,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('General');
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const parsedResume = await parseResumeFile(file, tagInput);
      onSaveResume(parsedResume);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to parse resume file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Upload Zone */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-brand-400" />
            <span>Upload New Resume</span>
          </label>
          <div className="flex items-center gap-1">
            <Tag className="w-3 h-3 text-surface-400" />
            <input
              type="text"
              placeholder="Tag (e.g. Backend)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="bg-surface-950 border border-surface-800 rounded px-1.5 py-0.5 text-[10px] text-surface-200 w-28 outline-none focus:border-brand-500 font-mono"
            />
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-brand-400 bg-brand-500/10'
              : 'border-surface-800 hover:border-surface-700 bg-surface-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          {isUploading ? (
            <div className="space-y-2">
              <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-surface-300">Extracting text & parsing sections...</p>
            </div>
          ) : (
            <div className="space-y-1">
              <FileText className="w-7 h-7 text-surface-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-surface-200">
                Click or drag & drop resume file
              </p>
              <p className="text-[11px] text-surface-400 font-mono">PDF, DOCX, or TXT (Parsed 100% locally)</p>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {uploadError}
          </div>
        )}
      </div>

      {/* Resumes List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs text-surface-400 font-semibold uppercase tracking-wider font-mono">
          <span>Stored Resumes ({resumes.length})</span>
        </div>

        {resumes.length === 0 ? (
          <div className="p-6 rounded-xl border border-surface-800 bg-surface-900/30 text-center text-xs text-surface-400 space-y-1">
            <p>No resumes stored yet.</p>
            <p className="text-[11px] text-surface-500">
              Upload your base resume above to enable ATS scoring & tailoring.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {resumes.map((resume) => {
              const isActive = activeResume?.id === resume.id;
              const isExpanded = expandedResumeId === resume.id;

              return (
                <div
                  key={resume.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isActive
                      ? 'border-brand-500/50 bg-surface-900/90 shadow-md shadow-brand-500/5'
                      : 'border-surface-800 bg-surface-900/50 hover:border-surface-700'
                  }`}
                >
                  {/* Resume Header Card */}
                  <div className="p-3.5 flex items-start justify-between gap-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => onSelectResume(resume.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white hover:text-brand-300 transition-colors">
                          {resume.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {resume.tag}
                        </span>
                        {resume.isDefault && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-800 text-surface-400 flex items-center gap-0.5">
                            <Award className="w-2.5 h-2.5 text-amber-400" />
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-surface-400 mt-1 flex items-center gap-2">
                        <span>{resume.fileName}</span>
                        <span>•</span>
                        <span>{resume.sections.skills.length} skills</span>
                        <span>•</span>
                        <span>{resume.sections.experience.length} roles</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedResumeId(isExpanded ? null : resume.id)}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
                        title="View Extracted Sections"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => onDeleteResume(resume.id)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Resume"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Section Inspector */}
                  {isExpanded && (
                    <div className="p-3.5 bg-surface-950 border-t border-surface-800 text-xs space-y-3 animate-fadeIn">
                      {/* Contact Line */}
                      <div className="flex flex-wrap gap-2 text-[11px] text-surface-400 pb-2 border-b border-surface-800/60">
                        {resume.sections.contact.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-brand-400" />
                            {resume.sections.contact.email}
                          </span>
                        )}
                        {resume.sections.contact.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-brand-400" />
                            {resume.sections.contact.phone}
                          </span>
                        )}
                        {resume.sections.contact.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-brand-400" />
                            {resume.sections.contact.location}
                          </span>
                        )}
                        {resume.sections.contact.linkedin && (
                          <span className="flex items-center gap-1">
                            <Linkedin className="w-3 h-3 text-brand-400" />
                            LinkedIn
                          </span>
                        )}
                        {resume.sections.contact.github && (
                          <span className="flex items-center gap-1">
                            <Github className="w-3 h-3 text-brand-400" />
                            GitHub
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      {resume.sections.summary && (
                        <div>
                          <div className="text-[10px] font-mono uppercase text-surface-500 font-semibold mb-1">
                            Summary
                          </div>
                          <p className="text-surface-300 text-[11px] leading-relaxed">{resume.sections.summary}</p>
                        </div>
                      )}

                      {/* Experience */}
                      {resume.sections.experience.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase text-surface-500 font-semibold mb-1">
                            Experience ({resume.sections.experience.length})
                          </div>
                          <div className="space-y-2">
                            {resume.sections.experience.map((exp, idx) => (
                              <div key={idx} className="p-2 rounded bg-surface-900/80 border border-surface-850">
                                <div className="font-medium text-surface-200 text-xs">
                                  {exp.title} • <span className="text-brand-300">{exp.company}</span>
                                </div>
                                <div className="text-[10px] text-surface-500 font-mono">
                                  {[exp.startDate, exp.endDate || (exp.isCurrent ? 'Present' : '')].filter(Boolean).join(' – ')}
                                </div>
                                <ul className="mt-1 space-y-0.5">
                                  {exp.bullets.map((b, bIdx) => (
                                    <li key={bIdx} className="text-[11px] text-surface-400 leading-snug flex items-start gap-1">
                                      <span className="text-surface-600">•</span>
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skills */}
                      {resume.sections.skills.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase text-surface-500 font-semibold mb-1">
                            Parsed Skills ({resume.sections.skills.length})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {resume.sections.skills.map((s, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-900 text-surface-300 border border-surface-800"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Education */}
                      {resume.sections.education.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase text-surface-500 font-semibold mb-1">
                            Education
                          </div>
                          {resume.sections.education.map((edu, idx) => (
                            <div key={idx} className="text-[11px] text-surface-300">
                              <span className="font-medium">{edu.institution}</span>
                              {edu.degree && <span> — {edu.degree}</span>}
                              {edu.graduationYear && <span className="text-surface-500 font-mono"> ({edu.graduationYear})</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Default Button */}
                      {!resume.isDefault && (
                        <div className="pt-1">
                          <button
                            onClick={() => onSetDefault(resume.id)}
                            className="text-[11px] text-brand-400 hover:underline"
                          >
                            Set as default resume
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
