/**
 * Profile-side eligibility signals: normalises the optional
 * `UserProfile.eligibility` block (plus the two legacy `story` flags and any
 * clearance wording left in skills / certifications) into the tri-state facts
 * the fit and ATS engines compare against a posting.
 *
 * Tri-state is the whole point: `undefined` means "the user has not told us",
 * and callers must treat that as *unknown*, never as "no".
 */
import {
  ClearanceLevel,
  ClearanceStatus,
  PolygraphType,
  ProfileEligibility,
  UserProfile,
  VisaType,
  WorkAuthorization,
} from '../../types/profile';

/** Ordinal clearance ladder; higher clears everything below it. */
export const CLEARANCE_RANK: Record<ClearanceLevel, number> = {
  none: 0,
  public_trust: 1,
  confidential: 2,
  secret: 3,
  top_secret: 4,
  ts_sci: 5,
};

export const CLEARANCE_LABEL: Record<ClearanceLevel, string> = {
  none: 'none',
  public_trust: 'Public Trust',
  confidential: 'Confidential',
  secret: 'Secret',
  top_secret: 'Top Secret',
  ts_sci: 'TS/SCI',
};

export const POLYGRAPH_LABEL: Record<PolygraphType, string> = {
  none: 'no polygraph',
  ci: 'CI polygraph',
  full_scope: 'full-scope polygraph',
};

export const WORK_AUTHORIZATION_LABEL: Record<WorkAuthorization, string> = {
  us_citizen: 'U.S. citizen',
  us_permanent_resident: 'U.S. permanent resident',
  us_work_visa: 'work visa holder',
  us_student_visa: 'student visa (OPT/CPT)',
  us_other_authorized: 'authorized without sponsorship',
  needs_sponsorship: 'requires sponsorship',
  prefer_not_to_say: 'not disclosed',
};

export const VISA_LABEL: Record<VisaType, string> = {
  h1b: 'H-1B',
  h4_ead: 'H-4 EAD',
  f1_opt: 'F-1 OPT',
  f1_stem_opt: 'F-1 STEM OPT',
  f1_cpt: 'F-1 CPT',
  j1: 'J-1',
  l1: 'L-1',
  tn: 'TN',
  e3: 'E-3',
  o1: 'O-1',
  ead: 'EAD',
  other: 'work visa',
};

/** A clearance the profile evidences, either declared or parsed out of free text. */
export interface ResolvedClearance {
  /** Undefined when the wording proves a clearance exists but not which one. */
  level?: ClearanceLevel;
  status: ClearanceStatus;
  polygraph?: PolygraphType;
  /** `declared` came from the eligibility form; `text` was parsed from skills / certifications. */
  source: 'declared' | 'text';
}

/**
 * Every eligibility fact, resolved. `undefined` on a tri-state means unknown;
 * `clearance` is undefined when the profile shows no clearance signal at all.
 */
export interface ResolvedEligibility {
  workAuthorization?: WorkAuthorization;
  visaType?: VisaType;
  isUsCitizen?: boolean;
  /** "U.S. person" for ITAR / export-control purposes: citizen or permanent resident. */
  isUsPerson?: boolean;
  /** Authorized to work in the US on day one, with or without a visa of their own. */
  authorizedNow?: boolean;
  needsSponsorshipNow?: boolean;
  needsSponsorshipFuture?: boolean;
  clearance?: ResolvedClearance;
  isVeteran?: boolean;
  isProtectedVeteran?: boolean;
  hasDisability?: boolean;
  citizenships: string[];
  /** True when the user has answered nothing at all — used to phrase "add this" prompts. */
  isEmpty: boolean;
}

/** Facts each `WorkAuthorization` implies unless the user overrides them. */
const AUTHORIZATION_FACTS: Record<
  Exclude<WorkAuthorization, 'prefer_not_to_say'>,
  { isUsCitizen: boolean; isUsPerson: boolean; authorizedNow: boolean; sponsorNow: boolean; sponsorFuture: boolean }
