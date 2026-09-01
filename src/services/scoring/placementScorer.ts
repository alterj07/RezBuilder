import { KeywordMatchDetail, PlacementBreakdown } from '../../types/scoring';

/**
 * Evaluates keyword placement quality across resume sections
 */
export function calculatePlacementScore(keywordDetails: KeywordMatchDetail[]): PlacementBreakdown {
  const matched = keywordDetails.filter((k) => k.foundInResume);

  if (matched.length === 0) {
    return {
      score: 0,
      titleKeywordsCount: 0,
      experienceKeywordsCount: 0,
      summaryKeywordsCount: 0,
      skillsKeywordsCount: 0,
      details: ['No matching keywords found in resume.'],
    };
  }

  let titleCount = 0;
  let expCount = 0;
  let summaryCount = 0;
  let skillsOnlyCount = 0;

  let totalWeightedScore = 0;

  for (const item of matched) {
    const hasTitle = item.placements.includes('title');
    const hasExp = item.placements.includes('experience');
    const hasSummary = item.placements.includes('summary');
    const hasSkills = item.placements.includes('skills');

    if (hasTitle) titleCount++;
    if (hasExp) expCount++;
    if (hasSummary) summaryCount++;

    // Calculate individual keyword placement value (0 to 1.0)
    let kwVal = 0;
    if (hasTitle) kwVal += 0.35;
    if (hasExp) kwVal += 0.55;
    if (hasSummary) kwVal += 0.20;
    if (hasSkills) kwVal += 0.15;

    if (!hasTitle && !hasExp && !hasSummary && hasSkills) {
      skillsOnlyCount++;
      kwVal = 0.40; // Base score for only listing in skills
    }

    totalWeightedScore += Math.min(1.0, kwVal);
  }

  const rawScore = (totalWeightedScore / matched.length) * 100;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const details: string[] = [];
  if (titleCount > 0) {
    details.push(`${titleCount} keyword(s) featured directly in Job Titles (+High ATS Weight).`);
  }
  if (expCount > 0) {
    details.push(`${expCount} keyword(s) integrated into Experience Bullet Points.`);
  }
  if (summaryCount > 0) {
    details.push(`${summaryCount} keyword(s) highlighted in Professional Summary.`);
  }
  if (skillsOnlyCount > 0) {
    details.push(`${skillsOnlyCount} keyword(s) only listed in Skills section. Consider adding to experience bullets.`);
  }

  return {
    score,
    titleKeywordsCount: titleCount,
    experienceKeywordsCount: expCount,
    summaryKeywordsCount: summaryCount,
    skillsKeywordsCount: skillsOnlyCount,
    details,
  };
}
