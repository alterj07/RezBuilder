import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { AtsPresetName, AtsWeights, ResumeComparisonItem } from '../../types/scoring';
import { calculateAtsScore } from './atsEngine';

/**
 * Compares multiple resumes against a target job posting, ranks them, and recommends the best match
 */
export function compareResumesAgainstJob(
  job: JobPosting,
  resumes: Resume[],
  preset: AtsPresetName = 'standard',
  customWeights?: AtsWeights
): {
  recommendation: ResumeComparisonItem | null;
  rankedResumes: ResumeComparisonItem[];
} {
  if (!resumes || resumes.length === 0) {
    return {
      recommendation: null,
      rankedResumes: [],
    };
  }

  const comparisons: ResumeComparisonItem[] = resumes.map((resume) => {
    const scoreResult = calculateAtsScore(job, resume, preset, customWeights);
    return {
      resumeId: resume.id,
      resumeName: resume.name,
      resumeTag: resume.tag,
      scoreResult,
      isRecommended: false,
      recommendationReason: '',
    };
  });

  // Sort descending by overallScore
  comparisons.sort((a, b) => b.scoreResult.overallScore - a.scoreResult.overallScore);

  // Pick best
  const best = comparisons[0];
  if (best) {
    best.isRecommended = true;
    const kwMatchCount = best.scoreResult.keywordDetails.matchedKeywords;
    const kwTotal = best.scoreResult.keywordDetails.totalKeywords;
    best.recommendationReason = `Highest match (${best.scoreResult.overallScore}%) with ${kwMatchCount}/${kwTotal} matching skills and ${best.scoreResult.relevanceScore}% role relevance.`;
  }

  return {
    recommendation: best || null,
    rankedResumes: comparisons,
  };
}
