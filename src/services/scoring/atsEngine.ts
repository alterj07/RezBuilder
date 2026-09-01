import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { AtsPresetName, AtsScoreResult, AtsWeights } from '../../types/scoring';
import { calculateKeywordMatch } from './keywordMatcher';
import { calculatePlacementScore } from './placementScorer';
import { checkSectionCompleteness } from './sectionChecker';
import { evaluateParseSuccess } from './parseSuccessEvaluator';
import { calculateRelevance } from './relevanceScorer';

export const ATS_PRESETS: Record<AtsPresetName, AtsWeights> = {
  standard: {
    keywordMatch: 45,       // 40-50%
    placement: 15,          // 10-15%
    sectionCompleteness: 15,// 15-20%
    parseSuccess: 15,       // 10-20%
    relevance: 10,          // 5-15%
  },
  enterprise: {
    keywordMatch: 50,
    placement: 15,
    sectionCompleteness: 15,
    parseSuccess: 10,
    relevance: 10,
  },
  modern: {
    keywordMatch: 40,
    placement: 15,
    sectionCompleteness: 20,
    parseSuccess: 10,
    relevance: 15,
  },
  custom: {
    keywordMatch: 45,
    placement: 15,
    sectionCompleteness: 15,
    parseSuccess: 15,
    relevance: 10,
  },
};

/**
 * Normalizes custom weights to ensure the sum equals exactly 100%
 */
export function normalizeWeights(weights: AtsWeights): AtsWeights {
  const rawSum =
    weights.keywordMatch +
    weights.placement +
    weights.sectionCompleteness +
    weights.parseSuccess +
    weights.relevance;

  if (rawSum === 100 || rawSum === 0) return weights;

  const scale = 100 / rawSum;
  const normalized: AtsWeights = {
    keywordMatch: Math.round(weights.keywordMatch * scale),
    placement: Math.round(weights.placement * scale),
    sectionCompleteness: Math.round(weights.sectionCompleteness * scale),
    parseSuccess: Math.round(weights.parseSuccess * scale),
    relevance: Math.round(weights.relevance * scale),
  };

  const currentSum =
    normalized.keywordMatch +
    normalized.placement +
    normalized.sectionCompleteness +
    normalized.parseSuccess +
    normalized.relevance;

  const diff = 100 - currentSum;
  normalized.keywordMatch += diff; // adjust largest weight

  return normalized;
}

/**
 * Computes full ATS Score result using the 5-factor weighted formula:
 * Score = (Keyword Match × W1) + (Placement × W2) + (Sections × W3) + (Parse Success × W4) + (Relevance × W5)
 */
export function calculateAtsScore(
  job: JobPosting,
  resume: Resume,
  preset: AtsPresetName = 'standard',
  customWeights?: AtsWeights
): AtsScoreResult {
  const activeWeights = preset === 'custom' && customWeights ? normalizeWeights(customWeights) : ATS_PRESETS[preset];

  // 1. Keyword Match (W1: 40-50%)
  const keywordResult = calculateKeywordMatch(job, resume);

  // 2. Placement Multiplier (W2: 10-15%)
  const placementResult = calculatePlacementScore(keywordResult.items);

  // 3. Section Completeness (W3: 15-20%)
  const sectionResult = checkSectionCompleteness(resume);

  // 4. Parse Success (W4: 10-20%)
  const parseResult = evaluateParseSuccess(resume);

  // 5. Relevance Boost (W5: 5-15%)
  const relevanceResult = calculateRelevance(job, resume);

  // Calculate Weighted Total Score
  const rawTotal =
    (keywordResult.score * activeWeights.keywordMatch +
      placementResult.score * activeWeights.placement +
      sectionResult.score * activeWeights.sectionCompleteness +
      parseResult.score * activeWeights.parseSuccess +
      relevanceResult.score * activeWeights.relevance) /
    100;

  const overallScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  // Generate actionable recommendations
  const recommendations: string[] = [];

  const missingKeywords = keywordResult.items.filter((k) => !k.foundInResume).map((k) => k.keyword);
  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords.slice(0, 4).join(', ');
    recommendations.push(`Add key missing tools/skills: ${topMissing}.`);
  }

  if (placementResult.skillsKeywordsCount > 2) {
    recommendations.push(
      `Incorporate ${placementResult.skillsKeywordsCount} skills currently only in your skills list into experience bullet points to boost placement score.`
    );
  }

  if (sectionResult.score < 80) {
    recommendations.push('Enhance section completeness with clear dates, title structures, and a 2-3 sentence professional summary.');
  }

  if (parseResult.score < 85) {
    recommendations.push('Fix potential ATS parse issues: use standard date formats (e.g. Jan 2022) and standard section headers.');
  }

  if (relevanceResult.tenureYearsRequired && relevanceResult.tenureYearsInResume < relevanceResult.tenureYearsRequired) {
    recommendations.push(`Highlight scope of impact to compensate for tenure gap (${relevanceResult.tenureYearsInResume} yrs vs ${relevanceResult.tenureYearsRequired}+ required).`);
  }

  return {
    overallScore,
    presetUsed: preset,
    weights: activeWeights,
    keywordScore: keywordResult.score,
    placementScore: placementResult.score,
    sectionScore: sectionResult.score,
    parseScore: parseResult.score,
    relevanceScore: relevanceResult.score,
    keywordDetails: {
      totalKeywords: keywordResult.totalKeywords,
      matchedKeywords: keywordResult.matchedKeywords,
      missingKeywords: keywordResult.missingKeywords,
      items: keywordResult.items,
    },
    placementDetails: placementResult,
    sectionDetails: {
      items: sectionResult.items,
    },
    parseDetails: {
      issues: parseResult.issues,
      cleanlinessRating: parseResult.cleanlinessRating,
    },
    relevanceDetails: relevanceResult,
    recommendations,
    calculatedAt: new Date().toISOString(),
  };
}
