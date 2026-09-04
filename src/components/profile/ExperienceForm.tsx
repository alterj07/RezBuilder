import React from 'react';
import { Plus, Trash2, Briefcase, AlertCircle } from 'lucide-react';
import { ExperienceType, ProfileExperience } from '../../types/profile';
import { createProfileEntityId } from '../../services/profile';
import { TagInput } from './TagInput';
import {
  inputClass,
  inputErrorClass,
  selectClass,
  textareaClass,
  labelClass,
  cardClass,
  secondaryButtonClass,
  errorTextClass,
  hintTextClass,
} from './fieldStyles';

interface ExperienceFormProps {
  entries: ProfileExperience[];
  onChange: (entries: ProfileExperience[]) => void;
  /** Known skill names offered as suggestions for "skills used". */
  skillSuggestions?: string[];
  showValidation?: boolean;
}

export const EXPERIENCE_TYPE_OPTIONS: { value: ExperienceType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
  { value: 'research', label: 'Research' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'project', label: 'Project' },
];

export function createExperienceEntry(): ProfileExperience {
  return {
    id: createProfileEntityId('exp'),
    company: '',
    title: '',
    type: 'full_time',
    bullets: [],
  };
}

export function experienceEntryErrors(entry: ProfileExperience): { company?: string; title?: string } {
  const errors: { company?: string; title?: string } = {};
  if (!entry.company.trim()) errors.company = 'Organization is required';
  if (!entry.title.trim()) errors.title = 'Title is required';
  return errors;
}

const DATE_PATTERN = /^\d{4}(-\d{2})?$/;

export const ExperienceForm: React.FC<ExperienceFormProps> = ({
  entries,
  onChange,
  skillSuggestions = [],
  showValidation = false,
}) => {
  const update = (id: string, patch: Partial<ProfileExperience>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => onChange([...entries, createExperienceEntry()]);

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <div className="p-3 rounded-lg border border-dashed border-surface-800 text-center text-[11px] text-surface-500">
          No experiences yet. Jobs, internships, research and personal projects all count.
        </div>
      )}
      {entries.map((entry, idx) => {
        const errors = showValidation ? experienceEntryErrors(entry) : {};
        const startBad = !!entry.startDate && !DATE_PATTERN.test(entry.startDate);
        const endBad = !!entry.endDate && !DATE_PATTERN.test(entry.endDate);
        return (
          <div key={entry.id} className={cardClass} data-testid={`experience-entry-${idx}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-surface-300 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-brand-400" />
                Experience {idx + 1}
              </span>
              <button
                type="button"
                aria-label="Remove experience"
                data-testid={`experience-remove-${idx}`}
                onClick={() => remove(entry.id)}
                className="p-1 rounded text-surface-500 hover:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>
                  Company / organization<span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  data-testid={`experience-company-${idx}`}
                  value={entry.company}
                  placeholder="CloudScale Inc"
                  aria-invalid={!!errors.company || undefined}
                  onChange={(e) => update(entry.id, { company: e.target.value })}
                  className={`${inputClass} ${errors.company ? inputErrorClass : ''}`}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Title<span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  data-testid={`experience-title-${idx}`}
                  value={entry.title}
                  placeholder="Software Engineer"
                  aria-invalid={!!errors.title || undefined}
                  onChange={(e) => update(entry.id, { title: e.target.value })}
                  className={`${inputClass} ${errors.title ? inputErrorClass : ''}`}
                />
              </div>
            </div>
            {(errors.company || errors.title) && (
              <p className={errorTextClass} data-testid={`experience-error-${idx}`}>
                <AlertCircle className="w-3 h-3" />
                {[errors.company, errors.title].filter(Boolean).join(' · ')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Type</label>
                <select
                  data-testid={`experience-type-${idx}`}
                  value={entry.type || 'full_time'}
                  onChange={(e) => update(entry.id, { type: e.target.value as ExperienceType })}
                  className={selectClass}
                >
                  {EXPERIENCE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input
                  type="text"
                  data-testid={`experience-location-${idx}`}
                  value={entry.location || ''}
                  placeholder="Remote"
                  onChange={(e) => update(entry.id, { location: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Start (YYYY-MM)</label>
                <input
                  type="text"
                  data-testid={`experience-start-${idx}`}
                  value={entry.startDate || ''}
                  placeholder="2024-06"
                  aria-invalid={startBad || undefined}
                  onChange={(e) => update(entry.id, { startDate: e.target.value })}
                  className={`${inputClass} font-mono ${startBad ? inputErrorClass : ''}`}
                />
              </div>
              <div>
                <label className={labelClass}>End (YYYY-MM)</label>
                <input
                  type="text"
                  data-testid={`experience-end-${idx}`}
                  value={entry.isCurrent ? '' : entry.endDate || ''}
                  placeholder={entry.isCurrent ? 'Present' : '2025-08'}
                  disabled={!!entry.isCurrent}
                  aria-invalid={endBad || undefined}
                  onChange={(e) => update(entry.id, { endDate: e.target.value })}
                  className={`${inputClass} font-mono disabled:opacity-50 ${endBad ? inputErrorClass : ''}`}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-surface-300 cursor-pointer">
              <input
                type="checkbox"
                data-testid={`experience-current-${idx}`}
                checked={!!entry.isCurrent}
                onChange={(e) =>
                  update(entry.id, { isCurrent: e.target.checked, endDate: e.target.checked ? undefined : entry.endDate })
                }
                className="accent-brand-500"
              />
              I currently work here
            </label>

            <div>
              <label className={labelClass}>Highlights (one per line)</label>
              <textarea
                data-testid={`experience-bullets-${idx}`}
                value={entry.bullets.join('\n')}
                placeholder={'Built X that did Y, improving Z by 30%\nLed a team of 4 engineers'}
                onChange={(e) => update(entry.id, { bullets: e.target.value.split('\n') })}
                onBlur={() =>
                  update(entry.id, { bullets: entry.bullets.map((b) => b.trim()).filter(Boolean) })
                }
                className={textareaClass}
              />
              <p className={hintTextClass}>Start each line with a strong verb; numbers help.</p>
            </div>

            <TagInput
              label="Skills used (optional)"
              value={entry.skillsUsed || []}
              onChange={(skillsUsed) => update(entry.id, { skillsUsed })}
              suggestions={skillSuggestions.slice(0, 12)}
              placeholder="TypeScript, Kubernetes…"
              testId={`experience-skills-${idx}`}
            />
          </div>
        );
      })}

      <button type="button" data-testid="experience-add" onClick={add} className={secondaryButtonClass}>
        <Plus className="w-3.5 h-3.5" />
        Add experience or project
      </button>
    </div>
  );
};
