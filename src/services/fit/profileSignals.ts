/**
 * Profile-side signals (years of experience, degree rank, title tokens) used
 * by several fit factors. Pure functions, no I/O.
 */
import { DegreeLevel, ProfileExperience, UserProfile } from '../../types/profile';

/** Ordinal degree ladder. `other` is ranked with associate. */
export const DEGREE_RANK: Record<DegreeLevel, number> = {
  high_school: 0,
  associate: 1,
  other: 1,
  bootcamp: 2,
  bachelor: 3,
  master: 4,
  phd: 5,
};

export const DEGREE_LABEL: Record<DegreeLevel, string> = {
  high_school: 'High school',
  associate: "Associate's",
  other: 'Other',
  bootcamp: 'Bootcamp',
  bachelor: "Bachelor's",
  master: "Master's",
  phd: 'PhD',
};

/** Multiplier applied to the duration of each experience type when totalling years. */
const EXPERIENCE_TYPE_WEIGHT: Record<string, number> = {
  full_time: 1,
  contract: 1,
  research: 1,
  freelance: 1,
  part_time: 0.5,
  volunteer: 0.5,
  internship: 0.5,
  project: 0.25,
};

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

/** Parses "YYYY-MM", "YYYY/MM", "MM/YYYY", "Jan 2021", "2021". Returns undefined when no 4-digit year is present. */
export function parseYearMonth(value?: string): YearMonth | undefined {
  if (!value) return undefined;
  const yearMatch = value.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return undefined;
  const year = parseInt(yearMatch[1], 10);
  let month = 1;
  const iso = value.match(/\b(?:19|20)\d{2}[-/](\d{1,2})\b/);
  const usa = value.match(/\b(\d{1,2})[-/](?:19|20)\d{2}\b/);
  const named = value.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  if (iso) month = parseInt(iso[1], 10);
  else if (usa) month = parseInt(usa[1], 10);
  else if (named) {
    month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(named[1].toLowerCase()) + 1;
  }
  if (month < 1 || month > 12) month = 1;
  return { year, month };
}

function monthsBetween(start: YearMonth, end: YearMonth): number {
  return Math.max(0, (end.year - start.year) * 12 + (end.month - start.month));
}

/** Duration of one experience in years, before type weighting. Undated entries count as one year. */
export function experienceDurationYears(exp: ProfileExperience, now: Date): number {
  const start = parseYearMonth(exp.startDate);
  const nowYm: YearMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const end = exp.isCurrent ? nowYm : parseYearMonth(exp.endDate) || (start ? undefined : nowYm);
  if (!start) return 1;
  if (!end) return 1;
  const months = monthsBetween(start, end);
  // A dated entry spanning zero months (same month) still represents some work.
  return Math.min(40, Math.max(1 / 12, months / 12));
}

/** Weighted total years of experience: internships x0.5, part-time/volunteer x0.5, projects x0.25. */
export function computeProfileYears(profile: UserProfile, now: Date): number {
  let total = 0;
  for (const exp of profile.experiences || []) {
    const weight = EXPERIENCE_TYPE_WEIGHT[exp.type || 'full_time'] ?? 1;
    total += experienceDurationYears(exp, now) * weight;
  }
  return Math.round(total * 10) / 10;
}

/**
 * Highest degree rank in the profile. When `countInProgress` is false only
 * graduated entries count. Returns -1 when nothing qualifies.
 */
export function highestDegreeRank(profile: UserProfile, countInProgress: boolean): number {
  let best = -1;
  for (const edu of profile.education || []) {
    if (edu.status === 'in_progress' && !countInProgress) continue;
    best = Math.max(best, DEGREE_RANK[edu.degreeLevel] ?? 0);
  }
  return best;
}

export function degreeLevelForRank(rank: number): DegreeLevel | undefined {
  const entries = Object.entries(DEGREE_RANK) as [DegreeLevel, number][];
  const match = entries.find(([level, r]) => r === rank && level !== 'other');
  return match?.[0];
}

// ---------------------------------------------------------------------------
// Title tokens
// ---------------------------------------------------------------------------

/** Role nouns folded to a shared id so "developer" == "engineer" == "programmer". */
const ROLE_NOUN_ALIASES: Record<string, string> = {
  engineer: 'engineer',
  engineering: 'engineer',
  developer: 'engineer',
  development: 'engineer',
  programmer: 'engineer',
  sde: 'engineer',
  swe: 'engineer',
  analyst: 'analyst',
  analytics: 'analyst',
  manager: 'manager',
  management: 'manager',
  designer: 'designer',
  scientist: 'scientist',
  science: 'scientist',
  architect: 'architect',
  consultant: 'consultant',
  administrator: 'administrator',
  admin: 'administrator',
  researcher: 'researcher',
  intern: 'intern',
  internship: 'intern',
  specialist: 'specialist',
  technician: 'technician',
  sre: 'sre',
  devops: 'devops',
  pm: 'manager',
  founder: 'founder',
  director: 'director',
  writer: 'writer',
  recruiter: 'recruiter',
  accountant: 'accountant',
  nurse: 'nurse',
  teacher: 'teacher',
};