> = {
  us_citizen: { isUsCitizen: true, isUsPerson: true, authorizedNow: true, sponsorNow: false, sponsorFuture: false },
  us_permanent_resident: { isUsCitizen: false, isUsPerson: true, authorizedNow: true, sponsorNow: false, sponsorFuture: false },
  // A change of employer needs a new petition, so an H-1B holder answers "yes" to both questions.
  us_work_visa: { isUsCitizen: false, isUsPerson: false, authorizedNow: true, sponsorNow: true, sponsorFuture: true },
  // OPT / CPT covers day one; the visa runs out later.
  us_student_visa: { isUsCitizen: false, isUsPerson: false, authorizedNow: true, sponsorNow: false, sponsorFuture: true },
  us_other_authorized: { isUsCitizen: false, isUsPerson: false, authorizedNow: true, sponsorNow: false, sponsorFuture: false },
  needs_sponsorship: { isUsCitizen: false, isUsPerson: false, authorizedNow: false, sponsorNow: true, sponsorFuture: true },
};

// ---------------------------------------------------------------------------
// Clearance wording found in free text (resume bullets, certifications, skills)
// ---------------------------------------------------------------------------

const CLEARANCE_TEXT_LEVELS: { level: ClearanceLevel; pattern: RegExp }[] = [
  { level: 'ts_sci', pattern: /\bts\s*\/\s*sci\b|\btop\s+secret\s*\/\s*sci\b|\bsci\s+(?:access|eligib)/i },
  { level: 'top_secret', pattern: /\btop\s+secret\b|\bts\s+clearance\b/i },
  { level: 'secret', pattern: /\bsecret\b/i },
  { level: 'confidential', pattern: /\bconfidential\s+clearance\b/i },
  { level: 'public_trust', pattern: /\bpublic\s+trust\b/i },
];

const CLEARANCE_WORD_RE = /\bclearance\b|\bcleared\b/i;
/** Levels unambiguous enough to believe without the word "clearance" nearby. */
const CLEARANCE_UNAMBIGUOUS_RE = /\bts\s*\/\s*sci\b|\btop\s+secret\s*\/\s*sci\b|\bpublic\s+trust\b/i;
const CLEARANCE_INACTIVE_RE = /\b(?:inactive|expired|lapsed|former(?:ly)?|previously\s+held)\b/i;
const POLYGRAPH_FULL_RE = /\bfull[- ]scope\s+poly|\bfsp\b|\blifestyle\s+poly/i;
const POLYGRAPH_CI_RE = /\bci\s+poly|\bcounter\s*intelligence\s+poly/i;

/** Highest clearance level named in `text`, if any. */
export function parseClearanceLevel(text: string): ClearanceLevel | undefined {
  if (!text) return undefined;
  for (const { level, pattern } of CLEARANCE_TEXT_LEVELS) {
    if (pattern.test(text)) return level;
  }
  return undefined;
}

export function parsePolygraph(text: string): PolygraphType | undefined {
  if (!text) return undefined;
  if (POLYGRAPH_FULL_RE.test(text)) return 'full_scope';
  if (POLYGRAPH_CI_RE.test(text)) return 'ci';
  return undefined;
}

/**
 * Reads a clearance out of free text such as "Active TS/SCI clearance".
 * Returns undefined when the text never mentions one.
 */
