/**
 * Turns a scraped `JobPosting` into a structured `JobRequirements` record
 * that the fit factors score against. Deterministic regex/lexicon work only.
 */
import { JobPosting } from '../../types/job';
import { DegreeLevel } from '../../types/profile';
import { extractSkillsFromText } from '../../content/scrapers/keywordExtractor';
import { isKeywordPresent } from '../scoring/keywordMatcher';
import { extractRequiredYearsFromJob } from '../scoring/relevanceScorer';
import { extractThemesFromText } from './themes';
import { canonicalSkill, isAmbiguousSkillConfirmed } from './skillNames';
import { DEGREE_RANK } from './profileSignals';

export type RoleLevel = 'internship' | 'new_grad' | 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';
export type RemoteMode = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type JobEmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract' | 'unknown';

export interface GraduationWindow {
  minYear: number;
  maxYear: number;
}

export interface JobRequirements {
  /** Canonical lowercase skill ids the posting treats as required. */
  requiredSkills: string[];
  /** Canonical lowercase skill ids that are preferred / merely mentioned. */
  niceToHaveSkills: string[];
  requiredYears?: number;
  minDegree?: DegreeLevel;
  /** True when the degree is worded as a hard requirement (not "preferred" / "or equivalent experience"). */
  degreeRequired: boolean;
  roleLevel: RoleLevel;
  graduationWindow?: GraduationWindow;
  requiresClearance: boolean;
  /** True when the posting says it will not sponsor visas. */
  requiresSponsorshipUnavailable: boolean;
  remote: RemoteMode;
  locations: string[];
  employmentType: JobEmploymentType;
  themes: string[];
  certificationsMentioned: string[];
}

// ---------------------------------------------------------------------------
// Certification lexicon (shared with the certifications factor)
// ---------------------------------------------------------------------------

export interface CertificationDefinition {
  /** Short label, also used as the id in `certificationsMentioned`. */
  label: string;
  pattern: RegExp;
}

export const CERTIFICATION_LEXICON: CertificationDefinition[] = [
  { label: 'AWS', pattern: /\baws\s+certif|\baws\s+(?:certified\s+)?(?:solutions?\s+architect|developer|sysops|devops|cloud\s+practitioner)|\bsolutions?\s+architect\s+(?:associate|professional)\b/i },
  { label: 'GCP', pattern: /\b(?:google\s+cloud|gcp)\s+(?:certif|professional|associate)|\bprofessional\s+cloud\s+(?:architect|engineer|developer)|\bgoogle\s+certified\b/i },
  { label: 'Azure', pattern: /\bazure\s+(?:certif|administrator|solutions?\s+architect|fundamentals|developer)|\baz-\d{3}\b/i },
  { label: 'PMP', pattern: /\bpmp\b|\bproject\s+management\s+professional\b/i },
  { label: 'CPA', pattern: /\bcpa\b|\bcertified\s+public\s+accountant\b/i },
  { label: 'CFA', pattern: /\bcfa\b|\bchartered\s+financial\s+analyst\b/i },
  { label: 'CISSP', pattern: /\bcissp\b/i },
  { label: 'CISM', pattern: /\bcism\b/i },
  { label: 'CISA', pattern: /\bcisa\b/i },
  { label: 'CEH', pattern: /\bceh\b|\bcertified\s+ethical\s+hacker\b/i },
  { label: 'OSCP', pattern: /\boscp\b/i },
  { label: 'Security+', pattern: /\bsecurity\s*\+|\bsecurity\s+plus\b|\bsec\+/i },
  { label: 'Network+', pattern: /\bnetwork\s*\+|\bnetwork\s+plus\b/i },
  { label: 'A+', pattern: /\bcomptia\s+a\s*\+|(?:^|\s)a\+\s+certif/i },
  { label: 'CCNA', pattern: /\bccna\b/i },
  { label: 'CCNP', pattern: /\bccnp\b/i },
  { label: 'CKA', pattern: /\bcka\b|\bcertified\s+kubernetes\s+administrator\b/i },
  { label: 'CKAD', pattern: /\bckad\b|\bcertified\s+kubernetes\s+application\s+developer\b/i },
  { label: 'CKS', pattern: /\bcks\b/i },
  { label: 'Terraform Associate', pattern: /\bterraform\s+(?:associate|certif)/i },
  { label: 'Scrum Master', pattern: /\bcsm\b|\bcertified\s+scrum\s*master\b|\bpsm\s*(?:i|ii|1|2)?\b|\bscrum\s+master\s+certif/i },
  { label: 'SAFe', pattern: /\bsafe\s+(?:agilist|certif|practitioner)|\bcertified\s+safe\b/i },
  { label: 'Six Sigma', pattern: /\bsix\s+sigma\b|\blean\s+six\b/i },
  { label: 'ITIL', pattern: /\bitil\b/i },
  { label: 'Salesforce', pattern: /\bsalesforce\s+(?:certif|administrator|admin\b|developer)/i },
  { label: 'Databricks', pattern: /\bdatabricks\s+certif/i },
  { label: 'Snowflake', pattern: /\bsnowpro\b|\bsnowflake\s+certif/i },
  { label: 'Tableau', pattern: /\btableau\s+(?:desktop\s+)?(?:specialist|certif)/i },
  { label: 'Series 7', pattern: /\bseries\s+7\b/i },
  { label: 'RN', pattern: /\bregistered\s+nurse\b|(?:^|\s)rn\s+licens/i },
];

