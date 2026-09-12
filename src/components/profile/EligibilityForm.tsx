import React from 'react';
import {
  ClearanceLevel,
  ClearanceStatus,
  DisabilityStatus,
  PolygraphType,
  ProfileEligibility,
  VeteranStatus,
  VisaType,
  WorkAuthorization,
} from '../../types/profile';
import { TagInput } from './TagInput';
import { labelClass, selectClass, hintTextClass } from './fieldStyles';

interface EligibilityFormProps {
  eligibility: ProfileEligibility;
  onChange: (eligibility: ProfileEligibility) => void;
}

const UNSET = '';

export const WORK_AUTHORIZATION_OPTIONS: { value: WorkAuthorization; label: string }[] = [
  { value: 'us_citizen', label: 'U.S. citizen' },
  { value: 'us_permanent_resident', label: 'U.S. permanent resident (green card)' },
  { value: 'us_work_visa', label: 'On a work visa (H-1B, L-1, TN, O-1…)' },
  { value: 'us_student_visa', label: 'On a student visa (F-1 OPT / CPT, J-1)' },
  { value: 'us_other_authorized', label: 'Authorized another way (EAD, asylee, refugee…)' },
  { value: 'needs_sponsorship', label: 'Not yet authorized — needs sponsorship' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const VISA_OPTIONS: { value: VisaType; label: string }[] = [
  { value: 'h1b', label: 'H-1B' },
  { value: 'h4_ead', label: 'H-4 EAD' },
  { value: 'f1_opt', label: 'F-1 OPT' },
  { value: 'f1_stem_opt', label: 'F-1 STEM OPT' },
  { value: 'f1_cpt', label: 'F-1 CPT' },
  { value: 'j1', label: 'J-1' },
  { value: 'l1', label: 'L-1' },
  { value: 'tn', label: 'TN' },
  { value: 'e3', label: 'E-3' },
  { value: 'o1', label: 'O-1' },
  { value: 'ead', label: 'EAD' },
  { value: 'other', label: 'Other' },
];

export const CLEARANCE_LEVEL_OPTIONS: { value: ClearanceLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'public_trust', label: 'Public Trust' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'secret', label: 'Secret' },
  { value: 'top_secret', label: 'Top Secret' },
  { value: 'ts_sci', label: 'TS/SCI' },
];

export const CLEARANCE_STATUS_OPTIONS: { value: ClearanceStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive / expired' },
  { value: 'eligible', label: 'Eligible to obtain' },
];

export const POLYGRAPH_OPTIONS: { value: PolygraphType; label: string }[] = [
  { value: 'none', label: 'No polygraph' },
  { value: 'ci', label: 'CI polygraph' },
  { value: 'full_scope', label: 'Full-scope polygraph' },
];

export const VETERAN_OPTIONS: { value: VeteranStatus; label: string }[] = [
  { value: 'not_a_veteran', label: 'Not a veteran' },
  { value: 'veteran', label: 'Veteran' },
  { value: 'protected_veteran', label: 'Protected veteran (VEVRAA)' },
  { value: 'active_duty', label: 'Active duty' },
  { value: 'reserve_or_guard', label: 'Reserve or National Guard' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const DISABILITY_OPTIONS: { value: DisabilityStatus; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** A `<select>` whose empty option means "not answered" rather than a value. */
function OptionalSelect<T extends string>({
  id,
  label,
  value,
  options,
  placeholder,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  placeholder: string;
  hint?: string;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        data-testid={id}
        className={selectClass}
        value={value ?? UNSET}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      >
        <option value={UNSET}>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className={hintTextClass}>{hint}</p>}
    </div>
  );
}

type TriState = 'yes' | 'no' | 'unset';

function toTriState(value: boolean | undefined): TriState {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unset';
}

function fromTriState(value: TriState): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

/** Three-way Yes / No / unanswered control, used for the two sponsorship questions. */
const TriStateControl: React.FC<{
  label: string;
  hint?: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  testId: string;
}> = ({ label, hint, value, onChange, testId }) => {
  const current = toTriState(value);
  const options: { value: TriState; label: string }[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'unset', label: 'Prefer not to say' },
  ];
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={current === opt.value}
            data-testid={`${testId}-${opt.value}`}
            onClick={() => onChange(fromTriState(opt.value))}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-all ${
              current === opt.value
                ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                : 'bg-surface-950 border-surface-800 text-surface-400 hover:text-surface-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint && <p className={hintTextClass}>{hint}</p>}
    </div>
  );
};

const VISA_AUTHORIZATIONS: WorkAuthorization[] = ['us_work_visa', 'us_student_visa', 'us_other_authorized'];

/**
 * The eligibility questions application forms ask but resumes never carry:
 * work authorization, security clearance, veteran and disability status.
 *
 * Every control is optional and every list ends in "Prefer not to say".
 * Unanswered means *unknown* to the scoring engines, never "no", so skipping
 * this whole step costs the user nothing.
 */
export const EligibilityForm: React.FC<EligibilityFormProps> = ({ eligibility, onChange }) => {
  const patch = (partial: Partial<ProfileEligibility>) => onChange({ ...eligibility, ...partial });
  const clearance = eligibility.clearance;
  const showVisa = eligibility.workAuthorization !== undefined && VISA_AUTHORIZATIONS.includes(eligibility.workAuthorization);
  const showClearanceDetail = clearance !== undefined && clearance.level !== 'none';

  const setClearanceLevel = (level: ClearanceLevel | undefined) => {
    if (!level || level === 'none') {
      patch({ clearance: undefined });
      return;
    }
    patch({ clearance: { level, status: clearance?.status ?? 'active', ...(clearance?.polygraph ? { polygraph: clearance.polygraph } : {}) } });
  };

  return (
    <div className="space-y-4">
      <p className={hintTextClass}>
        Answers here stay on this device and are never sent anywhere. They are used to flag postings you would be screened
        out of — and to give you credit for a clearance or veteran status a posting asks for.
      </p>

      <OptionalSelect
        id="eligibility-authorization"
        label="Work authorization"
        value={eligibility.workAuthorization}
        options={WORK_AUTHORIZATION_OPTIONS}
        placeholder="Not answered"
        onChange={(workAuthorization) => patch({ workAuthorization })}
      />

      {showVisa && (
        <OptionalSelect
          id="eligibility-visa"
          label="Visa type"
          value={eligibility.visaType}
          options={VISA_OPTIONS}
          placeholder="Not answered"
          onChange={(visaType) => patch({ visaType })}
        />
      )}

      <TriStateControl
        label="Do you now require visa sponsorship?"
        value={eligibility.requiresSponsorshipNow}
        onChange={(requiresSponsorshipNow) => patch({ requiresSponsorshipNow })}
        testId="eligibility-sponsorship-now"
      />

      <TriStateControl
        label="Will you require sponsorship in the future?"
        hint="Leave both unanswered to have them inferred from your work authorization — an F-1 on OPT needs sponsorship later, a citizen never does."
        value={eligibility.requiresSponsorshipFuture}
        onChange={(requiresSponsorshipFuture) => patch({ requiresSponsorshipFuture })}
        testId="eligibility-sponsorship-future"
      />

      <TagInput
        label="Citizenships"
        value={eligibility.citizenships || []}
        onChange={(citizenships) => patch({ citizenships })}
        placeholder="United States, Canada…"
        testId="eligibility-citizenships"
      />

      <OptionalSelect
        id="eligibility-clearance-level"
        label="Security clearance"
        value={clearance?.level}
        options={CLEARANCE_LEVEL_OPTIONS}
        placeholder="Not answered"
        hint="Defense and government postings screen on this before anything else."
        onChange={setClearanceLevel}
      />

      {showClearanceDetail && (
        <div className="grid grid-cols-2 gap-2">
          <OptionalSelect
            id="eligibility-clearance-status"
            label="Clearance status"
            value={clearance.status}
            options={CLEARANCE_STATUS_OPTIONS}
            placeholder="Active"
            onChange={(status) => patch({ clearance: { ...clearance, status: status ?? 'active' } })}
          />
          <OptionalSelect
            id="eligibility-clearance-polygraph"
            label="Polygraph"
            value={clearance.polygraph}
            options={POLYGRAPH_OPTIONS}
            placeholder="Not answered"
            onChange={(polygraph) => patch({ clearance: { ...clearance, polygraph } })}
          />
        </div>
      )}

      <OptionalSelect
        id="eligibility-veteran"
        label="Veteran status"
        value={eligibility.veteranStatus}
        options={VETERAN_OPTIONS}
        placeholder="Not answered"
        onChange={(veteranStatus) => patch({ veteranStatus })}
      />

      <OptionalSelect
        id="eligibility-disability"
        label="Do you have a disability?"
        value={eligibility.disabilityStatus}
        options={DISABILITY_OPTIONS}
        placeholder="Not answered"
        hint="Voluntary self-identification. It can only ever help your score, never lower it."
        onChange={(disabilityStatus) => patch({ disabilityStatus })}
      />
    </div>
  );
};
