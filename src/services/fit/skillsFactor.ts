import { FitSkillMatch } from '../../types/fit';
import { SkillRating } from '../../types/profile';
import { isKeywordPresent } from '../scoring/keywordMatcher';
import { canonicalSkill, displaySkill } from './skillNames';
import { FactorContext, FactorOutcome, clamp } from './common';

export interface SkillsFactorResult extends FactorOutcome {
  matchedSkills: FitSkillMatch[];
  missingSkills: string[];
}

const REQUIRED_WEIGHT = 2;
const NICE_WEIGHT = 1;
/** Rating credited to a skill that is unrated but appears in the user's experience. */
const EXPERIENCE_DERIVED_RATING: SkillRating = 3;

interface RatingHit {
  rating: SkillRating;
  source: 'rated' | 'experience';
}

/**
 * Rating-weighted coverage of the posting's skills.
 * credit(skill) = rating / 5 when matched, 0 when missing;
 * score = 100 * sum(weight * credit) / sum(weight) with required = 2x nice-to-have.
 */
export function scoreSkills(ctx: FactorContext): SkillsFactorResult {
  const { profile, reqs } = ctx;
  const required = reqs.requiredSkills;
  const nice = reqs.niceToHaveSkills;
  if (required.length + nice.length === 0) {
    return { score: 0, applicable: false, evidence: [], gaps: [], matchedSkills: [], missingSkills: [] };
  }

  const rated = new Map<string, SkillRating>();
  for (const s of profile.skills || []) {
    const key = canonicalSkill(s.name);
    const prev = rated.get(key);
    if (prev === undefined || s.rating > prev) rated.set(key, s.rating);
  }
  const ratedNames = (profile.skills || []).map((s) => s.name).join(' | ');
  const experienceText = (profile.experiences || [])
    .map((e) => [e.title, ...(e.bullets || []), ...(e.skillsUsed || [])].join('. '))
    .join('\n');

  const lookup = (skill: string): RatingHit | undefined => {
    const direct = rated.get(skill);
    if (direct !== undefined) return { rating: direct, source: 'rated' };
    if (ratedNames && isKeywordPresent(skill, ratedNames)) {
      for (const s of profile.skills) {
        const key = canonicalSkill(s.name);
        if (isKeywordPresent(skill, s.name) || isKeywordPresent(key, skill)) {
          return { rating: s.rating, source: 'rated' };
        }
      }
    }
    if (experienceText && isKeywordPresent(skill, experienceText)) {
      return { rating: EXPERIENCE_DERIVED_RATING, source: 'experience' };
    }
    return undefined;
  };

  let weightedCredit = 0;
  let totalWeight = 0;
  const matchedSkills: FitSkillMatch[] = [];
  const missingRequired: string[] = [];
  const missingNice: string[] = [];
  const lowRated: { name: string; rating: SkillRating }[] = [];
  const evidenceHits: { text: string; rank: number }[] = [];

  const consider = (skill: string, isRequired: boolean) => {
    const weight = isRequired ? REQUIRED_WEIGHT : NICE_WEIGHT;
    totalWeight += weight;
    const hit = lookup(skill);
    const label = displaySkill(skill);
    if (!hit) {
      (isRequired ? missingRequired : missingNice).push(label);
      return;
    }
    weightedCredit += weight * (hit.rating / 5);
    matchedSkills.push({ name: label, rating: hit.rating, required: isRequired });
    const tag = isRequired ? 'required' : 'nice to have';
    if (hit.source === 'experience') {
      evidenceHits.push({ text: `${label} — used in your experience (${tag})`, rank: hit.rating * weight });
    } else {
      evidenceHits.push({ text: `${label} — rated ${hit.rating}/5 (${tag})`, rank: hit.rating * weight + 0.5 });
      if (isRequired && hit.rating <= 2) lowRated.push({ name: label, rating: hit.rating });
    }
  };

  for (const s of required) consider(s, true);
  for (const s of nice) consider(s, false);

  const score = clamp(Math.round((100 * weightedCredit) / totalWeight));
  const evidence = evidenceHits
    .sort((a, b) => b.rank - a.rank || a.text.localeCompare(b.text))
    .slice(0, 5)
    .map((e) => e.text);
  const gaps: string[] = [];
  for (const name of missingRequired.slice(0, 4)) gaps.push(`Add or rate: ${name} (required)`);
  for (const lr of lowRated.slice(0, 2)) gaps.push(`Raise your ${lr.name} rating (currently ${lr.rating}/5, required)`);
  for (const name of missingNice.slice(0, 2)) gaps.push(`Nice to have: ${name} — not in your profile`);
  if (matchedSkills.length === 0 && (profile.skills || []).length === 0) gaps.unshift('Add and rate your skills');

  return {
    score,
    applicable: true,
    evidence,
    gaps: gaps.slice(0, 6),
    matchedSkills,
    missingSkills: [...missingRequired, ...missingNice],
  };
}
