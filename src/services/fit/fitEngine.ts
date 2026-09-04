/**
 * Best Fit % — deterministic, explainable, zero-network estimate of how well
 * a `UserProfile` fits a `JobPosting`.
 */
import { JobPosting } from '../../types/job';
import { EmploymentPreference, UserProfile } from '../../types/profile';
import { DEFAULT_FIT_WEIGHTS, FitConfidence, FitFactor, FitFactorKey, FitResult, FitWeights } from '../../types/fit';
import { extractJobRequirements, JobEmploymentType, JobRequirements } from './jobRequirements';
import { computeProfileYears, DEGREE_LABEL, DEGREE_RANK, degreeLevelForRank, highestDegreeRank } from './profileSignals';
import { FactorContext, FactorOutcome, clamp, uniq } from './common';
import { scoreSkills } from './skillsFactor';
import { scoreExperience } from './experienceFactor';
import { scoreEducation } from './educationFactor';
import { scoreCertifications } from './certificationsFactor';
import { scoreStory } from './storyFactor';
import { scorePreferences } from './preferencesFactor';

export const FIT_FACTOR_ORDER: FitFactorKey[] = ['skills', 'experience', 'education', 'certifications', 'story', 'preferences'];

const FACTOR_LABEL: Record<FitFactorKey, string> = {
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education',
  certifications: 'Certifications',
  story: 'Story & culture',
  preferences: 'Preferences',
};

/** Any hard blocker caps the headline number at this value. */
export const HARD_BLOCKER_CAP = 35;

const EMPLOYMENT_LABEL: Record<JobEmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
  unknown: 'Unspecified',
};

const CLEARANCE_PROFILE_RE = /\bclearance\b|\bts\/sci\b|\btop\s+secret\b|\bsecret\b|\bpublic\s+trust\b/i;

/**
 * Redistributes the configured weights over applicable factors so they sum
 * to exactly 100 (largest-remainder rounding, stable in factor order).
 */
export function redistributeWeights(weights: FitWeights, applicable: Record<FitFactorKey, boolean>): Record<FitFactorKey, number> {
  const out = {} as Record<FitFactorKey, number>;
  let total = 0;
  for (const key of FIT_FACTOR_ORDER) {
    const w = applicable[key] ? Math.max(0, weights[key] || 0) : 0;
    out[key] = w;
    total += w;
  }
  if (total === 0) return out;
  const raw = FIT_FACTOR_ORDER.map((key) => (out[key] * 100) / total);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = 100 - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floored[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    if (raw[i] === 0) continue;
    floored[i] += 1;
    remainder -= 1;
  }
  FIT_FACTOR_ORDER.forEach((key, i) => {
    out[key] = floored[i];
  });
  return out;
}

function detectHardBlockers(profile: UserProfile, reqs: JobRequirements, profileYears: number): { blockers: string[]; isZeroFit: boolean } {
  const blockers: string[] = [];
  let isZeroFit = false;

  if (reqs.requiresClearance) {
    const text = [...(profile.skills || []).map((s) => s.name), ...(profile.certifications || []).map((c) => c.name)].join('\n');
    if (!CLEARANCE_PROFILE_RE.test(text)) blockers.push('Requires a security clearance or U.S. citizenship');
  }

  if (reqs.requiresSponsorshipUnavailable && profile.story?.needsSponsorship === true) {
    blockers.push('Posting does not offer visa sponsorship');
  }

  const studentLevel = reqs.roleLevel === 'internship' || reqs.roleLevel === 'new_grad';
  const attainedRank = highestDegreeRank(profile, studentLevel);
  const anyRank = highestDegreeRank(profile, true);
  const highestLevel = anyRank >= 0 ? degreeLevelForRank(anyRank) : undefined;
  const isGraduateCandidate = anyRank >= DEGREE_RANK.master;

  if (reqs.minDegree && (reqs.degreeRequired || DEGREE_RANK[reqs.minDegree] >= DEGREE_RANK.master)) {
    const minRank = DEGREE_RANK[reqs.minDegree];
    const minLabel = DEGREE_LABEL[reqs.minDegree];
    if (minRank > attainedRank) {
      if (anyRank >= minRank && !studentLevel) {
        blockers.push(`Requires a completed ${minLabel} degree (yours is still in progress)`);
      } else {
        const haveLabel = highestLevel ? DEGREE_LABEL[highestLevel] : 'none listed';
        const inProgress = anyRank > attainedRank ? ' in progress' : '';
        blockers.push(`Requires a ${minLabel} degree (your highest: ${haveLabel}${inProgress})`);
      }

      if (minRank >= DEGREE_RANK.master && anyRank < DEGREE_RANK.master) {
        isZeroFit = true;
      }
    }
  }

  if (reqs.undergradOnly && isGraduateCandidate) {
    const haveLabel = highestLevel ? DEGREE_LABEL[highestLevel] : 'graduate level';
    blockers.push(`Role is restricted to undergraduate students (your degree is ${haveLabel})`);
    isZeroFit = true;
  }

  if (reqs.graduationWindow) {
    const { maxYear } = reqs.graduationWindow;
    const inProgress = (profile.education || []).filter((e) => e.status === 'in_progress' && e.graduationYear);
    const dated = (profile.education || []).filter((e) => e.graduationYear);
    const pick = inProgress[0] || dated.sort((a, b) => (b.graduationYear || 0) - (a.graduationYear || 0))[0];
    const gradYear = pick?.graduationYear;
    if (gradYear !== undefined && gradYear > maxYear) {
      blockers.push(`Graduation year (${gradYear}) is after the job requirement deadline (${maxYear})`);
      isZeroFit = true;
    }
  }

  const isSeniorJob = reqs.roleLevel === 'senior' || reqs.roleLevel === 'lead' || (reqs.requiredYears !== undefined && reqs.requiredYears >= 5);
  const isStudentOrEntry = profileYears < 1.0;
  if (isSeniorJob && isStudentOrEntry) {
    const levelLabel = reqs.roleLevel !== 'unknown' ? reqs.roleLevel : `${reqs.requiredYears}+ years`;
    blockers.push(`Posting requires a ${levelLabel} level of experience (~${profileYears.toFixed(1)} years listed on profile)`);
    isZeroFit = true;
  }

  const wanted: EmploymentPreference[] = profile.story?.employmentTypes || [];
  if (reqs.employmentType !== 'unknown' && wanted.length > 0 && !wanted.includes(reqs.employmentType as EmploymentPreference)) {
    if (reqs.employmentType === 'internship') blockers.push('Internship, but you are not open to internships');
    else blockers.push(`${EMPLOYMENT_LABEL[reqs.employmentType]} role, but your preferences only include: ${wanted.map((w) => EMPLOYMENT_LABEL[w]).join(', ')}`);
  }

  return { blockers, isZeroFit };
}

