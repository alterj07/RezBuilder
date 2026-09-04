import { isKeywordPresent } from '../scoring/keywordMatcher';
import { bestTitleSimilarity } from './profileSignals';
import { mapDrivesToThemes, themeLabel } from './themes';
import { FactorContext, FactorOutcome, clamp, weightedAverage } from './common';

/**
 * Theme overlap between the user's drives/summary and the posting (50%),
 * target roles vs the title (35%) and target industries vs company/text (15%).
 */
export function scoreStory(ctx: FactorContext): FactorOutcome {
  const { job, profile, reqs } = ctx;
  const story = profile.story;
  const drives = story?.drives || [];
  const summary = story?.summary || '';
  const targetRoles = story?.targetRoles || [];
  const targetIndustries = story?.targetIndustries || [];
  const userHasStory = drives.length > 0 || summary.trim().length > 0 || targetRoles.length > 0 || targetIndustries.length > 0;
  const jobThemes = reqs.themes;
  if (!userHasStory && jobThemes.length === 0) return { score: 0, applicable: false, evidence: [], gaps: [] };

  const evidence: string[] = [];
  const gaps: string[] = [];

  // 1. Themes (overlap coefficient: |A ∩ B| / min(|A|, |B|))
  let themeScore: number | undefined;
  const userThemes = mapDrivesToThemes(drives, summary);
  if (jobThemes.length > 0) {
    if (userThemes.length === 0) {
      themeScore = 30;
      gaps.push('Fill in your drives so culture fit can be scored');
    } else {
      const shared = userThemes.filter((t) => jobThemes.includes(t));
      themeScore = Math.round((100 * shared.length) / Math.min(userThemes.length, jobThemes.length));
      if (shared.length > 0) evidence.push(`Shared values: ${shared.slice(0, 3).map(themeLabel).join(', ')}`);
      else gaps.push(`The posting emphasises ${jobThemes.slice(0, 2).map(themeLabel).join(' and ')}, which is not among your drives`);
    }
  }

  // 2. Target roles vs title
  let roleScore: number | undefined;
  if (targetRoles.length > 0) {
    const best = bestTitleSimilarity(job.title || '', targetRoles);
    roleScore = clamp(Math.round(best.score * 100));
    if (best.score >= 0.67 && best.title) evidence.push(`"${job.title}" matches your target role "${best.title}"`);
    else if (best.score < 0.34) gaps.push(`"${job.title}" is outside your target roles`);
  } else if (userHasStory || jobThemes.length > 0) {
    gaps.push('Add target roles to your story');
  }

  // 3. Target industries
  let industryScore: number | undefined;
  if (targetIndustries.length > 0) {
    const jobText = `${job.company || ''}. ${job.title || ''}. ${job.description || ''}`;
    const hit = targetIndustries.find((ind) => ind.trim() && isKeywordPresent(ind.trim(), jobText));
    if (hit) {
      industryScore = 100;
      evidence.push(`Posting mentions your target industry "${hit}"`);
    } else {
      industryScore = 30;
    }
  }

  const score = clamp(
    Math.round(
      weightedAverage(
        [
          { score: themeScore ?? 0, weight: themeScore === undefined ? 0 : 50 },
          { score: roleScore ?? 0, weight: roleScore === undefined ? 0 : 35 },
          { score: industryScore ?? 0, weight: industryScore === undefined ? 0 : 15 },
        ],
        50,
      ),
    ),
  );
  return { score, applicable: true, evidence, gaps };
}