export function parseClearanceFromText(text: string): ResolvedClearance | undefined {
  if (!text) return undefined;
  // "secret" on its own is ordinary English ("AWS Secret Manager"), so only
  // believe a level when the word "clearance" is nearby or the level is
  // unmistakable on its own (TS/SCI, Public Trust).
  const named = CLEARANCE_WORD_RE.test(text);
  if (!named && !CLEARANCE_UNAMBIGUOUS_RE.test(text)) return undefined;
  const level = named ? parseClearanceLevel(text) : parseClearanceLevel(text.match(CLEARANCE_UNAMBIGUOUS_RE)?.[0] || '');
  const resolved: ResolvedClearance = {
    status: CLEARANCE_INACTIVE_RE.test(text) ? 'inactive' : 'active',
    source: 'text',
  };
  if (level) resolved.level = level;
  const poly = parsePolygraph(text);
  if (poly) resolved.polygraph = poly;
  return resolved;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function hasAnswer(eligibility: ProfileEligibility | undefined): boolean {
  if (!eligibility) return false;
  const { workAuthorization, clearance, veteranStatus, disabilityStatus, requiresSponsorshipNow, requiresSponsorshipFuture, citizenships } = eligibility;
  return Boolean(
    (workAuthorization && workAuthorization !== 'prefer_not_to_say') ||
      (clearance && clearance.status !== 'none') ||
      (veteranStatus && veteranStatus !== 'prefer_not_to_say') ||
      (disabilityStatus && disabilityStatus !== 'prefer_not_to_say') ||
      requiresSponsorshipNow !== undefined ||
      requiresSponsorshipFuture !== undefined ||
      (citizenships || []).some((c) => c.trim()),
  );
}

/**
 * Normalises everything the profile knows about eligibility.
 *
 * Precedence: the eligibility block wins, then the legacy `story.authorizedToWork`
 * / `story.needsSponsorship` answers, then clearance wording found in skills and
 * certifications (so profiles written before this section existed keep working).
 */
export function resolveEligibility(profile: UserProfile | null | undefined): ResolvedEligibility {
  const eligibility = profile?.eligibility;
  const story = profile?.story;
  const resolved: ResolvedEligibility = {
    citizenships: (eligibility?.citizenships || []).map((c) => c.trim()).filter(Boolean),
    isEmpty: !hasAnswer(eligibility),
  };

  // ----- work authorization ------------------------------------------------
  const auth = eligibility?.workAuthorization;
  if (auth && auth !== 'prefer_not_to_say') {
    const facts = AUTHORIZATION_FACTS[auth];
    resolved.workAuthorization = auth;
    resolved.isUsCitizen = facts.isUsCitizen;
    resolved.isUsPerson = facts.isUsPerson;
    resolved.authorizedNow = facts.authorizedNow;
    resolved.needsSponsorshipNow = facts.sponsorNow;
    resolved.needsSponsorshipFuture = facts.sponsorFuture;
  }
  if (eligibility?.visaType) resolved.visaType = eligibility.visaType;

  // A citizenship list can confirm US citizenship even without the dropdown.
  if (resolved.isUsCitizen === undefined && resolved.citizenships.length > 0) {
    const us = resolved.citizenships.some((c) => /^(?:us|u\.s\.|usa|u\.s\.a\.|united\s+states(?:\s+of\s+america)?|american)$/i.test(c));
    if (us) {
      resolved.isUsCitizen = true;
      resolved.isUsPerson = true;
      if (resolved.authorizedNow === undefined) resolved.authorizedNow = true;
    }
  }

  // Explicit sponsorship answers always win over the derived defaults.
  if (eligibility?.requiresSponsorshipNow !== undefined) resolved.needsSponsorshipNow = eligibility.requiresSponsorshipNow;
  if (eligibility?.requiresSponsorshipFuture !== undefined) resolved.needsSponsorshipFuture = eligibility.requiresSponsorshipFuture;

  // Legacy story flags fill in anything still unknown.
  if (resolved.authorizedNow === undefined && story?.authorizedToWork !== undefined) {
    resolved.authorizedNow = story.authorizedToWork;
  }
  if (resolved.needsSponsorshipNow === undefined && story?.needsSponsorship !== undefined) {
    resolved.needsSponsorshipNow = story.needsSponsorship;
  }
  if (resolved.needsSponsorshipFuture === undefined && story?.needsSponsorship !== undefined) {
    resolved.needsSponsorshipFuture = story.needsSponsorship;
  }

  // ----- clearance ---------------------------------------------------------
  const declared = eligibility?.clearance;
  if (declared && declared.status !== 'none' && declared.level !== 'none') {
    const clearance: ResolvedClearance = { level: declared.level, status: declared.status, source: 'declared' };
    if (declared.polygraph) clearance.polygraph = declared.polygraph;
    resolved.clearance = clearance;
  } else if (!declared) {
    // Nothing declared: fall back to wording in skills / certifications.
    const text = [
      ...(profile?.skills || []).map((s) => s.name),
      ...(profile?.certifications || []).map((c) => [c.name, c.issuer].filter(Boolean).join(' ')),
    ].join('\n');
    const parsed = parseClearanceFromText(text);
    if (parsed) resolved.clearance = parsed;
  }

  // ----- self-identification ----------------------------------------------
  const veteran = eligibility?.veteranStatus;
  if (veteran && veteran !== 'prefer_not_to_say') {
    resolved.isVeteran = veteran !== 'not_a_veteran';
    resolved.isProtectedVeteran = veteran === 'protected_veteran';
  }
  const disability = eligibility?.disabilityStatus;
  if (disability && disability !== 'prefer_not_to_say') {
    resolved.hasDisability = disability === 'yes';
  }

  return resolved;
}

export function clearanceLabel(clearance: ResolvedClearance | undefined): string {
  if (!clearance) return 'none';
  const level = clearance.level ? CLEARANCE_LABEL[clearance.level] : 'unspecified-level';
  const status = clearance.status === 'active' ? 'active' : clearance.status;
  return `${status} ${level}`;
}
