/**
 * Eligibility — the qualification checks that live outside a resume: security
 * clearance, citizenship / export-control status, visa sponsorship, and the
 * veteran and disability preferences some postings state.
 *
 * Deterministic and shared: `calculateBestFit` turns the assessment into the
 * `eligibility` factor plus its hard blockers, and `calculateAtsScore` uses the
 * same blockers as screening knockouts. Nothing here is inferred from a name, a school or a
 * location — only from what the user explicitly entered.
 *
 * The cardinal rule is that silence is never a "no". A profile that leaves the
 * eligibility section blank is scored as *unknown* (a mild, recoverable
 * discount plus a prompt to fill it in), never as disqualified.
 */
import { UserProfile } from '../../types/profile';
import { JobRequirements } from './jobRequirements';
import { clamp, weightedAverage } from './common';
import {
  CLEARANCE_LABEL,
  CLEARANCE_RANK,
  POLYGRAPH_LABEL,
  ResolvedEligibility,
  clearanceLabel,
  resolveEligibility,
} from './eligibilitySignals';

export interface EligibilityAssessment {
  /** False when the posting states no eligibility requirement or preference. */
  applicable: boolean;
  /** 0-100 for this dimension alone; 0 whenever a blocker fired. */
  score: number;
  /** Requirements the profile explicitly fails. Feeds `FitResult.hardBlockers`. */
  blockers: string[];
  evidence: string[];
  gaps: string[];
  /** Eligibility questions the posting asks that the profile has not answered. */
  unknowns: string[];
  /** Attributes the posting screens on that the profile confirms (clearance, citizenship, veteran…). */
  qualifyingAttributes: string[];
  /**
   * The subset of `qualifyingAttributes` that belongs on a resume. A clearance
   * or veteran status is worth a line; "work authorization without sponsorship"
   * is an application-form answer, not resume content. `keyword` is the single
   * word a resume would have to contain for the attribute to be visible to a
   * keyword screen.
   */
  resumeWorthyAttributes: { label: string; keyword: string }[];
}

/** Relative weight of each dimension when the posting raises more than one. */
const DIMENSION_WEIGHT = {
  authorization: 45,
  clearance: 45,
  veteran: 5,
  disability: 5,
} as const;

/** Score for a dimension the posting raises but the profile has not answered. */
const UNKNOWN_SCORE = 50;
/** Score for a preference that simply does not apply to this candidate — not a deficiency. */
const NEUTRAL_PREFERENCE_SCORE = 80;

const ADD_AUTHORIZATION_PROMPT = 'Add your work authorization in Profile → Work eligibility';
const ADD_CLEARANCE_PROMPT = 'Add your security clearance in Profile → Work eligibility';

interface Dimension {
  score: number;
  weight: number;
}

function requiredClearanceLabel(reqs: JobRequirements): string {
  return reqs.clearanceLevel ? `${CLEARANCE_LABEL[reqs.clearanceLevel]} clearance` : 'security clearance';
}

// ---------------------------------------------------------------------------
// Clearance
// ---------------------------------------------------------------------------

function assessClearance(reqs: JobRequirements, el: ResolvedEligibility, out: EligibilityAssessment): number {
  const wanted = requiredClearanceLabel(reqs);
  const wantedRank = reqs.clearanceLevel ? CLEARANCE_RANK[reqs.clearanceLevel] : 0;
  const held = el.clearance;

  // --- nothing on file ---
  if (!held || held.status === 'none') {
    // Only a US citizen can be sponsored for a clearance, so a stated non-citizen
    // is genuinely knocked out even by an "able to obtain" posting.
    if (el.isUsCitizen === false) {
      out.blockers.push(`Requires a ${wanted}, which is only granted to U.S. citizens`);
      return 0;
    }
    if (reqs.clearanceObtainable && !reqs.clearanceMustBeActive) {
      if (el.isUsCitizen === true) {
        out.gaps.push(`You would need to be sponsored for a ${wanted}`);
        return 70;
      }
      out.unknowns.push(ADD_AUTHORIZATION_PROMPT);
      return UNKNOWN_SCORE;
    }
    out.blockers.push(`Requires an active ${wanted} (your profile lists none)`);
    return 0;
  }

  // --- held but not currently active ---
  if (held.status !== 'active') {
    const label = clearanceLabel(held);
    if (reqs.clearanceMustBeActive) {
      out.blockers.push(`Requires an active ${wanted} (yours is ${held.status})`);
      return 0;
    }
    out.gaps.push(`Your ${label} would need to be reinstated for this ${wanted}`);
    return 65;
  }

  // --- held and active ---
  out.qualifyingAttributes.push(clearanceLabel(held));
  out.resumeWorthyAttributes.push({
    label: held.level ? `your ${CLEARANCE_LABEL[held.level]} clearance` : 'your security clearance',
    keyword: 'clearance',
  });
  if (!held.level) {
    out.evidence.push(`Holds an active clearance (posting requires a ${wanted})`);
    out.gaps.push('Set your clearance level so this can be matched exactly');
    return 85;
  }

  const heldRank = CLEARANCE_RANK[held.level];
  if (heldRank < wantedRank) {
    out.gaps.push(`Posting wants a ${wanted}; your ${CLEARANCE_LABEL[held.level]} clearance would need an upgrade`);
    return 45;
  }

  out.evidence.push(`Holds an active ${CLEARANCE_LABEL[held.level]} clearance, meeting the ${wanted} requirement`);
  let score = 100;
  if (reqs.clearancePolygraph && reqs.clearancePolygraph !== 'none') {
    const wantedPoly = POLYGRAPH_LABEL[reqs.clearancePolygraph];
    if (held.polygraph === reqs.clearancePolygraph || held.polygraph === 'full_scope') {
      out.evidence.push(`Has the ${wantedPoly} the posting asks for`);
    } else {
      out.gaps.push(`Posting also requires a ${wantedPoly}`);
      score = 75;
    }
  }
  return score;
}