/** Domain adjectives, folded to a shared id. */
const DOMAIN_ALIASES: Record<string, string> = {
  frontend: 'frontend',
  'front-end': 'frontend',
  'front end': 'frontend',
  backend: 'backend',
  'back-end': 'backend',
  'back end': 'backend',
  fullstack: 'fullstack',
  'full-stack': 'fullstack',
  'full stack': 'fullstack',
  data: 'data',
  ml: 'ml',
  'machine learning': 'ml',
  ai: 'ai',
  mobile: 'mobile',
  ios: 'mobile',
  android: 'mobile',
  product: 'product',
  platform: 'platform',
  infrastructure: 'infrastructure',
  infra: 'infrastructure',
  cloud: 'cloud',
  security: 'security',
  embedded: 'embedded',
  firmware: 'embedded',
  web: 'web',
  software: 'software',
  systems: 'systems',
  system: 'systems',
  network: 'network',
  networking: 'network',
  qa: 'qa',
  test: 'qa',
  quality: 'qa',
  research: 'research',
  ux: 'design',
  ui: 'design',
  graphics: 'graphics',
  game: 'game',
  hardware: 'hardware',
  business: 'business',
  marketing: 'marketing',
  sales: 'sales',
  finance: 'finance',
  financial: 'finance',
  devops: 'devops',
  site: 'sre',
  reliability: 'sre',
  automation: 'automation',
  computer: 'software',
  application: 'software',
  applications: 'software',
  database: 'data',
  bi: 'data',
  operations: 'operations',
  ops: 'operations',
  support: 'support',
  it: 'it',
  compiler: 'systems',
  distributed: 'systems',
  robotics: 'robotics',
  blockchain: 'blockchain',
  'computer vision': 'ml',
  nlp: 'ml',
};

const TITLE_STOPWORDS = new Set([
  'senior', 'sr', 'junior', 'jr', 'staff', 'principal', 'lead', 'i', 'ii', 'iii', 'iv', 'v',
  'of', 'the', 'and', 'or', 'a', 'an', 'for', 'in', 'at', 'to', 'with', '-', '–', '—', 'level',
  'entry', 'new', 'grad', 'graduate', 'summer', 'fall', 'spring', 'winter', 'remote', 'hybrid',
  'us', 'usa', 'contract', 'time', 'full', 'part', 'co-op', 'coop',
]);

const YEAR_RE = /^(?:19|20)\d{2}$/;

/**
 * Extracts a set of comparable tokens from a job/experience title: role
 * nouns and domain adjectives folded to shared ids, plus any other
 * non-stopword words. Seniority modifiers are dropped.
 */
export function titleTokens(title: string): Set<string> {
  const out = new Set<string>();
  if (!title) return out;
  let lower = title.toLowerCase().replace(/\(.*?\)/g, ' ');
  // Multi-word aliases first.
  for (const [phrase, id] of Object.entries(DOMAIN_ALIASES)) {
    if (phrase.includes(' ') || phrase.includes('-')) {
      if (lower.includes(phrase)) {
        out.add(id);
        lower = lower.split(phrase).join(' ');
      }
    }
  }
  const words = lower.split(/[^a-z0-9+#.]+/).filter(Boolean);
  for (const word of words) {
    if (TITLE_STOPWORDS.has(word) || YEAR_RE.test(word)) continue;
    if (ROLE_NOUN_ALIASES[word]) out.add(ROLE_NOUN_ALIASES[word]);
    else if (DOMAIN_ALIASES[word]) out.add(DOMAIN_ALIASES[word]);
    else if (word.length > 2) out.add(word);
  }
  return out;
}

/** Fraction (0-1) of the job-title tokens covered by the candidate title. */
export function titleSimilarity(jobTitle: string, candidateTitle: string): number {
  const a = titleTokens(jobTitle);
  const b = titleTokens(candidateTitle);
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / a.size;
}

/** Best title similarity across a list of candidate titles. */
export function bestTitleSimilarity(jobTitle: string, candidates: string[]): { score: number; title?: string } {
  let best = { score: 0, title: undefined as string | undefined };
  for (const c of candidates) {
    const s = titleSimilarity(jobTitle, c);
    if (s > best.score) best = { score: s, title: c };
  }
  return best;
}
