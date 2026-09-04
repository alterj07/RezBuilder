import React from 'react';
import { FitSkillMatch } from '../../types/fit';

interface SkillMatchChipProps {
  match: FitSkillMatch;
}

const RATING_LABEL: Record<number, string> = {
  1: 'familiar',
  2: 'basic',
  3: 'comfortable',
  4: 'strong',
  5: 'expert',
};

/**
 * A matched skill from Best Fit: the name plus the user's 1-5 self-rating
 * rendered as five small dots. Required skills get a stronger border.
 */
export const SkillMatchChip: React.FC<SkillMatchChipProps> = ({ match }) => {
  const rating = Math.max(0, Math.min(5, Number(match?.rating) || 0));
  const name = match?.name || '';
  const label = RATING_LABEL[rating] || 'unrated';

  return (
    <span
      data-testid={`fit-matched-skill-${name}`}
      title={`${name}: ${rating}/5 (${label})${match?.required ? ' - required by the posting' : ''}`}
      className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-200 border ${
        match?.required ? 'border-emerald-500/50' : 'border-emerald-800/40'
      }`}
    >
      <span className="truncate max-w-[110px]">{name}</span>
      <span className="flex items-center gap-[2px]" aria-label={`${rating} of 5`}>
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className={`w-1 h-1 rounded-full ${dot <= rating ? 'bg-emerald-400' : 'bg-emerald-900'}`}
          />
        ))}
      </span>
    </span>
  );
};
