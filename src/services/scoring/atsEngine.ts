import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { UserProfile } from '../../types/profile';
import { AtsPresetName, AtsScoreResult, AtsWeights, EligibilityScreeningDetail } from '../../types/scoring';
import { extractJobRequirements } from '../fit/jobRequirements';
import { evaluateEligibility } from '../fit/eligibilityFactor';
import { WEAK_VERB_MAP, extractActionVerbRecommendations } from './actionVerbExtractor';
import { calculateKeywordMatch } from './keywordMatcher';
import { calculatePlacementScore } from './placementScorer';
import { checkSectionCompleteness } from './sectionChecker';
import { evaluateParseSuccess } from './parseSuccessEvaluator';
import { calculateRelevance } from './relevanceScorer';

export { WEAK_VERB_MAP, extractActionVerbRecommendations };

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
 * A posting whose screening questions the candidate fails cannot score well no
 * matter how good the resume is, so eligibility knockouts cap the total here
 * the same way `HARD_BLOCKER_CAP` caps Best Fit %.
 */
export const ELIGIBILITY_KNOCKOUT_CAP = 35;

/** Most an eligibility match can add, so it nudges the score without dominating it. */
export const ELIGIBILITY_MAX_BONUS = 5;

/**
 * Compares the eligibility attributes the posting screens on against the
 * profile, and reports which of the confirmed ones the resume never mentions —
 * a clearance a candidate holds but never wrote down still fails a keyword screen.
 */
function screenEligibility(job: JobPosting, resume: Resume, profile: UserProfile): EligibilityScreeningDetail {
  const assessment = evaluateEligibility(extractJobRequirements(job), profile);
  const detail: EligibilityScreeningDetail = {
    applicable: assessment.applicable,
    knockouts: [...assessment.blockers],
    qualifyingAttributes: [...assessment.qualifyingAttributes],
    missingFromResume: [],
    adjustment: 0,
  };
  if (!assessment.applicable) return detail;

  const resumeText = [resume.rawText || '', ...(resume.sections?.skills || []), resume.sections?.summary || ''].join('\n').toLowerCase();
  for (const { label, keyword } of assessment.resumeWorthyAttributes) {
    if (!resumeText.includes(keyword)) detail.missingFromResume.push(label);
  }
  return detail;
}

/**
 * Computes full ATS Score result using the 5-factor weighted formula:
 * Score = (Keyword Match × W1) + (Placement × W2) + (Sections × W3) + (Parse Success × W4) + (Relevance × W5)
 *
 * Passing `profile` additionally applies the posting's eligibility screening —
 * clearance, citizenship, sponsorship, veteran / disability preference — which
 * caps the total at `ELIGIBILITY_KNOCKOUT_CAP` when a screening question would
 * reject the application and adds up to `ELIGIBILITY_MAX_BONUS` when the
 * candidate holds an attribute the posting screens for. Omitting it leaves the
 * five-factor resume score exactly as it was.
 */
export function calculateAtsScore(
  job: JobPosting,
  resume: Resume,
  preset: AtsPresetName = 'standard',
  customWeights?: AtsWeights,
  profile?: UserProfile | null
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

  // 6. Action Verb Recommendations
  const actionVerbRecommendations = extractActionVerbRecommendations(resume);

  // Calculate Weighted Total Score
  const rawTotal =
    (keywordResult.score * activeWeights.keywordMatch +
      placementResult.score * activeWeights.placement +
      sectionResult.score * activeWeights.sectionCompleteness +
      parseResult.score * activeWeights.parseSuccess +
      relevanceResult.score * activeWeights.relevance) /
    100;

  const baseScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  // 7. Eligibility screening (only when a profile was supplied)
  const eligibilityDetails = profile ? screenEligibility(job, resume, profile) : undefined;
  let overallScore = baseScore;
  if (eligibilityDetails?.applicable) {
    if (eligibilityDetails.knockouts.length > 0) {
      overallScore = Math.min(baseScore, ELIGIBILITY_KNOCKOUT_CAP);
    } else if (eligibilityDetails.qualifyingAttributes.length > 0) {
      const bonus = Math.min(ELIGIBILITY_MAX_BONUS, 2 * eligibilityDetails.qualifyingAttributes.length);
      overallScore = Math.min(100, baseScore + bonus);
    }
    eligibilityDetails.adjustment = overallScore - baseScore;
  }

  const missingKeywords = keywordResult.items.filter((k) => !k.foundInResume).map((k) => k.keyword);
  const matchedKeywords = keywordResult.items.filter((k) => k.foundInResume).map((k) => k.keyword);

  // Generate actionable recommendations
  const recommendations: string[] = [];

  if (eligibilityDetails?.knockouts.length) {
    recommendations.push(`This posting screens applicants out on: ${eligibilityDetails.knockouts.join('; ')}.`);
  }
  if (eligibilityDetails?.missingFromResume.length) {
    recommendations.push(
      `Add ${eligibilityDetails.missingFromResume.join(' and ')} to your resume — this posting screens on it and your resume never mentions it.`
    );
  }

  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords.slice(0, 4).join(', ');
    recommendations.push(`Add key missing tools/skills: ${topMissing}.`);
  }

  if (placementResult.skillsKeywordsCount > 2) {
    recommendations.push(
      `Incorporate ${placementResult.skillsKeywordsCount} skills currently only in your skills list into experience bullet points to boost placement score.`
    );
  }

  if (actionVerbRecommendations.length > 0) {
    recommendations.push(
      `Upgrade ${actionVerbRecommendations.length} weak bullet verbs (e.g. replace "${actionVerbRecommendations[0].current}" with "${actionVerbRecommendations[0].suggested}") to strengthen impact.`
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
    breakdown: {
      keywordMatch: keywordResult.score,
      placementScore: placementResult.score,
      sectionCompleteness: sectionResult.score,
      parseSuccess: parseResult.score,
      relevanceScore: relevanceResult.score,
    },
    keywordDetails: {
      totalKeywords: keywordResult.totalKeywords,
      matchedKeywords: keywordResult.matchedKeywords,
      missingKeywords: keywordResult.missingKeywords,
      items: keywordResult.items,
    },
    keywordGaps: missingKeywords,
    matchedKeywords,
    placementDetails: placementResult,
    sectionDetails: {
      items: sectionResult.items,
    },
    parseDetails: {
      issues: parseResult.issues,
      cleanlinessRating: parseResult.cleanlinessRating,
    },
    relevanceDetails: relevanceResult,
    ...(eligibilityDetails ? { eligibilityDetails } : {}),
    recommendations,
    actionVerbRecommendations,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Interface contract function for ATS resume scoring
 */
export function scoreResume(
  job: JobPosting,
  resume: Resume,
  weightsOrPreset?: AtsWeights | AtsPresetName,
  profile?: UserProfile | null
): AtsScoreResult {
  if (typeof weightsOrPreset === 'string') {
    return calculateAtsScore(job, resume, weightsOrPreset, undefined, profile);
  }
  if (weightsOrPreset) {
    return calculateAtsScore(job, resume, 'custom', weightsOrPreset, profile);
  }
  return calculateAtsScore(job, resume, 'standard', undefined, profile);
}
