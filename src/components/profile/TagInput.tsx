import React, { useState } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { inputClass, labelClass } from './fieldStyles';

interface TagInputProps {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Suggested tags rendered as clickable pills below the input. */
  suggestions?: string[];
  placeholder?: string;
  testId?: string;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Controlled free-text tag list. Enter or comma commits the current text;
 * clicking a suggestion adds it. Duplicates (case-insensitive) are ignored.
 */
export const TagInput: React.FC<TagInputProps> = ({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Type and press Enter',
  testId = 'tag-input',
}) => {
  const [text, setText] = useState('');

  const existing = new Set(value.map(normalizeTag));

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, '').trim();
    if (!tag || existing.has(normalizeTag(tag))) {
      setText('');
      return;
    }
    onChange([...value, tag]);
    setText('');
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const visibleSuggestions = suggestions.filter((s) => !existing.has(normalizeTag(s)));

  return (
    <div className="space-y-1.5">
      {label && <label className={labelClass}>{label}</label>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid={`${testId}-tags`}>
          {value.map((tag) => (
            <span
              key={tag}
              data-testid={`${testId}-tag-${tag}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => remove(tag)}
                className="text-brand-400/70 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          data-testid={testId}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (text.trim()) add(text);
          }}
          className={inputClass}
        />
        <button
          type="button"
          aria-label="Add tag"
          data-testid={`${testId}-add`}
          onClick={() => add(text)}
          className="p-1.5 rounded-lg border border-surface-800 text-surface-400 hover:text-white hover:border-surface-700"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {visibleSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`${testId}-suggestion-${s}`}
              onClick={() => add(s)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-surface-800 bg-surface-950 text-surface-400 hover:text-brand-300 hover:border-brand-500/40 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