/** Labels of all certifications whose pattern hits `text`. */
export function matchCertifications(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const def of CERTIFICATION_LEXICON) {
    if (def.pattern.test(text)) out.push(def.label);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Section / sentence classification
// ---------------------------------------------------------------------------

type SectionMode = 'required' | 'nice' | 'other';

const NICE_HEADER = /\b(?:nice[- ]to[- ]haves?|preferred(?:\s+(?:qualifications?|skills?|experience))?|bonus(?:\s+(?:points?|skills?|qualifications?))?|pluse?s|a\s+plus|great\s+to\s+have|good\s+to\s+have|desirable|advantageous|extra\s+credit|not\s+required\s+but|optional|additional\s+qualifications|would\s+be\s+(?:a\s+)?(?:plus|bonus|great))\b/i;

const REQUIRED_HEADER = /\b(?:requirements?|qualifications?|must[- ]haves?|what\s+(?:you|you'll|you\s+will|we)\s+(?:need|bring|require|expect|are\s+looking\s+for|look\s+for)|what\s+we(?:'re|\s+are)\s+looking\s+for|who\s+you\s+are|required\s+skills|minimum|basic\s+qualifications|you\s+(?:have|bring|must|need|will\s+need|should\s+have)|skills\s+(?:&|and)\s+experience|your\s+(?:background|profile|experience)|essentials?|the\s+ideal\s+candidate|about\s+you|you'll\s+need|we\s+require)\b/i;

const OTHER_HEADER = /\b(?:responsibilities|what\s+you'll\s+do|what\s+you\s+will\s+do|about\s+(?:us|the\s+(?:role|team|company|job|position))|the\s+role|your\s+(?:role|mission|impact)|benefits|perks|compensation|salary|why\s+(?:join|us|work)|our\s+(?:stack|values|culture|mission|team)|equal\s+opportunity|day[- ]to[- ]day|in\s+this\s+role|you\s+will|duties|overview|job\s+description|the\s+team|about\s+the|the\s+opportunity|what\s+we\s+offer|how\s+you'll\s+(?:contribute|make))\b/i;

const NICE_INLINE = /\b(?:nice[- ]to[- ]have|preferred|bonus|(?:is|are|would\s+be)\s+(?:a\s+)?(?:big\s+|huge\s+|strong\s+)?plus|a\s+plus\b|great\s+to\s+have|good\s+to\s+have|desirable|advantageous|not\s+required|optional|familiarity\s+with|exposure\s+to|ideally|helpful\s+but)\b/i;

const REQUIRED_STRONG_INLINE = /\b(?:required|must\s+have|must\s+be|mandatory|minimum\s+of|at\s+least|need\s+to\s+have|essential|prerequisite|requires?\b)/i;

function segmentText(text: string): string[] {
  return text
    .split(/\r?\n+|(?<=[.!?;:])\s+|\s*[•·●▪‣◦∙]\s*|\s+[-–—]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

interface Buckets {
  required: string[];
  nice: string[];
  other: string[];
  hasRequiredSection: boolean;
}

function bucketSegments(description: string, qualifications: string[]): Buckets {
  const buckets: Buckets = { required: [], nice: [], other: [], hasRequiredSection: false };
  let mode: SectionMode = 'other';
  for (const seg of segmentText(description)) {
    const isShort = seg.length <= 70 && wordCount(seg) <= 8;
    if (isShort) {
      if (NICE_HEADER.test(seg)) {
        mode = 'nice';
        buckets.nice.push(seg);
        continue;
      }
      if (REQUIRED_HEADER.test(seg)) {
        mode = 'required';
        buckets.hasRequiredSection = true;
        buckets.required.push(seg);
        continue;
      }
      if (OTHER_HEADER.test(seg)) {
        mode = 'other';
        buckets.other.push(seg);
        continue;
      }
    }
    let segMode: SectionMode = mode;
    if (NICE_INLINE.test(seg)) segMode = 'nice';
    else if (mode === 'other' && REQUIRED_STRONG_INLINE.test(seg)) {
      segMode = 'required';
      buckets.hasRequiredSection = true;
    }
    buckets[segMode].push(seg);
  }
  for (const q of qualifications) {
    const seg = q.trim();
    if (!seg) continue;
    if (NICE_INLINE.test(seg)) buckets.nice.push(seg);
    else {
      buckets.required.push(seg);
      buckets.hasRequiredSection = true;
    }
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Degree / graduation
// ---------------------------------------------------------------------------

const PHD_RE = /\b(?:ph\.?\s?d\.?|doctorate|doctoral)\b/i;
const MASTER_RE = /\bmaster(?:'s|s|’s)?\b|\bm\.s\.?(?=[\s,/)]|$)|\bmsc\b|\bmeng\b|\bmba\b|\bm\.eng\b/i;
const MASTER_ABBR_RE = /\bMS(?=\s*(?:\/|or\b|,|in\b|degree|\)))|\/\s*MS\b/;
const BACHELOR_RE = /\bbachelor(?:'s|s|’s)?\b|\bundergraduate\b|\bbsc\b|\bbeng\b|\bb\.s\.?(?=[\s,/)]|$)|\bb\.a\.?(?=[\s,/)]|$)|\bb\.eng\b/i;
const BACHELOR_ABBR_RE = /\b(?:BS|BA|BSc|BEng)\b/;
const ASSOCIATE_RE = /\bassociate(?:'s|s|’s)?\s+degree\b/i;
const HIGH_SCHOOL_RE = /\bhigh\s+school\b|\bged\b/i;
const GENERIC_DEGREE_RE = /\b(?:college|university)\s+degree\b|\bdegree\s+in\b|\btechnical\s+degree\b|\bdegree\s+(?:required|preferred)\b/i;
const PURSUING_RE = /\bcurrently\s+(?:pursuing|enrolled)|\bpursuing\s+(?:a|an)\b|\benrolled\s+in\b|\bworking\s+toward|\bin\s+(?:the\s+)?process\s+of\s+(?:obtaining|completing)|\bstudent\b|\bstudents\b/i;
const EQUIVALENT_RE = /\bor\s+equivalent\b|\bequivalent\s+(?:practical\s+|work\s+|professional\s+)?experience\b|\bin\s+lieu\s+of\b|\bor\s+relevant\s+experience\b/i;
const DEGREE_CONTEXT_RE = /\bdegree|\bbachelor|\bmaster|\bph\.?d|\bdoctor|\bundergraduate|\bgraduate\b|\b(?:BS|BA|MS)\b/i;

function detectMinDegree(text: string): DegreeLevel | undefined {
  const candidates: DegreeLevel[] = [];
  if (PHD_RE.test(text)) candidates.push('phd');
  if (MASTER_RE.test(text) || MASTER_ABBR_RE.test(text)) candidates.push('master');
  if (BACHELOR_RE.test(text) || BACHELOR_ABBR_RE.test(text)) candidates.push('bachelor');
  if (ASSOCIATE_RE.test(text)) candidates.push('associate');
  if (HIGH_SCHOOL_RE.test(text)) candidates.push('high_school');
  if (candidates.length === 0 && GENERIC_DEGREE_RE.test(text)) candidates.push('bachelor');
  if (candidates.length === 0) return undefined;
  // The minimum acceptable degree is the lowest level the posting mentions.
  return candidates.reduce((lo, lvl) => (DEGREE_RANK[lvl] < DEGREE_RANK[lo] ? lvl : lo));
}

const MONTH_WORD = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)';
const GRAD_RANGE_RE = new RegExp(
  `(?:graduat\\w*|class\\s+of)[^.]{0,60}?\\b(?:${MONTH_WORD}\\s+)?(20\\d{2})\\s*(?:-|–|—|to|and|through|or)\\s*(?:${MONTH_WORD}\\s+)?(20\\d{2})`,
  'i',
);
const GRAD_SINGLE_RE = new RegExp(`(?:graduat\\w*|class\\s+of)[^.]{0,40}?\\b(?:${MONTH_WORD}\\s+)?(20\\d{2})\\b`, 'i');
const RISING_RE = /\brising\s+(sophomore|junior|senior)s?\b/i;
const SEASON_YEAR_RE = /\b(?:summer|spring|fall|autumn|winter)\s+(?:of\s+)?(20\d{2})\b/i;

function scrapedDate(job: JobPosting): Date {
  const d = new Date(job.scrapedAt || '');
  return isNaN(d.getTime()) ? new Date() : d;
}

function detectGraduationWindow(text: string, job: JobPosting): GraduationWindow | undefined {
  const scraped = scrapedDate(job);
  const scrapedYear = scraped.getFullYear();
  const plausible = (y: number) => y >= scrapedYear - 2 && y <= scrapedYear + 6;

  const range = text.match(GRAD_RANGE_RE);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (plausible(a) && plausible(b)) return { minYear: Math.min(a, b), maxYear: Math.max(a, b) };
  }
  const single = text.match(GRAD_SINGLE_RE);
  if (single) {
    const y = parseInt(single[1], 10);
    if (plausible(y)) return { minYear: y, maxYear: y };
  }
  const rising = text.match(RISING_RE);
  if (rising) {
    const season = text.match(SEASON_YEAR_RE);
    let programYear = season ? parseInt(season[1], 10) : scrapedYear + (scraped.getMonth() + 1 >= 7 ? 1 : 0);
    if (!plausible(programYear)) programYear = scrapedYear;
    const offset = { senior: 1, junior: 2, sophomore: 3 }[rising[1].toLowerCase()] ?? 1;
    const y = programYear + offset;
    return { minYear: y, maxYear: y };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Role level / employment / remote / blockers
// ---------------------------------------------------------------------------

const TITLE_INTERN_RE = /\bintern(?:ship)?s?\b|\bco-?op\b/i;
const TITLE_LEAD_RE = /\b(?:staff|principal|lead|director|head\s+of|head\b|vp|vice\s+president|chief|architect|distinguished|fellow)\b|\b(?:engineering|technical|development|dev|software)\s+manager\b/i;
const TITLE_SENIOR_RE = /\bsenior\b|\bsr\.?\b|\biii\b|\biv\b/i;
const NEW_GRAD_RE = /\bnew\s*grad(?:uate)?s?\b|\brecent\s+graduates?\b|\buniversity\s+grad(?:uate)?s?\b|\bearly[- ]career\b|\bgraduate\s+(?:program|scheme|hire|engineer|developer|analyst)\b|\bcampus\s+hire\b/i;
const ENTRY_LEVEL_RE = /\bentry[- ]level\b/i;
const TITLE_JUNIOR_RE = /\bjunior\b|\bjr\.?\b|\bassociate\b(?!\s+degree)|\bentry\b|\b(?:engineer|developer|analyst)\s+i\b/i;
const TEXT_INTERN_RE = /\binternship\b|\bsummer\s+intern|\bintern\s+program/i;

function detectRoleLevel(job: JobPosting, text: string, pursuing: boolean, gradWindow?: GraduationWindow, requiredYears?: number): RoleLevel {
  const title = job.title || '';
  const seniority = (job.seniority || '').toLowerCase();
  if (TITLE_INTERN_RE.test(title)) return 'internship';
  if (TEXT_INTERN_RE.test(text) && (pursuing || gradWindow)) return 'internship';
  if (seniority.includes('internship')) return 'internship';
  if (TITLE_LEAD_RE.test(title)) return 'lead';
  if (TITLE_SENIOR_RE.test(title)) return 'senior';
  if (NEW_GRAD_RE.test(title)) return 'new_grad';
  if (TITLE_JUNIOR_RE.test(title)) return 'junior';
  if (NEW_GRAD_RE.test(text)) return 'new_grad';
  if (ENTRY_LEVEL_RE.test(title) || ENTRY_LEVEL_RE.test(text) || seniority.includes('entry level')) {
    return pursuing || gradWindow ? 'new_grad' : 'junior';
  }
  if (seniority.includes('director') || seniority.includes('executive')) return 'lead';
  if (seniority.includes('mid-senior')) return 'senior';
  if (seniority.includes('associate')) return 'junior';
  if (requiredYears !== undefined) {
    if (requiredYears >= 5) return 'senior';
    if (requiredYears >= 2) return 'mid';
    return 'junior';
  }
  return 'unknown';
}

const CLEARANCE_RE = /\bsecurity\s+clearance\b|\bts\/sci\b|\btop\s+secret\b|\bsecret\s+clearance\b|\bactive\s+clearance\b|\bclearance\s+(?:is\s+)?required\b|\bobtain\s+(?:and\s+maintain\s+)?(?:a\s+)?(?:security\s+)?clearance\b|\bpublic\s+trust\b|\bmust\s+be\s+(?:a\s+)?(?:u\.?s\.?|united\s+states)\s+citizen\b|\b(?:u\.?s\.?|united\s+states)\s+citizenship\s+(?:is\s+)?required\b|\bcitizenship\s+(?:is\s+)?required\b|\bonly\s+(?:u\.?s\.?|united\s+states)\s+citizens\b|\b(?:u\.?s\.?|united\s+states)\s+citizens\s+only\b|\bdod\s+(?:8570|clearance)\b/i;
const CLEARANCE_NEGATION_RE = /\bno\s+(?:security\s+)?clearance\s+(?:is\s+)?(?:required|needed|necessary)\b|\bclearance\s+(?:is\s+)?not\s+required\b|\bdoes\s+not\s+require\s+(?:a\s+)?(?:security\s+)?clearance\b/i;

const NO_SPONSORSHIP_RE = /(?:unable|not\s+able|will\s+not|won'?t|cannot|can'?t|does\s+not|do\s+not|doesn'?t|don'?t|not\s+in\s+a\s+position)\s+(?:to\s+)?(?:be\s+able\s+to\s+)?(?:currently\s+)?(?:offer|provide|sponsor|support|consider)\b[^.]{0,60}?\b(?:sponsorship|visas?|h-?1b|work\s+authorization)|\b(?:no|without)\s+(?:visa\s+|employment\s+|immigration\s+)?sponsorship\b|\bsponsorship\s+(?:is\s+)?(?:not|un)\s*available\b|\bnot\s+(?:eligible|available)\s+for\s+(?:visa\s+)?sponsorship\b|\bwithout\s+(?:the\s+need\s+for\s+|requiring\s+)?(?:visa\s+|employer\s+)?sponsorship\b|\bnot\s+require\s+(?:visa\s+|employer\s+|employment\s+)?sponsorship\b|\bwill\s+not\s+(?:now\s+or\s+in\s+the\s+future\s+)?sponsor\b/i;

function detectRemote(job: JobPosting, text: string): RemoteMode {
  switch (job.remoteStatus) {
    case 'Remote':
      return 'remote';
    case 'Hybrid':
      return 'hybrid';
    case 'On-site':
      return 'onsite';
    default:
      break;
  }
  const loc = (job.location || '').toLowerCase();
  if (/\bhybrid\b/.test(loc)) return 'hybrid';
  if (/\bremote\b/.test(loc)) return 'remote';
  if (/\bon-?site\b/.test(loc)) return 'onsite';
  const lower = text.toLowerCase();
  if (/\bhybrid\b/.test(lower)) return 'hybrid';
  const negRemote = /\b(?:not|no|isn't|is\s+not)\s+(?:a\s+)?(?:fully\s+)?remote\b/.test(lower);
  if (/\bremote\b/.test(lower) && !negRemote) return 'remote';
  if (/\bon-?site\b|\bin[- ]office\b|\bin[- ]person\b/.test(lower)) return 'onsite';
  return 'unknown';
}

function detectLocations(job: JobPosting): string[] {
  const raw = job.location || '';
  if (!raw) return [];
  return raw
    .split(/\s*(?:;|\||•|\/|\bor\b)\s*/i)
    .map((s) => s.replace(/\((?:remote|hybrid|on-?site)\)/gi, '').trim())
    .filter((s) => s && !/^(?:remote|hybrid|on-?site|anywhere|worldwide|unspecified)$/i.test(s));
}

function detectEmploymentType(job: JobPosting, text: string, roleLevel: RoleLevel): JobEmploymentType {
  const title = job.title || '';
  const lower = text.toLowerCase();
  if (roleLevel === 'internship') return 'internship';
  if (/\bpart[- ]time\b/i.test(title)) return 'part_time';
  if (/\bcontract(?:or)?\b|\bfreelance\b|\btemporary\b|\btemp\b/i.test(title)) return 'contract';
  const hasFull = /\bfull[- ]time\b/.test(lower);
  const strongContract = /\bcontract[- ]to[- ]hire\b|\bcontractor\b|\bcontract\s+(?:position|role|basis|assignment)\b|\b\d+[- ]month\s+contract\b|\bc2c\b|\bw2\s+contract\b|\b1099\b|\bfreelance\b/.test(lower);
  if (strongContract) return 'contract';
  if (hasFull) return 'full_time';
  if (/\bpart[- ]time\b/.test(lower)) return 'part_time';
  if (/\bcontract\b/.test(lower)) return 'contract';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Years
// ---------------------------------------------------------------------------

const YEARS_FALLBACK_RE = /(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2})?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional|industry|relevant|hands-on|software|engineering|work|commercial|full[- ]time|in\b|building|developing|working|designing)/i;

function detectRequiredYears(text: string, qualifications: string[]): number | undefined {
  const joined = `${text} ${qualifications.join('. ')}`;
  let years = extractRequiredYearsFromJob(joined);
  if (years === undefined) {
    const m = joined.match(YEARS_FALLBACK_RE);
    if (m) years = parseInt(m[1], 10);
  }
  if (years === undefined || isNaN(years)) return undefined;
  return Math.min(20, years);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function extractJobRequirements(job: JobPosting): JobRequirements {
  const description = job.description || '';
  const qualifications = job.qualifications || [];
  const fullText = [job.title || '', description, ...qualifications].join('\n');

  const buckets = bucketSegments(description, qualifications);
  const requiredText = buckets.required.join('\n');
  const niceText = buckets.nice.join('\n');
  const otherText = buckets.other.join('\n');

  // ----- skills -----
  const explicit = new Set((job.requiredSkills || []).map(canonicalSkill).filter(Boolean));
  // "security clearance" / "security clearances" must not surface a "security" skill.
  const skillText = fullText.replace(/\bsecurity\s+clearances?\b/gi, ' ');
  const extracted = extractSkillsFromText(skillText).map(canonicalSkill);
  const candidates = new Set<string>([...explicit, ...extracted]);
  const requiredSkills: string[] = [];
  const niceToHaveSkills: string[] = [];
  for (const skill of candidates) {
    // Ambiguous English words ("go", "rust", "express") only count when the
    // text uses them as a technology — unless they were listed explicitly and
    // never appear in the text at all (a curated / manual posting).
    if (!isAmbiguousSkillConfirmed(skill, skillText) && (!explicit.has(skill) || isKeywordPresent(skill, skillText))) continue;
    const inRequired = requiredText.length > 0 && isKeywordPresent(skill, requiredText);
    const inNice = !inRequired && niceText.length > 0 && isKeywordPresent(skill, niceText);
    const inOther = !inRequired && !inNice && otherText.length > 0 && isKeywordPresent(skill, otherText);
    const inTitle = isKeywordPresent(skill, job.title || '');
    let required: boolean;
    if (inRequired || inTitle) required = true;
    else if (inNice) required = false;
    else if (inOther) required = buckets.hasRequiredSection ? false : explicit.has(skill);
    else required = explicit.has(skill);
    (required ? requiredSkills : niceToHaveSkills).push(skill);
  }
  requiredSkills.sort();
  niceToHaveSkills.sort();

  // ----- years / degree / graduation -----
  const requiredYears = detectRequiredYears(description, qualifications);
  const degreeSegments = [...buckets.required, ...buckets.nice, ...buckets.other].filter((s) => DEGREE_CONTEXT_RE.test(s));
  const degreeText = degreeSegments.join('\n');
  const minDegree = detectMinDegree(degreeText || fullText);
  const pursuing = PURSUING_RE.test(fullText);
  const graduationWindow = detectGraduationWindow(fullText, job);
  let degreeRequired = false;
  if (minDegree) {
    const requiredDegreeSegs = buckets.required.filter((s) => DEGREE_CONTEXT_RE.test(s));
    degreeRequired = requiredDegreeSegs.some((s) => !EQUIVALENT_RE.test(s) && !NICE_INLINE.test(s));
    if (!degreeRequired) {
      degreeRequired = degreeSegments.some((s) => /\brequired\b|\bmust\b/i.test(s) && !EQUIVALENT_RE.test(s) && !NICE_INLINE.test(s));
    }
  }

  const roleLevel = detectRoleLevel(job, fullText, pursuing, graduationWindow, requiredYears);

  // ----- blockers -----
  const requiresClearance = CLEARANCE_RE.test(fullText) && !CLEARANCE_NEGATION_RE.test(fullText);
  const requiresSponsorshipUnavailable = NO_SPONSORSHIP_RE.test(fullText);

  // ----- logistics -----
  const remote = detectRemote(job, fullText);
  const locations = detectLocations(job);
  const employmentType = detectEmploymentType(job, fullText, roleLevel);

  // ----- narrative -----
  const themes = extractThemesFromText(fullText);
  const certificationsMentioned = matchCertifications(fullText);

  return {
    requiredSkills,
    niceToHaveSkills,
    requiredYears,
    minDegree,
    degreeRequired,
    roleLevel,
    graduationWindow,
    requiresClearance,
    requiresSponsorshipUnavailable,
    remote,
    locations,
    employmentType,
    themes,
    certificationsMentioned,
  };
}
