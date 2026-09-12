/**
 * Reads work-eligibility facts out of resume text.
 *
 * Candidates who hold a clearance, are veterans, or are on a visa usually say
 * so on the resume itself, so an import can pre-fill the eligibility section
 * instead of asking again. Everything here is conservative: only unambiguous
 * wording counts, and `mergeEligibility` never lets an inference overwrite an
 * answer the user typed.
 *
 * Disability status is deliberately never inferred — it is a voluntary
 * self-identification that only the user may set.
 */
import { ProfileEligibility, VisaType, WorkAuthorization } from '../../types/profile';
import { parseClearanceFromText } from '../fit/eligibilitySignals';

const US_CITIZEN_RE = /\b(?:u\.?s\.?|united\s+states|american)\s+citizen(?:ship)?\b|\bcitizen\s+of\s+the\s+united\s+states\b/i;
const PERMANENT_RESIDENT_RE = /\bpermanent\s+resident\b|\bgreen\s*card\b|\blawful\s+permanent\s+resident\b|\blpr\s+status\b/i;
const NO_SPONSORSHIP_NEEDED_RE = /\bauthorized\s+to\s+work\b[^.\n]{0,60}?\bwithout\s+(?:visa\s+|employer\s+)?sponsorship\b|\bdo(?:es)?\s+not\s+require\s+(?:visa\s+|employer\s+)?sponsorship\b|\bno\s+sponsorship\s+required\b/i;

const VISA_PATTERNS: { visa: VisaType; authorization: WorkAuthorization; pattern: RegExp }[] = [
  { visa: 'f1_stem_opt', authorization: 'us_student_visa', pattern: /\bstem\s+opt\b/i },
  { visa: 'f1_opt', authorization: 'us_student_visa', pattern: /\bf-?1\s+(?:visa|status|opt)\b|\bopt\s+(?:eligible|authorization|status)\b|\bopt\s*\/\s*cpt\b|\boptional\s+practical\s+training\b/i },
  { visa: 'f1_cpt', authorization: 'us_student_visa', pattern: /\bcpt\b|\bcurricular\s+practical\s+training\b/i },
  { visa: 'h1b', authorization: 'us_work_visa', pattern: /\bh-?1b\b/i },
  { visa: 'h4_ead', authorization: 'us_other_authorized', pattern: /\bh-?4\s+ead\b/i },
  { visa: 'j1', authorization: 'us_student_visa', pattern: /\bj-?1\s+(?:visa|status)\b/i },
  { visa: 'l1', authorization: 'us_work_visa', pattern: /\bl-?1[ab]?\s+(?:visa|status)\b/i },
  { visa: 'tn', authorization: 'us_work_visa', pattern: /\btn\s+(?:visa|status)\b/i },
  { visa: 'e3', authorization: 'us_work_visa', pattern: /\be-?3\s+(?:visa|status)\b/i },
  { visa: 'o1', authorization: 'us_work_visa', pattern: /\bo-?1\s+(?:visa|status)\b/i },
  { visa: 'ead', authorization: 'us_other_authorized', pattern: /\bemployment\s+authorization\s+document\b|\bead\s+(?:card|holder)\b/i },
];

const VETERAN_RE = /\b(?:u\.?s\.?\s+)?(?:army|navy|air\s+force|marine\s+corps|marines|coast\s+guard|space\s+force|military)\s+veteran\b|\bveteran\s+of\s+the\b|\bhonorabl[ey]\s+discharg\w*|\bveteran\s+status:\s*(?:yes|protected)\b|\bdisabled\s+veteran\b|\bcombat\s+veteran\b/i;
const PROTECTED_VETERAN_RE = /\bprotected\s+veteran\b|\bdisabled\s+veteran\b|\brecently\s+separated\s+veteran\b/i;
/** "Department of Veterans Affairs" is an employer, not a claim of veteran status. */
const VETERAN_FALSE_POSITIVE_RE = /\b(?:department|dept\.?)\s+of\s+veterans?\s+affairs\b|\bveterans?\s+affairs\b|\bveterans?\s+(?:services|hospital|administration|benefits)\b/i;

/**
 * Best-effort eligibility facts from free resume text. Returns undefined when
 * the text says nothing about eligibility, so importers can leave the field off
 * the `ProfileImport` entirely.
 */
export function inferEligibilityFromText(text: string): ProfileEligibility | undefined {
  if (!text || !text.trim()) return undefined;
  const inferred: ProfileEligibility = {};

  // ---- work authorization -------------------------------------------------
  if (US_CITIZEN_RE.test(text)) {
    inferred.workAuthorization = 'us_citizen';
  } else if (PERMANENT_RESIDENT_RE.test(text)) {
    inferred.workAuthorization = 'us_permanent_resident';
  } else {
    const visa = VISA_PATTERNS.find((v) => v.pattern.test(text));
    if (visa) {
      inferred.workAuthorization = visa.authorization;
      inferred.visaType = visa.visa;
    } else if (NO_SPONSORSHIP_NEEDED_RE.test(text)) {
      // Authorized, but the wording does not say on what basis.
      inferred.requiresSponsorshipNow = false;
      inferred.requiresSponsorshipFuture = false;
    }
  }

  // ---- clearance ----------------------------------------------------------
  const clearance = parseClearanceFromText(text);
  if (clearance?.level) {
    inferred.clearance = { level: clearance.level, status: clearance.status };
    if (clearance.polygraph) inferred.clearance.polygraph = clearance.polygraph;
  }

  // ---- veteran status -----------------------------------------------------
  if (VETERAN_RE.test(text) && !VETERAN_FALSE_POSITIVE_RE.test(text)) {
    inferred.veteranStatus = PROTECTED_VETERAN_RE.test(text) ? 'protected_veteran' : 'veteran';
  }

  return Object.keys(inferred).length > 0 ? inferred : undefined;
}
