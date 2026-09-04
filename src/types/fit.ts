import { SkillRating } from './profile';

/**
 * Best Fit % — a deterministic, explainable estimate of how well the user's
 * profile matches a job posting. Runs entirely locally; no LLM, no network.
 */

export type FitFactorKey =
  | 'skills'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'story'
  | 'preferences';

export interface FitFactor {
  key: FitFactorKey;
  label: string;
  /** 0-100 for this factor alone. */
  score: number;
  /** Effective weight (0-100) after redistribution of non-applicable factors. Sum of all weights = 100. */
  weight: number;
  /** False when the job gives no signal for this factor; its weight is redistributed. */
  applicable: boolean;
  /** Short, user-facing reasons that raised the score. */
  evidence: string[];
  /** Short, user-facing reasons that lowered the score. */
  gaps: string[];
}

export interface FitSkillMatch {
  name: string;
  rating: SkillRating;
  /** True when the posting lists it as required rather than merely mentioning it. */
  required: boolean;
}

export type FitConfidence = 'high' | 'medium' | 'low';

export interface FitResult {
  /** 0-100. The headline number. */
  fitPercent: number;
  /** How much data backed the estimate (sparse profile or thin posting lowers it). */
  confidence: FitConfidence;
  factors: FitFactor[];
  matchedSkills: FitSkillMatch[];
  missingSkills: string[];
  /**
   * Requirements the profile explicitly fails (e.g. "Requires security clearance",
   * "Requires a Master's degree", "Not open to internships"). Shown prominently.
   */
  hardBlockers: string[];
  /** Top 3 things going for the user, for the summary card. */
  strengths: string[];
  /** Top 3 concrete ways to raise the score, for the summary card. */
  improvements: string[];
  calculatedAt: string; // ISO
}

export interface FitWeights {
  skills: number;
  experience: number;
  education: number;
  certifications: number;
  story: number;
  preferences: number;
}

export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  skills: 40,
  experience: 25,
  education: 15,
  certifications: 5,
  story: 10,
  preferences: 5,
};
