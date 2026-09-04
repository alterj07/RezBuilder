import { JobPosting } from '../../types/job';
import { UserProfile } from '../../types/profile';
import { JobRequirements } from './jobRequirements';

/** Everything a factor scorer needs; computed once per `calculateBestFit` call. */
export interface FactorContext {
  job: JobPosting;
  profile: UserProfile;
  reqs: JobRequirements;
  now: Date;
  /** Weighted total years of experience from the profile. */
  profileYears: number;
}

export interface FactorOutcome {
  score: number;
  applicable: boolean;
  evidence: string[];
  gaps: string[];
}

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface WeightedPart {
  score: number;
  weight: number;
}

/** Weighted mean of the parts, ignoring zero-weight parts. Returns `fallback` when nothing has weight. */
export function weightedAverage(parts: WeightedPart[], fallback = 0): number {
  let sum = 0;
  let total = 0;
  for (const p of parts) {
    if (p.weight <= 0) continue;
    sum += p.score * p.weight;
    total += p.weight;
  }
  return total === 0 ? fallback : sum / total;
}

export function notApplicable(): FactorOutcome {
  return { score: 0, applicable: false, evidence: [], gaps: [] };
}

export function uniq(items: string[]): string[] {
  return Array.from(new Set(items));
}
