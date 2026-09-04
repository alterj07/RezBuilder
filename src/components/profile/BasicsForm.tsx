import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ProfileContact } from '../../types/profile';
import { inputClass, inputErrorClass, labelClass, errorTextClass } from './fieldStyles';

interface BasicsFormProps {
  contact: ProfileContact;
  onChange: (contact: ProfileContact) => void;
  /** Show the required-field error even before the user touched the field. */
  showValidation?: boolean;
}

type ContactKey = keyof ProfileContact;

const FIELDS: { key: ContactKey; label: string; placeholder: string; type?: string; required?: boolean }[] = [
  { key: 'name', label: 'Full name', placeholder: 'Alex Rivera', required: true },
  { key: 'email', label: 'Email', placeholder: 'alex@example.com', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 234-5678', type: 'tel' },
  { key: 'location', label: 'Location', placeholder: 'San Francisco, CA' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/you', type: 'url' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/you', type: 'url' },
  { key: 'website', label: 'Website', placeholder: 'https://you.dev', type: 'url' },
];

export const BasicsForm: React.FC<BasicsFormProps> = ({ contact, onChange, showValidation = false }) => {
  const nameMissing = !contact.name || !contact.name.trim();

  return (
    <div className="space-y-2.5">
      {FIELDS.map((field) => {
        const invalid = field.required && nameMissing && showValidation;
        return (
          <div key={field.key}>
            <label className={labelClass} htmlFor={`profile-basics-${field.key}`}>
              {field.label}
              {field.required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>
            <input
              id={`profile-basics-${field.key}`}
              data-testid={`basics-${field.key}`}
              type={field.type || 'text'}
              value={contact[field.key] || ''}
              placeholder={field.placeholder}
              aria-invalid={invalid || undefined}
              onChange={(e) => onChange({ ...contact, [field.key]: e.target.value })}
              className={`${inputClass} ${invalid ? inputErrorClass : ''}`}
            />
            {invalid && (
              <p className={`${errorTextClass} mt-1`} data-testid="basics-name-error">
                <AlertCircle className="w-3 h-3" />
                <span>Add your name</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
