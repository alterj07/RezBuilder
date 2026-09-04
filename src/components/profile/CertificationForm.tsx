import React from 'react';
import { Plus, Trash2, Award } from 'lucide-react';
import { ProfileCertification } from '../../types/profile';
import { createProfileEntityId } from '../../services/profile';
import { inputClass, labelClass, cardClass, secondaryButtonClass } from './fieldStyles';

interface CertificationFormProps {
  entries: ProfileCertification[];
  onChange: (entries: ProfileCertification[]) => void;
}

export function createCertificationEntry(): ProfileCertification {
  return { id: createProfileEntityId('cert'), name: '' };
}

function parseYear(raw: string): number | undefined {
  if (raw === '') return undefined;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const CertificationForm: React.FC<CertificationFormProps> = ({ entries, onChange }) => {
  const update = (id: string, patch: Partial<ProfileCertification>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => onChange([...entries, createCertificationEntry()]);

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <div className="p-3 rounded-lg border border-dashed border-surface-800 text-center text-[11px] text-surface-500">
          No certifications. This step is optional.
        </div>
      )}
      {entries.map((entry, idx) => (
        <div key={entry.id} className={cardClass} data-testid={`certification-entry-${idx}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-surface-300 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Certification {idx + 1}
            </span>
            <button
              type="button"
              aria-label="Remove certification"
              data-testid={`certification-remove-${idx}`}
              onClick={() => remove(entry.id)}
              className="p-1 rounded text-surface-500 hover:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              data-testid={`certification-name-${idx}`}
              value={entry.name}
              placeholder="AWS Certified Solutions Architect – Associate"
              onChange={(e) => update(entry.id, { name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={labelClass}>Issuer</label>
              <input
                type="text"
                data-testid={`certification-issuer-${idx}`}
                value={entry.issuer || ''}
                placeholder="Amazon"
                onChange={(e) => update(entry.id, { issuer: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Year</label>
              <input
                type="number"
                inputMode="numeric"
                data-testid={`certification-year-${idx}`}
                value={entry.issuedYear ?? ''}
                placeholder="2024"
                onChange={(e) => update(entry.id, { issuedYear: parseYear(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Credential URL</label>
            <input
              type="url"
              data-testid={`certification-url-${idx}`}
              value={entry.credentialUrl || ''}
              placeholder="https://…"
              onChange={(e) => update(entry.id, { credentialUrl: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      ))}
      <button type="button" data-testid="certification-add" onClick={add} className={secondaryButtonClass}>
        <Plus className="w-3.5 h-3.5" />
        Add certification
      </button>
    </div>
  );
};
