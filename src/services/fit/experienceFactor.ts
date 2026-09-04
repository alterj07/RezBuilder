import { isKeywordPresent } from '../scoring/keywordMatcher';
import { RoleLevel } from './jobRequirements';
import { bestTitleSimilarity } from './profileSignals';
import { displaySkill } from './skillNames';
import { FactorContext, FactorOutcome, clamp, weightedAverage } from './common';

const LEVEL_INDEX: Record<RoleLevel, number | undefined> = {
  internship: 0,
  new_grad: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  unknown: undefined,
};

const EXPECTED_YEARS: Record<RoleLevel, number | undefined> = {
  internship: 0,
  new_grad: 0,
  junior: 1,
  mid: 3,
  senior: 5,
  lead: 8,
  unknown: undefined,
};

const LEVEL_LABEL: Record<RoleLevel, string> = {
  internship: 'internship',
  new_grad: 'new-grad',
  junior: 'junior',
  mid: 'mid-level',
  senior: 'senior',
  lead: 'lead/staff',
  unknown: 'unspecified-level',
};

export function userLevelIndex(years: number): number {
  if (years < 0.75) return 0;
  if (years < 2) return 1;
  if (years < 5) return 2;
  if (years < 9) return 3;
  return 4;
}

/**
 * Title similarity (30%), years vs required (30%), role-level fit (20%) and
 * required-skill evidence inside experience bullets (20%).
 */
export function scoreExperience(ctx: FactorContext): FactorOutcome {
  const { job, profile, reqs, profileYears } = ctx;
  const evidence: string[] = [];
  const gaps: string[] = [];
  const years = profileYears;

  // 1. Title similarity
  const titles = [...(profile.experiences || []).map((e) => e.title), ...(profile.story?.targetRoles || [])].filter(Boolean);
  const best = bestTitleSimilarity(job.title || '', titles);
  const titleScore = clamp(Math.round(best.score * 100));
  if (best.title && best.score >= 0.67) evidence.push(`Your "${best.title}" background lines up with "${job.title}"`);
  else if (titles.length === 0) gaps.push('Add your experiences or target roles so title fit can be scored');
  else if (best.score < 0.34) gaps.push(`None of your titles resemble "${job.title}"`);

  // 2. Years
  let yearsScore: number;
  const rounded = Math.round(years * 10) / 10;
  if (reqs.requiredYears !== undefined) {
    if (reqs.requiredYears === 0) yearsScore = 100;
    else yearsScore = clamp(Math.round((100 * years) / reqs.requiredYears));
    if (years >= reqs.requiredYears) evidence.push(`~${rounded} years of experience (posting asks for ${reqs.requiredYears}+)`);
    else gaps.push(`Posting asks for ${reqs.requiredYears}+ years; your profile shows ~${rounded}`);
  } else {
    const expected = EXPECTED_YEARS[reqs.roleLevel];
    if (expected === undefined) yearsScore = 70;
    else if (expected === 0) yearsScore = 100;
    else {
      yearsScore = clamp(Math.round((100 * years) / expected));
      if (years < expected) gaps.push(`A ${LEVEL_LABEL[reqs.roleLevel]} role usually expects ~${expected}+ years; your profile shows ~${rounded}`);
    }
    if (years > 0 && yearsScore >= 100 && expected !== undefined && expected > 0) evidence.push(`~${rounded} years of experience suits a ${LEVEL_LABEL[reqs.roleLevel]} role`);
  }

  // 3. Level fit
  let levelScore = 80;
  const roleIdx = LEVEL_INDEX[reqs.roleLevel];
  if (roleIdx !== undefined) {
    const userIdx = userLevelIndex(years);
    const diff = userIdx - roleIdx;
    if (diff === 0) {
      levelScore = 100;
      evidence.push(`Your experience level matches this ${LEVEL_LABEL[reqs.roleLevel]} posting`);
    } else if (diff < 0) {
      levelScore = clamp(100 - 35 * -diff);
      if (-diff >= 2) gaps.push(`This is a ${LEVEL_LABEL[reqs.roleLevel]} posting; your profile reads as ${-diff} levels more junior`);
    } else {
      levelScore = clamp(100 - 15 * diff);
      if (diff >= 2) gaps.push(`You may be over-qualified for this ${LEVEL_LABEL[reqs.roleLevel]} posting`);
    }
  }

  // 4. Required-skill evidence in experience bullets
  const experienceText = (profile.experiences || [])
    .map((e) => [e.title, ...(e.bullets || []), ...(e.skillsUsed || [])].join('. '))
    .join('\n');
  let skillEvidenceScore: number | undefined;
  if (reqs.requiredSkills.length > 0) {
    let hits = 0;
    const missing: string[] = [];
    for (const skill of reqs.requiredSkills) {
      if (experienceText && isKeywordPresent(skill, experienceText)) hits++;
      else missing.push(skill);
    }
    skillEvidenceScore = Math.round((100 * hits) / reqs.requiredSkills.length);
    if (hits > 0 && hits >= reqs.requiredSkills.length / 2) {
      evidence.push(`Your experience bullets show ${hits} of ${reqs.requiredSkills.length} required skills in action`);
    }
    if (missing.length > 0) {
      const first = missing.slice(0, 2).map(displaySkill).join(', ');
      gaps.push(`List a project or experience using ${first}`);
    }
  }

  const score = clamp(
    Math.round(
      weightedAverage([
        { score: titleScore, weight: 30 },
        { score: yearsScore, weight: 30 },
        { score: levelScore, weight: 20 },
        { score: skillEvidenceScore ?? 0, weight: skillEvidenceScore === undefined ? 0 : 20 },
      ]),
    ),
  );

  return { score, applicable: true, evidence, gaps };
}