function assessConfidence(profile: UserProfile, job: JobPosting, reqs: JobRequirements): FitConfidence {
  const skillCount = (profile.skills || []).length;
  const descLen = (job.description || '').length;
  const extracted = reqs.requiredSkills.length + reqs.niceToHaveSkills.length;
  if (skillCount < 3 || descLen < 150 || extracted === 0) return 'low';
  if (
    skillCount >= 5 &&
    (profile.experiences || []).length >= 1 &&
    (profile.education || []).length >= 1 &&
    reqs.requiredSkills.length >= 5 &&
    descLen >= 400
  ) {
    return 'high';
  }
  return 'medium';
}

/** Round-robin pick of strings from factors in priority order. */
function pickRoundRobin(lists: string[][], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < maxLen && out.length < limit; i++) {
    for (const list of lists) {
      if (out.length >= limit) break;
      const item = list[i];
      if (item && !seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
  }
  return out;
}

export function calculateBestFit(job: JobPosting, profile: UserProfile, weights?: Partial<FitWeights>): FitResult {
  const now = new Date();
  const reqs = extractJobRequirements(job);
  const ctx: FactorContext = {
    job,
    profile,
    reqs,
    now,
    profileYears: computeProfileYears(profile, now),
  };

  const skills = scoreSkills(ctx);
  const outcomes: Record<FitFactorKey, FactorOutcome> = {
    skills,
    experience: scoreExperience(ctx),
    education: scoreEducation(ctx),
    certifications: scoreCertifications(ctx),
    story: scoreStory(ctx),
    preferences: scorePreferences(ctx),
  };

  const merged: FitWeights = { ...DEFAULT_FIT_WEIGHTS, ...(weights || {}) };
  const applicable = {} as Record<FitFactorKey, boolean>;
  for (const key of FIT_FACTOR_ORDER) applicable[key] = outcomes[key].applicable;
  const effective = redistributeWeights(merged, applicable);

  const factors: FitFactor[] = FIT_FACTOR_ORDER.map((key) => ({
    key,
    label: FACTOR_LABEL[key],
    score: outcomes[key].applicable ? clamp(Math.round(outcomes[key].score)) : 0,
    weight: effective[key],
    applicable: outcomes[key].applicable,
    evidence: [...outcomes[key].evidence],
    gaps: [...outcomes[key].gaps],
  }));

  const { blockers: hardBlockers, isZeroFit } = detectHardBlockers(profile, reqs, ctx.profileYears);
  let fitPercent = clamp(Math.round(factors.reduce((sum, f) => sum + (f.score * f.weight) / 100, 0)));
  if (isZeroFit) fitPercent = 0;
  else if (hardBlockers.length > 0) fitPercent = Math.min(fitPercent, HARD_BLOCKER_CAP);

  const byWeight = factors.filter((f) => f.applicable).sort((a, b) => b.weight - a.weight || FIT_FACTOR_ORDER.indexOf(a.key) - FIT_FACTOR_ORDER.indexOf(b.key));
  const strengths = pickRoundRobin(
    byWeight.filter((f) => f.score >= 50).map((f) => f.evidence),
    3,
  );
  const byImpact = factors
    .filter((f) => f.applicable)
    .sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score) || FIT_FACTOR_ORDER.indexOf(a.key) - FIT_FACTOR_ORDER.indexOf(b.key));
  const improvements = pickRoundRobin(
    byImpact.map((f) => f.gaps),
    3,
  );

  return {
    fitPercent,
    confidence: assessConfidence(profile, job, reqs),
    factors,
    matchedSkills: skills.matchedSkills,
    missingSkills: uniq(skills.missingSkills),
    hardBlockers,
    strengths,
    improvements,
    calculatedAt: now.toISOString(),
  };
}
