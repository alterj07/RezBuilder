import React from 'react';
import { Plus, Trash2, GraduationCap, AlertCircle } from 'lucide-react';
import { DegreeLevel, EducationStatus, ProfileEducation } from '../../types/profile';
import { createProfileEntityId } from '../../services/profile';
import {
  inputClass,
  inputErrorClass,
  selectClass,
  labelClass,
  cardClass,
  secondaryButtonClass,
  errorTextClass,
} from './fieldStyles';

interface EducationFormProps {
  entries: ProfileEducation[];
  onChange: (entries: ProfileEducation[]) => void;
  showValidation?: boolean;
}

export const DEGREE_LEVEL_OPTIONS: { value: DegreeLevel; label: string }[] = [
  { value: 'high_school', label: 'High school' },
  { value: 'associate', label: 'Associate' },
  { value: 'bachelor', label: "Bachelor's" },
  { value: 'master', label: "Master's" },
  { value: 'phd', label: 'PhD / Doctorate' },
  { value: 'bootcamp', label: 'Bootcamp' },
  { value: 'other', label: 'Other' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function createEducationEntry(): ProfileEducation {
  return {
    id: createProfileEntityId('edu'),
    institution: '',
    degreeLevel: 'bachelor',
    status: 'in_progress',
  };
}

/** Per-entry validation used by the wizard gate. */
export function educationEntryErrors(entry: ProfileEducation): { institution?: string; graduationYear?: string } {
  const errors: { institution?: string; graduationYear?: string } = {};
  if (!entry.institution.trim()) errors.institution = 'School is required';
  if (typeof entry.graduationYear !== 'number' || !Number.isFinite(entry.graduationYear)) {
    errors.graduationYear = 'Graduating class year is required';
  } else if (entry.graduationYear < 1950 || entry.graduationYear > 2100) {
    errors.graduationYear = 'Enter a four-digit year';
  }
  return errors;
}

export const EducationForm: React.FC<EducationFormProps> = ({ entries, onChange, showValidation = false }) => {
  const update = (id: string, patch: Partial<ProfileEducation>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => onChange([...entries, createEducationEntry()]);

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <div className="p-3 rounded-lg border border-dashed border-surface-800 text-center text-[11px] text-surface-500">
          No education yet. Add your school and graduating class.
        </div>
      )}
      {entries.map((entry, idx) => {
        const errors = showValidation ? educationEntryErrors(entry) : {};
        return (
          <div key={entry.id} className={cardClass} data-testid={`education-entry-${idx}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-surface-300 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-brand-400" />
                Education {idx + 1}
              </span>
              <button
                type="button"
                aria-label="Remove education"
                data-testid={`education-remove-${idx}`}
                onClick={() => remove(entry.id)}
                className="p-1 rounded text-surface-500 hover:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className={labelClass}>
                School / institution<span className="text-rose-400 ml-0.5">*</span>
              </label>
              <input
                type="text"
                data-testid={`education-institution-${idx}`}
                value={entry.institution}
                placeholder="UC Berkeley"
                aria-invalid={!!errors.institution || undefined}
                onChange={(e) => update(entry.id, { institution: e.target.value })}
                className={`${inputClass} ${errors.institution ? inputErrorClass : ''}`}
              />
              {errors.institution && (
                <p className={`${errorTextClass} mt-1`}>
                  <AlertCircle className="w-3 h-3" />
                  {errors.institution}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Degree level</label>
                <select
                  data-testid={`education-level-${idx}`}
                  value={entry.degreeLevel}
                  onChange={(e) => update(entry.id, { degreeLevel: e.target.value as DegreeLevel })}
                  className={selectClass}
                >
                  {DEGREE_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Degree label</label>
                <input
                  type="text"
                  data-testid={`education-degree-${idx}`}
                  value={entry.degree || ''}
                  placeholder="B.S."
                  onChange={(e) => update(entry.id, { degree: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Field of study</label>
              <input
                type="text"
                data-testid={`education-field-${idx}`}
                value={entry.fieldOfStudy || ''}
                placeholder="Computer Science"
                onChange={(e) => update(entry.id, { fieldOfStudy: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Education status">
                {(
                  [
                    { value: 'in_progress', label: 'Still studying' },
                    { value: 'graduated', label: 'Graduated' },
                  ] as { value: EducationStatus; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={entry.status === opt.value}
                    data-testid={`education-status-${opt.value}-${idx}`}
                    onClick={() => update(entry.id, { status: opt.value })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                      entry.status === opt.value
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                        : 'bg-surface-950 border-surface-800 text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>
                  {entry.status === 'in_progress' ? 'Expected class' : 'Class of'}
                  <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1950}
                  max={2100}
                  data-testid={`education-year-${idx}`}
                  value={entry.graduationYear ?? ''}
                  placeholder="2027"
                  aria-invalid={!!errors.graduationYear || undefined}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? undefined : parseInt(raw, 10);
                    update(entry.id, {
                      graduationYear: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
                    });
                  }}
                  className={`${inputClass} ${errors.graduationYear ? inputErrorClass : ''}`}
                />
              </div>
              <div>
                <label className={labelClass}>Month</label>
                <select
                  data-testid={`education-month-${idx}`}
                  value={entry.graduationMonth ?? ''}
                  onChange={(e) =>
                    update(entry.id, {
                      graduationMonth: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                    })
                  }
                  className={selectClass}
                >
                  <option value="">—</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>GPA</label>
                <input
                  type="text"
                  data-testid={`education-gpa-${idx}`}
                  value={entry.gpa || ''}
                  placeholder="3.8"
                  onChange={(e) => update(entry.id, { gpa: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            {errors.graduationYear && (
              <p className={errorTextClass} data-testid={`education-year-error-${idx}`}>
                <AlertCircle className="w-3 h-3" />
                {errors.graduationYear}
              </p>
            )}
          </div>
        );
      })}

      <button type="button" data-testid="education-add" onClick={add} className={secondaryButtonClass}>
        <Plus className="w-3.5 h-3.5" />
        Add education
      </button>
    </div>
  );
};
