import React from 'react';
import { SkillRating as SkillRatingValue } from '../../types/profile';

interface SkillRatingProps {
  /** Skill name, used in the accessible labels. */
  skill: string;
  value: SkillRatingValue;
  onChange: (rating: SkillRatingValue) => void;
  disabled?: boolean;
}

const RATINGS: SkillRatingValue[] = [1, 2, 3, 4, 5];

export const RATING_LABELS: Record<SkillRatingValue, string> = {
  1: 'Familiar',
  2: 'Basic',
  3: 'Comfortable',
  4: 'Proficient',
  5: 'Expert',
};

/**
 * Five small clickable dots. Fully keyboard accessible: each dot is a button
 * with `aria-label="Rate {skill} {n} of 5"`; arrow keys move between them.
 */
export const SkillRating: React.FC<SkillRatingProps> = ({ skill, value, onChange, disabled }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, rating: SkillRatingValue) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, rating + 1) as SkillRatingValue);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, rating - 1) as SkillRatingValue);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={`${skill} rating`}
      title={`${RATING_LABELS[value]} (${value}/5)`}
      className="flex items-center gap-0.5"
      data-testid={`skill-rating-${skill}`}
      data-rating={value}
    >
      {RATINGS.map((rating) => {
        const filled = rating <= value;
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`Rate ${skill} ${rating} of 5`}
            disabled={disabled}
            onClick={() => onChange(rating)}
            onKeyDown={(e) => handleKeyDown(e, rating)}
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-default ${
              disabled ? '' : 'hover:scale-110 transition-transform'
            }`}
          >
            <span
              className={`block w-2 h-2 rounded-full transition-colors ${
                filled ? 'bg-brand-400' : 'bg-surface-700'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};