// ---------------------------------------------------------------------------
// Citizenship / export control / sponsorship
// ---------------------------------------------------------------------------

function assessAuthorization(reqs: JobRequirements, el: ResolvedEligibility, out: EligibilityAssessment): number {
  // Several requirements can apply at once; the most binding one wins.
  const parts: number[] = [];

  if (reqs.requiresUsCitizenship) {
    if (el.isUsCitizen === true) {
      out.evidence.push('U.S. citizenship requirement met');
      out.qualifyingAttributes.push('U.S. citizenship');
      parts.push(100);
    } else if (el.isUsCitizen === false) {
      out.blockers.push('Requires U.S. citizenship');
      parts.push(0);
    } else {
      out.unknowns.push(ADD_AUTHORIZATION_PROMPT);
      parts.push(UNKNOWN_SCORE);
    }
  }

  if (reqs.requiresUsPersonStatus) {
    if (el.isUsPerson === true) {
      out.evidence.push('Meets the export-control "U.S. person" requirement');
      out.qualifyingAttributes.push('U.S. person status');
      parts.push(100);
    } else if (el.isUsPerson === false) {
      out.blockers.push('Export-controlled role: requires a U.S. citizen or permanent resident');
      parts.push(0);
    } else {
      out.unknowns.push(ADD_AUTHORIZATION_PROMPT);
      parts.push(UNKNOWN_SCORE);
    }
  }

  if (reqs.requiresSponsorshipUnavailable) {
    if (el.needsSponsorshipNow === true) {
      out.blockers.push('Posting does not offer visa sponsorship');
      parts.push(0);
    } else if (el.needsSponsorshipNow === false && el.needsSponsorshipFuture === true) {
      if (reqs.sponsorshipUnavailableFuture) {
        out.blockers.push('Posting will not sponsor now or in the future, and your authorization is time-limited');
        parts.push(0);
      } else {
        out.gaps.push('You are authorized now but will need sponsorship later; this employer does not sponsor');
        parts.push(45);
      }
    } else if (el.needsSponsorshipNow === false) {
      out.evidence.push('Authorized to work without sponsorship, as the posting requires');
      out.qualifyingAttributes.push('work authorization without sponsorship');
      parts.push(100);
    } else {
      out.unknowns.push(ADD_AUTHORIZATION_PROMPT);
      parts.push(UNKNOWN_SCORE);
    }
  }

  if (reqs.offersSponsorship) {
    if (el.needsSponsorshipNow === true || el.needsSponsorshipFuture === true) {
      out.evidence.push('Employer offers visa sponsorship, which you need');
      parts.push(100);
    } else {
      parts.push(NEUTRAL_PREFERENCE_SCORE);
    }
  }

  return parts.length === 0 ? NEUTRAL_PREFERENCE_SCORE : Math.min(...parts);
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Compares what the posting screens on against what the profile declares.
 *
 * `applicable` is false — and every list empty — for the ordinary posting that
 * states no eligibility requirement, so callers can redistribute its weight.
 */
export function evaluateEligibility(reqs: JobRequirements, profile: UserProfile | null | undefined): EligibilityAssessment {
  const out: EligibilityAssessment = {
    applicable: false,
    score: 0,
    blockers: [],
    evidence: [],
    gaps: [],
    unknowns: [],
    qualifyingAttributes: [],
    resumeWorthyAttributes: [],
  };

  const raisesAuthorization =
    reqs.requiresUsCitizenship || reqs.requiresUsPersonStatus || reqs.requiresSponsorshipUnavailable || reqs.offersSponsorship;
  if (!raisesAuthorization && !reqs.requiresClearance && !reqs.veteranPreference && !reqs.disabilityPreference) {
    return out;
  }

  out.applicable = true;
  const el = resolveEligibility(profile);
  const dimensions: Dimension[] = [];

  if (reqs.requiresClearance) {
    dimensions.push({ score: assessClearance(reqs, el, out), weight: DIMENSION_WEIGHT.clearance });
    if (!el.clearance) out.unknowns.push(ADD_CLEARANCE_PROMPT);
  }

  if (raisesAuthorization) {
    dimensions.push({ score: assessAuthorization(reqs, el, out), weight: DIMENSION_WEIGHT.authorization });
  }

  // Veteran and disability preferences can only ever help. Not being a veteran
  // is not a deficiency, and the user is never prompted to disclose either one.
  if (reqs.veteranPreference) {
    let score = NEUTRAL_PREFERENCE_SCORE;
    if (el.isVeteran === true) {
      const label = el.isProtectedVeteran ? 'protected veteran status' : 'veteran status';
      out.evidence.push(`Posting states a veteran preference and you have ${label}`);
      out.qualifyingAttributes.push(label);
      out.resumeWorthyAttributes.push({ label: `your ${label}`, keyword: 'veteran' });
      score = 100;
    }
    dimensions.push({ score, weight: DIMENSION_WEIGHT.veteran });
  }

  if (reqs.disabilityPreference) {
    let score = NEUTRAL_PREFERENCE_SCORE;
    if (el.hasDisability === true) {
      out.evidence.push('Posting actively invites applicants with disabilities');
      out.qualifyingAttributes.push('disability self-identification');
      score = 100;
    }
    dimensions.push({ score, weight: DIMENSION_WEIGHT.disability });
  }

  out.unknowns = Array.from(new Set(out.unknowns));
  out.score = out.blockers.length > 0 ? 0 : clamp(Math.round(weightedAverage(dimensions, NEUTRAL_PREFERENCE_SCORE)));
  return out;
}
