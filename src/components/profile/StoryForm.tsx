import React from 'react';
import { EmploymentPreference, ProfileStory, RemotePreference } from '../../types/profile';
import { TagInput } from './TagInput';
import { textareaClass, labelClass, hintTextClass } from './fieldStyles';

interface StoryFormProps {
  story: ProfileStory;
  onChange: (story: ProfileStory) => void;
}

export const DRIVE_SUGGESTIONS = [
  'impact',
  'mission',
  'growth',
  'mentorship',
  'ownership',
  'fast-paced startup',
  'stability',
  'research',
  'collaboration',
  'customer focus',
  'craftsmanship',
  'scale',
  'open source',
  'remote-first',
  'leadership',
  'inclusion',
];

const REMOTE_OPTIONS: { value: RemotePreference; label: string }[] = [
  { value: 'any', label: 'No preference' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const EMPLOYMENT_OPTIONS: { value: EmploymentPreference; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
];

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

const TriStateControl: React.FC<{
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  testId: string;
}> = ({ label, value, onChange, testId }) => {
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
    </div>
  );
};

export const StoryForm: React.FC<StoryFormProps> = ({ story, onChange }) => {
  const patch = (partial: Partial<ProfileStory>) => onChange({ ...story, ...partial });

  const toggleEmployment = (type: EmploymentPreference) => {
    const set = new Set(story.employmentTypes);
    if (set.has(type)) set.delete(type);
    else set.add(type);
    patch({ employmentTypes: EMPLOYMENT_OPTIONS.map((o) => o.value).filter((v) => set.has(v)) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="profile-story-summary">
          Summary
        </label>
        <textarea
          id="profile-story-summary"
          data-testid="story-summary"
          value={story.summary}
          placeholder="Two or three sentences about who you are, what you build and what you want next."
          onChange={(e) => patch({ summary: e.target.value })}
          className={textareaClass}
        />
        <p className={hintTextClass}>Used to explain fit and seed tailored summaries. Your words, no AI required.</p>
      </div>

      <TagInput
        label="What drives you"
        value={story.drives}
        onChange={(drives) => patch({ drives })}
        suggestions={DRIVE_SUGGESTIONS}
        placeholder="impact, mentorship…"
        testId="story-drives"
      />

      <TagInput
        label="Target roles"
        value={story.targetRoles}
        onChange={(targetRoles) => patch({ targetRoles })}
        placeholder="Software Engineer Intern"
        testId="story-roles"
      />

      <TagInput
        label="Target industries"
        value={story.targetIndustries}
        onChange={(targetIndustries) => patch({ targetIndustries })}
        placeholder="fintech, developer tools…"
        testId="story-industries"
      />

      <div>
        <label className={labelClass}>Remote preference</label>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Remote preference">
          {REMOTE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`py-1.5 px-1 rounded-lg text-[11px] text-center font-medium border cursor-pointer transition-all ${
                story.remotePreference === opt.value
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                  : 'bg-surface-950 border-surface-800 text-surface-400 hover:text-surface-200'
              }`}
            >
              <input
                type="radio"
                name="profile-remote-preference"
                value={opt.value}
                data-testid={`story-remote-${opt.value}`}
                checked={story.remotePreference === opt.value}
                onChange={() => patch({ remotePreference: opt.value })}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <TagInput
        label="Preferred locations"
        value={story.preferredLocations}
        onChange={(preferredLocations) => patch({ preferredLocations })}
        placeholder="Austin, TX"
        testId="story-locations"
      />

      <div>
        <label className={labelClass}>Employment types</label>
        <div className="grid grid-cols-2 gap-1.5">
          {EMPLOYMENT_OPTIONS.map((opt) => {
            const checked = story.employmentTypes.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-[11px] border cursor-pointer transition-all ${
                  checked
                    ? 'bg-brand-500/10 border-brand-500/40 text-brand-200'
                    : 'bg-surface-950 border-surface-800 text-surface-400 hover:text-surface-200'
                }`}
              >
                <input
                  type="checkbox"
                  data-testid={`story-employment-${opt.value}`}
                  checked={checked}
                  onChange={() => toggleEmployment(opt.value)}
                  className="accent-brand-500"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      <TriStateControl
        label="Authorized to work in your target country?"
        value={story.authorizedToWork}
        onChange={(authorizedToWork) => patch({ authorizedToWork })}
        testId="story-authorized"
      />
      <TriStateControl
        label="Will you need visa sponsorship?"
        value={story.needsSponsorship}
        onChange={(needsSponsorship) => patch({ needsSponsorship })}
        testId="story-sponsorship"
      />
    </div>
  );
};
