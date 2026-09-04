import React, { useMemo, useState } from 'react';
import { Plus, X, Info } from 'lucide-react';
import { ProfileSkill, SkillRating as SkillRatingValue } from '../../types/profile';
import { SKILL_DICTIONARY } from '../../content/scrapers/keywordExtractor';
import { createProfileEntityId, PROFILE_MIN_SKILLS } from '../../services/profile';
import { SkillRating } from './SkillRating';
import { inputClass, hintTextClass } from './fieldStyles';

interface SkillPickerProps {
  skills: ProfileSkill[];
  onChange: (skills: ProfileSkill[]) => void;
  /** Rating given to newly added skills. Default 3. */
  defaultRating?: SkillRatingValue;
  /** Show the minimum-skills hint (wizard). */
  showMinimumHint?: boolean;
}

const MAX_SUGGESTIONS = 8;

/** Display-cases a dictionary entry: "node.js" -> "Node.js", "aws" -> "AWS". */
function displayName(raw: string): string {
  if (raw.length <= 3 && !raw.includes('.')) return raw.toUpperCase();
  return raw
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

const DICTIONARY_DISPLAY = Array.from(new Set(SKILL_DICTIONARY.map(displayName)));

export function sortSkillsByRating(skills: ProfileSkill[]): ProfileSkill[] {
  return [...skills].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

/**
 * Skill chips with 1-5 rating dots plus an input that autocompletes from the
 * shared skill dictionary (free text allowed). Chips are sorted by rating desc.
 */
export const SkillPicker: React.FC<SkillPickerProps> = ({
  skills,
  onChange,
  defaultRating = 3,
  showMinimumHint = false,
}) => {
  const [text, setText] = useState('');
  const [highlight, setHighlight] = useState(0);

  const existing = useMemo(() => new Set(skills.map((s) => s.name.trim().toLowerCase())), [skills]);

  const suggestions = useMemo(() => {
    const query = text.trim().toLowerCase();
    if (!query) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const name of DICTIONARY_DISPLAY) {
      const lower = name.toLowerCase();
      if (existing.has(lower)) continue;
      if (lower.startsWith(query)) starts.push(name);
      else if (lower.includes(query)) contains.push(name);
      if (starts.length >= MAX_SUGGESTIONS) break;
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [text, existing]);

  const addSkill = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (existing.has(name.toLowerCase())) {
      setText('');
      return;
    }
    onChange([...skills, { id: createProfileEntityId('skill'), name, rating: defaultRating }]);
    setText('');
    setHighlight(0);
  };

  const removeSkill = (id: string) => onChange(skills.filter((s) => s.id !== id));

  const rateSkill = (id: string, rating: SkillRatingValue) =>
    onChange(skills.map((s) => (s.id === id ? { ...s, rating } : s)));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[highlight];
      // Enter commits the typed text unless a suggestion is an exact prefix match the user moved to.
      addSkill(highlight > 0 && pick ? pick : text);
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Escape') {
      setText('');
    }
  };

  const sorted = sortSkillsByRating(skills);

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={text}
            data-testid="skill-input"
            placeholder="Add a skill, e.g. TypeScript"
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
            className={inputClass}
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
          />
          <button
            type="button"
            data-testid="skill-add"
            aria-label="Add skill"
            onClick={() => addSkill(text)}
            disabled={!text.trim()}
            className="p-1.5 rounded-lg border border-surface-800 text-surface-400 hover:text-white hover:border-surface-700 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            data-testid="skill-suggestions"
            className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-surface-800 bg-surface-900 shadow-xl"
          >
            {suggestions.map((name, idx) => (
              <li key={name} role="option" aria-selected={idx === highlight}>
                <button
                  type="button"
                  data-testid={`skill-suggestion-${name}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addSkill(name)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs ${
                    idx === highlight ? 'bg-brand-500/15 text-brand-200' : 'text-surface-300 hover:bg-surface-800'
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className={`${hintTextClass} flex items-start gap-1`}>
        <Info className="w-3 h-3 mt-0.5 shrink-0 text-surface-500" />
        <span>5 = expert, 1 = familiar; higher-rated skills are emphasized in tailoring and fit.</span>
      </p>

      {sorted.length === 0 ? (
        <div className="p-3 rounded-lg border border-dashed border-surface-800 text-center text-[11px] text-surface-500">
          No skills yet. Start typing above to add one.
        </div>
      ) : (
        <ul className="space-y-1" data-testid="skill-list">
          {sorted.map((skill) => (
            <li
              key={skill.id}
              data-testid={`skill-chip-${skill.name}`}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface-900/70 border border-surface-800"
            >
              <span className="text-xs text-surface-200 truncate" data-testid="skill-name">
                {skill.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <SkillRating skill={skill.name} value={skill.rating} onChange={(r) => rateSkill(skill.id, r)} />
                <button
                  type="button"
                  aria-label={`Remove ${skill.name}`}
                  data-testid={`skill-remove-${skill.name}`}
                  onClick={() => removeSkill(skill.id)}
                  className="text-surface-500 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showMinimumHint && (
        <p className={hintTextClass} data-testid="skill-count-hint">
          {skills.length}/{PROFILE_MIN_SKILLS} minimum
          {skills.length < PROFILE_MIN_SKILLS ? ` — add ${PROFILE_MIN_SKILLS - skills.length} more to continue` : ''}
        </p>
      )}
    </div>
  );
};
