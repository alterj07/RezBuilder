/**
 * Pure line-level parsers for the 2026 LinkedIn profile layout.
 *
 * Every function here works on the visible text lines of a section (what
 * `innerText` yields, split on newlines) and never touches the DOM, so the
 * whole pipeline is unit-testable from string fixtures. Nothing in this file
 * throws on garbage input: unknown lines are ignored, not rejected.
 *
 * Line samples the parsers are built around (observed live, 2026-09-03):
 *   experience     `Software Engineer Intern` / `Date Maroon · Internship` /
 *                  `Jul 2026 - Present · 3 mos` / `Remote` / description… /
 *                  `Software Development, Product Testing and +1 skill`
 *   grouped roles  `Globex Corporation` / `Full-time · 3 yrs 2 mos` / `Title` / `Jul 2021 - Dec 2022 · 1 yr 6 mos`
 *   education      `Texas A&M University` / `Bachelor of Engineering, ENGINEERING` / `2026 – May 2030` / `Grade: 3.9`
 *   certifications `Name` / `Anthropic` / `Issued Jun 2026 · Expires Jun 2028` / `Credential ID …` / `Show credential` / `Skills: A, B`
 *   projects       `Savor` / `Jun 2026 – Present` / description… / `Google Cloud Vision, … and +7 skills`
 *   volunteering   `Care Team Leader` / `AUSTIN KOREAN PRESBYTERIAN CHURCH` / `Jun 2022 - May 2026 · 4 yrs` / `Social Services` / description
 *   skills         `Skills` / pills… / `Software Development` / `Software Engineer Intern at Maroon` / …
 */

import {
  ExperienceType,
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
} from '../../types/profile';
import {
  inferDegreeLevel,
  inferEducationStatus,
  inferExperienceType,
  normalizeDate,
  parseYear,
  splitIntoBullets,
} from '../../services/profile/inference';

// ---------------------------------------------------------------------------
// Basic line helpers
// ---------------------------------------------------------------------------

/** Collapses whitespace (including nbsp) and trims. */
export function cleanLine(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
}

const SEPARATOR = /\s*[·•]\s*/;

function splitOnDot(line: string): string[] {
  return line.split(SEPARATOR).map(cleanLine).filter(Boolean);
}

/** Sentence punctuation — but not the dots inside "React.js" / "ASP.NET". */
const SENTENCE_PUNCTUATION = /[!?;:]|\.\s|\.$/;
const TERMINAL_PUNCTUATION = /[.!?]$/;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export interface ParsedDateRange {
  /** "YYYY-MM" or "YYYY". */
  start?: string;
  end?: string;
  isCurrent: boolean;
  /** e.g. "3 mos", "2 yrs 3 mos". */
  durationText?: string;
}

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const YEAR = '(?:19[5-9]\\d|20\\d{2})';
const SINGLE_DATE = `(?:(${MONTH})\\.?\\s+)?(${YEAR})`;
const PRESENT = '(?:present|current|now|ongoing|today)';

const RANGE_PATTERN = new RegExp(
  `^(?:issued\\s+)?${SINGLE_DATE}(?:\\s*[-–—]\\s*(?:${SINGLE_DATE}|(${PRESENT})))?$`,
  'i'
);
const EXPIRES_PATTERN = new RegExp(`^(?:expires?|expired|expiration|valid until)\\s+${SINGLE_DATE}$`, 'i');
const DURATION_PATTERN = /^(?:(?:\d+\s*(?:yrs?|years?|mos?|months?)\s*)+|less than a year)$/i;

function toIsoDate(month: string | undefined, year: string): string | undefined {
  return normalizeDate(month ? `${month} ${year}` : year);
}

/**
 * Parses LinkedIn's date lines: `Jul 2026 - Present · 3 mos`, `2026 – May 2030`,
 * `Jun 2026 – Present`, `Issued Jun 2026 · Expires Jun 2028`, `Expires Jun 2028`,
 * `2019`, `May 2019`. Returns null for anything that is not a date line.
 */
export function parseDateRange(raw: string): ParsedDateRange | null {
  const line = cleanLine(raw);
  if (!line || line.length > 80) return null;

  const parts = splitOnDot(line);
  if (parts.length === 0) return null;

  const result: ParsedDateRange = { isCurrent: false };
  let matched = false;

  for (const part of parts) {
    const range = RANGE_PATTERN.exec(part);
    if (range) {
      const [, startMonth, startYear, endMonth, endYear, present] = range;
      result.start = toIsoDate(startMonth, startYear);
      if (endYear) {
        result.end = toIsoDate(endMonth, endYear);
      } else if (present) {
        result.isCurrent = true;
      } else if (!/^issued/i.test(part) && !/[-–—]/.test(part)) {
        // A lone "May 2019" / "2019" is a point in time: start and end coincide.
        result.end = result.start;
      }
      matched = true;
      continue;
    }
    const expires = EXPIRES_PATTERN.exec(part);
    if (expires) {
      result.end = toIsoDate(expires[1], expires[2]);
      matched = true;
      continue;
    }
    if (DURATION_PATTERN.test(part)) {
      result.durationText = part;
      continue;
    }
    // Anything before the first date means this is not a date line
    // ("Full-time · 2 yrs"); trailing extras after a date are tolerated.
    if (!matched) return null;
  }

  return matched ? result : null;
}

export function isDateRangeLine(line: string): boolean {
  return parseDateRange(line) !== null;
}

// ---------------------------------------------------------------------------
// Employment types / company lines
// ---------------------------------------------------------------------------

const EMPLOYMENT_TYPES: { pattern: RegExp; type: ExperienceType }[] = [
  { pattern: /^full[\s-]?time$/i, type: 'full_time' },
  { pattern: /^permanent$/i, type: 'full_time' },
  { pattern: /^part[\s-]?time$/i, type: 'part_time' },
  { pattern: /^internship$/i, type: 'internship' },
  { pattern: /^apprenticeship$/i, type: 'internship' },
  { pattern: /^co-?op$/i, type: 'internship' },
  { pattern: /^contract$/i, type: 'contract' },
  { pattern: /^temporary$/i, type: 'contract' },
  { pattern: /^seasonal$/i, type: 'contract' },
  { pattern: /^freelance$/i, type: 'freelance' },
  { pattern: /^self[\s-]?employed$/i, type: 'freelance' },
  { pattern: /^volunteer$/i, type: 'volunteer' },
];

/** Maps one of LinkedIn's employment-type labels ("Internship") to an `ExperienceType`. */
export function employmentTypeOf(text: string): ExperienceType | undefined {
  const value = cleanLine(text);
  if (!value) return undefined;
  for (const { pattern, type } of EMPLOYMENT_TYPES) {
    if (pattern.test(value)) return type;
  }
  return undefined;
}

/** True for a line that is exactly an employment type ("Internship"). */
export function isEmploymentTypeLine(line: string): boolean {
  return employmentTypeOf(line) !== undefined;
}

/** `Full-time · 2 yrs 3 mos`, `2 yrs 3 mos`, `Internship · 3 mos` — the grouped-company header's second line. */
export function isDurationOnlyLine(raw: string): boolean {
  const line = cleanLine(raw);
  if (!line) return false;
  const parts = splitOnDot(line);
  let sawDuration = false;
  for (const part of parts) {
    if (DURATION_PATTERN.test(part)) {
      sawDuration = true;
    } else if (!isEmploymentTypeLine(part)) {
      return false;
    }
  }
  return sawDuration;
}

export interface ParsedCompanyLine {
  company: string;
  /** LinkedIn's label as displayed, e.g. "Internship". */
  employmentType?: string;
  /** The label mapped onto the profile vocabulary. */
  experienceType?: ExperienceType;
}

/** Splits `NASA - National Aeronautics and Space Administration · Internship` into company and type. */
export function parseCompanyLine(raw: string): ParsedCompanyLine {
  const line = cleanLine(raw);
  const parts = splitOnDot(line);
  const companyParts: string[] = [];
  let employmentType: string | undefined;
  let experienceType: ExperienceType | undefined;
  for (const part of parts) {
    const type = employmentTypeOf(part);
    if (type && companyParts.length > 0) {
      if (!employmentType) {
        employmentType = part;
        experienceType = type;
      }
      continue;
    }
    if (DURATION_PATTERN.test(part)) continue;
    companyParts.push(part);
  }
  return {
    company: companyParts.join(' · '),
    ...(employmentType ? { employmentType, experienceType } : {}),
  };
}

/** A company line is `Company · <employment type>`. */
export function isCompanyLine(line: string): boolean {
  const parsed = parseCompanyLine(line);
  return !!parsed.company && !!parsed.employmentType;
}

// ---------------------------------------------------------------------------
// Skills lines
// ---------------------------------------------------------------------------

const SKILLS_PREFIX = /^skills?\s*:\s*/i;
const PLUS_N_SKILLS = /^(.*?)(?:,\s*|\s+)and\s+\+\d+\s+(?:more\s+)?skills?$/i;
const TWO_ITEM_LIST = /^(.+?),?\s+and\s+([^,]+)$/;

function splitSkillList(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const piece of text.split(/\s*[,·•]\s*/)) {
    const name = cleanLine(piece);
    if (!name || name.length > 80) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function looksLikeSkillName(text: string): boolean {
  const value = cleanLine(text);
  if (!value || value.length > 60) return false;
  if (SENTENCE_PUNCTUATION.test(value)) return false;
  if (value.split(' ').length > 5) return false;
  return /^[A-Z0-9(]/.test(value) || /^[a-z]+(?:\.[a-z]+)+$/i.test(value); // "Machine Learning", "React.js", "iOS"
}

/**
 * Parses the skills line under an entry:
 *   `Skills: A, B`                       -> [A, B]
 *   `A, B and +3 skills`                 -> [A, B] (only the named ones)
 *   `A and B`                            -> [A, B] (when both halves look like skill names)
 * Returns null when the line is not recognisably a skills line. A bare single
 * skill name is indistinguishable from any other short line and is handled by
 * the entry parsers from its position instead.
 */
export function parseSkillsLine(raw: string): string[] | null {
  const line = cleanLine(raw);
  if (!line) return null;

  if (SKILLS_PREFIX.test(line)) {
    return splitSkillList(line.replace(SKILLS_PREFIX, ''));
  }
  const plusN = PLUS_N_SKILLS.exec(line);
  if (plusN) {
    return splitSkillList(plusN[1]);
  }
  if (line.length <= 120 && !SENTENCE_PUNCTUATION.test(line)) {
    const pair = TWO_ITEM_LIST.exec(line);
    if (pair) {
      const left = splitSkillList(pair[1]);
      const right = cleanLine(pair[2]);
      if (left.length > 0 && left.every(looksLikeSkillName) && looksLikeSkillName(right)) {
        return [...left, right];
      }
    }
  }
  return null;
}

/** Explicit skills lines only (`Skills:` prefix or `and +N skills`), never the `A and B` guess. */
function isExplicitSkillsLine(line: string): boolean {
  return SKILLS_PREFIX.test(line) || PLUS_N_SKILLS.test(line);
}

// ---------------------------------------------------------------------------
// Noise, footer, sidebar
// ---------------------------------------------------------------------------

const NOISE_PATTERNS: RegExp[] = [
  /^(?:…|\.\.\.|…)?\s*(?:see|show)?\s*(?:more|less)$/i, // "… more", "see more", "Show less"
  /^show credential$/i,
  /^show all\b/i,
  /^see all\b/i,
  /^credential id\b/i,
  /^[·•]$/,
  /^contact info$/i,
  /^add section$/i,
  /^open to$/i,
  /^enhance profile$/i,
  /^resources$/i,
  /^edit$/i,
  /^endorse$/i,
  /^save to pdf$/i,
  /^\d+\+?\s+(?:connections?|followers?)$/i,
  /^associated with\b/i,
  /^add (?:profile )?section$/i,
  /^more$/i,
];

/** UI chrome that never carries profile data. */
export function isNoiseLine(raw: string): boolean {
  const line = cleanLine(raw);
  if (!line) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

/** `Credential ID 2dkmzqtqkr3i` -> "2dkmzqtqkr3i". */
export function parseCredentialId(raw: string): string | null {
  const match = /^credential id\s*:?\s*(.+)$/i.exec(cleanLine(raw));
  return match ? match[1].trim() : null;
}

const FOOTER_LINES = new Set([
  'about',
  'accessibility',
  'talent solutions',
  'professional community policies',
  'careers',
  'privacy & terms',
  'privacy and terms',
  'privacy policy',
  'user agreement',
  'cookie policy',
  'copyright policy',
  'brand policy',
  'guest controls',
  'community guidelines',
  'ad choices',
  'advertising',
  'business services',
  'get the linkedin app',
  'more',
  'sales solutions',
  'marketing solutions',
  'mobile',
  'small business',
  'safety center',
  'questions?',
  'settings',
  'language',
  'help center',
  'learning solutions',
  'recruiting solutions',
  'linkedin corporation',
]);

function isFooterLine(line: string): boolean {
  const key = line.toLowerCase();
  if (FOOTER_LINES.has(key)) return true;
  return /^linkedin corporation\s*©/i.test(line) || /^©\s*\d{4}/.test(line);
}

const SIDEBAR_PATTERNS: RegExp[] = [
  /^profile language$/i,
  /^public profile & url$/i,
  /^who your viewers also viewed$/i,
  /^people also viewed$/i,
  /^people you may know$/i,
  /^you might like$/i,
  /^suggested for you$/i,
  /^promoted$/i,
  /^ad options$/i,
  /^explore premium/i,
];

export function isSidebarLine(raw: string): boolean {
  const line = cleanLine(raw);
  return SIDEBAR_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Cuts a section's lines at the first sidebar card or at the page footer
 * (two consecutive footer lines, so the About *section* heading is never
 * mistaken for the About *footer* link).
 */
export function trimSectionLines(rawLines: string[]): string[] {
  const lines = (rawLines || []).map(cleanLine).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    if (isSidebarLine(lines[i])) return lines.slice(0, i);
    if (isFooterLine(lines[i]) && i + 1 < lines.length && isFooterLine(lines[i + 1])) {
      return lines.slice(0, i);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

export type SectionKey =
  | 'about'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'projects'
  | 'volunteering'
  | 'skills'
  | 'languages';

export const SECTION_HEADINGS: Record<SectionKey, RegExp> = {
  about: /^about$/i,
  experience: /^experience$/i,
  education: /^education$/i,
  certifications: /^licen[cs]es\s*(?:&|and)?\s*certifications?$/i,
  projects: /^projects$/i,
  volunteering: /^volunteering(?:\s+experiences?)?$/i,
  skills: /^skills(?:\s*\(\d+\))?$/i,
  languages: /^languages$/i,
};

/** Which profile section a heading line names, if any. */
export function sectionKeyForHeading(raw: string): SectionKey | null {
  const line = cleanLine(raw);
  if (!line) return null;
  for (const key of Object.keys(SECTION_HEADINGS) as SectionKey[]) {
    if (SECTION_HEADINGS[key].test(line)) return key;
  }
  return null;
}

function stripHeading(lines: string[], key: SectionKey): string[] {
  if (lines.length > 0 && SECTION_HEADINGS[key].test(lines[0])) return lines.slice(1);
  return lines;
}

function prepare(rawLines: string[], key: SectionKey): string[] {
  const lines = trimSectionLines(Array.isArray(rawLines) ? rawLines : []);
  return stripHeading(lines, key).filter((line) => !isNoiseLine(line));
}

// ---------------------------------------------------------------------------
// Entry segmentation (experience, projects, volunteering, education)
// ---------------------------------------------------------------------------

const LOCATION_WORDS = /\b(?:remote|hybrid|on-?site)\b/i;
const EDUCATION_META = /^(?:grade|gpa|activities and societies|activities)\s*:/i;

function looksLikeLocation(line: string): boolean {
  if (line.length > 60 || TERMINAL_PUNCTUATION.test(line)) return false;
  return line.includes(',') || LOCATION_WORDS.test(line);
}

/** A short line with no sentence punctuation: a title, company, cause or location. */
function isShortNote(line: string, maxLength = 45): boolean {
  if (!line || line.length >= maxLength) return false;
  if (SENTENCE_PUNCTUATION.test(line)) return false;
  if (isExplicitSkillsLine(line)) return false;
  return true;
}

function isHeaderish(line: string): boolean {
  if (!line || line.length > 100) return false;
  if (TERMINAL_PUNCTUATION.test(line)) return false;
  if (parseSkillsLine(line)) return false;
  if (EDUCATION_META.test(line)) return false;
  if (isDurationOnlyLine(line) || isDateRangeLine(line)) return false;
  return true;
}

interface GroupHeader {
  company: string;
  type?: ExperienceType;
  location?: string;
}

interface Segment {
  header: string[];
  date: ParsedDateRange | null;
  body: string[];
  /** Employment-type-only lines found between the header and the date. */
  typeLines: string[];
  group: GroupHeader | null;
}

interface SegmentOptions {
  /** How many lines precede the date line: fixed, or decided per entry. */
  headerLines: 1 | 2 | 'auto';
  /** Recognise `Company` / `Full-time · 2 yrs` grouped headers. */
  grouped: boolean;
}

function splitHeader(
  pending: string[],
  options: SegmentOptions,
  group: GroupHeader | null,
  hasPrevious: boolean
): { header: string[]; rest: string[]; typeLines: string[] } {
  const candidates = [...pending];
  const typeLines: string[] = [];
  while (candidates.length > 0 && isEmploymentTypeLine(candidates[candidates.length - 1])) {
    typeLines.unshift(candidates.pop() as string);
  }
  if (candidates.length === 0) return { header: [], rest: [], typeLines };

  const last = candidates[candidates.length - 1];
  let count: number;
  if (options.headerLines === 'auto') {
    if (isCompanyLine(last)) count = 2;
    else if (group) count = 1;
    else count = 2;
  } else {
    count = options.headerLines;
  }

  if (count === 2) {
    if (candidates.length < 2) {
      count = 1;
    } else {
      const second = candidates[candidates.length - 2];
      const secondIsPreviousLocation =
        hasPrevious && candidates.length === 2 && pending.indexOf(second) === 0 && looksLikeLocation(second);
      if (!isHeaderish(second) || (secondIsPreviousLocation && !isCompanyLine(last))) count = 1;
    }
  }

  const header = candidates.slice(candidates.length - count);
  const rest = candidates.slice(0, candidates.length - count);
  return { header, rest, typeLines };
}

function segmentEntries(lines: string[], options: SegmentOptions): Segment[] {
  const segments: Segment[] = [];
  let pending: string[] = [];
  let current: Segment | null = null;
  let group: GroupHeader | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Grouped-company header: `Globex Corporation` / `Full-time · 3 yrs 2 mos` [/ `Austin, Texas`].
    if (
      options.grouped &&
      i + 1 < lines.length &&
      isDurationOnlyLine(lines[i + 1]) &&
      isHeaderish(line) &&
      !isDateRangeLine(line)
    ) {
      if (current) current.body.push(...pending);
      pending = [];
      const typePart = splitOnDot(lines[i + 1]).find(isEmploymentTypeLine);
      group = { company: line, type: typePart ? employmentTypeOf(typePart) : undefined };
      i += 1;
      if (i + 1 < lines.length && looksLikeLocation(lines[i + 1]) && !isDateRangeLine(lines[i + 1])) {
        group.location = splitOnDot(lines[i + 1])[0];
        i += 1;
      }
      continue;
    }

    if (isDurationOnlyLine(line)) continue;

    const date = parseDateRange(line);
    if (date) {
      const { header, rest, typeLines } = splitHeader(pending, options, group, current !== null);
      if (current) current.body.push(...rest);
      // A flat entry with its own `Company · Type` line ends any grouped scope.
      if (header.length === 2 && isCompanyLine(header[1])) group = null;
      current = { header, date, body: [], typeLines, group };
      segments.push(current);
      pending = [];
      continue;
    }

    pending.push(line);
  }

  if (current) {
    current.body.push(...pending);
  } else if (pending.length > 0) {
    // No date line anywhere: best-effort pairs of `title` / `Company · Type`.
    for (let i = 1; i < pending.length; i++) {
      if (options.headerLines !== 1 && isCompanyLine(pending[i]) && isHeaderish(pending[i - 1])) {
        segments.push({ header: [pending[i - 1], pending[i]], date: null, body: [], typeLines: [], group: null });
      }
    }
  }

  return segments;
}

interface EntryBody {
  note?: string;
  bullets: string[];
  skills: string[];
}

/** Splits an entry's body into the optional location/cause note, bullets and skills. */
function parseEntryBody(body: string[]): EntryBody {
  const result: EntryBody = { bullets: [], skills: [] };
  const lines = body.filter((line) => !isNoiseLine(line));
  let index = 0;

  if (lines.length > 0 && isShortNote(lines[0]) && !parseSkillsLine(lines[0])) {
    result.note = splitOnDot(lines[0])[0];
    index = 1;
  }

  const paragraphs: string[] = [];
  for (; index < lines.length; index++) {
    const line = lines[index];
    const explicit = isExplicitSkillsLine(line) ? parseSkillsLine(line) : null;
    if (explicit) {
      result.skills.push(...explicit);
      continue;
    }
    paragraphs.push(line);
  }

  // The trailing skills line without the `+N` marker: `A and B`, or a lone skill
  // name after a sentence-like description.
  if (result.skills.length === 0 && paragraphs.length > 0) {
    const last = paragraphs[paragraphs.length - 1];
    const pair = parseSkillsLine(last);
    if (pair) {
      result.skills.push(...pair);
      paragraphs.pop();
    } else if (paragraphs.length >= 2) {
      const previous = paragraphs[paragraphs.length - 2];
      const previousIsSentence = TERMINAL_PUNCTUATION.test(previous) || previous.length >= 60;
      if (previousIsSentence && looksLikeSkillName(last)) {
        result.skills.push(last);
        paragraphs.pop();
      }
    }
  }

  for (const paragraph of paragraphs) result.bullets.push(...splitIntoBullets(paragraph));
  return result;
}

function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

type ExperienceDraft = Omit<ProfileExperience, 'id'>;

function applyDates(target: ExperienceDraft, date: ParsedDateRange | null): void {
  if (!date) return;
  if (date.start) target.startDate = date.start;
  if (date.end) target.endDate = date.end;
  target.isCurrent = date.isCurrent;
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

/** Parses the Experience section (main page card or `/details/experience/`). */
export function parseExperienceLines(rawLines: string[]): ExperienceDraft[] {
  try {
    const lines = prepare(rawLines, 'experience');
    const results: ExperienceDraft[] = [];

    for (const segment of segmentEntries(lines, { headerLines: 'auto', grouped: true })) {
      const draft: ExperienceDraft = { company: '', title: '', bullets: [] };
      const [first, second] = segment.header;

      if (segment.header.length >= 2) {
        draft.title = first;
        const company = parseCompanyLine(second);
        draft.company = company.company;
        if (company.experienceType) draft.type = company.experienceType;
      } else if (segment.header.length === 1) {
        if (segment.group) {
          draft.title = first;
          draft.company = segment.group.company;
          if (segment.group.type) draft.type = segment.group.type;
        } else if (isCompanyLine(first)) {
          const company = parseCompanyLine(first);
          draft.company = company.company;
          if (company.experienceType) draft.type = company.experienceType;
        } else {
          draft.title = first;
        }
      }
      if (segment.group && !draft.company) draft.company = segment.group.company;
      if (segment.group?.location) draft.location = segment.group.location;

      for (const typeLine of segment.typeLines) {
        const type = employmentTypeOf(typeLine);
        if (type) draft.type = type;
      }
      if (!draft.type) {
        const inferred = inferExperienceType(draft.title);
        if (inferred) draft.type = inferred;
      }

      applyDates(draft, segment.date);

      const body = parseEntryBody(segment.body);
      if (body.note) draft.location = body.note;
      draft.bullets = body.bullets;
      if (body.skills.length > 0) draft.skillsUsed = dedupe(body.skills);

      if (draft.title || draft.company) results.push(draft);
    }
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** Parses the Projects section into `type: 'project'` experiences. */
export function parseProjectLines(rawLines: string[]): ExperienceDraft[] {
  try {
    const lines = prepare(rawLines, 'projects');
    const results: ExperienceDraft[] = [];

    for (const segment of segmentEntries(lines, { headerLines: 1, grouped: false })) {
      const name = segment.header[0];
      if (!name) continue;
      const draft: ExperienceDraft = { company: 'Personal project', title: name, type: 'project', bullets: [] };
      applyDates(draft, segment.date);
      const body = parseEntryBody(segment.body);
      if (body.note) draft.bullets.push(body.note);
      draft.bullets.push(...body.bullets);
      if (body.skills.length > 0) draft.skillsUsed = dedupe(body.skills);
      results.push(draft);
    }

    // No dated project at all: a short name followed by a description line.
    if (results.length === 0) {
      for (let i = 0; i + 1 < lines.length; i++) {
        if (isHeaderish(lines[i]) && lines[i].length < 60 && lines[i + 1].length >= 60) {
          results.push({ company: 'Personal project', title: lines[i], type: 'project', bullets: splitIntoBullets(lines[i + 1]) });
          i += 1;
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Volunteering
// ---------------------------------------------------------------------------

/** Parses the Volunteering section into `type: 'volunteer'` experiences. The cause line is dropped. */
export function parseVolunteeringLines(rawLines: string[]): ExperienceDraft[] {
  try {
    const lines = prepare(rawLines, 'volunteering');
    const results: ExperienceDraft[] = [];

    for (const segment of segmentEntries(lines, { headerLines: 2, grouped: false })) {
      const [first, second] = segment.header;
      if (!first) continue;
      const draft: ExperienceDraft = { company: '', title: first, type: 'volunteer', bullets: [] };
      if (second) draft.company = parseCompanyLine(second).company;
      applyDates(draft, segment.date);
      const body = parseEntryBody(segment.body);
      draft.bullets = body.bullets;
      if (body.skills.length > 0) draft.skillsUsed = dedupe(body.skills);
      results.push(draft);
    }
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

type EducationDraft = Omit<ProfileEducation, 'id'>;

function buildEducation(institution: string, degreeLine: string | undefined, date: ParsedDateRange | null, body: string[]): EducationDraft {
  const education: EducationDraft = { institution, degreeLevel: 'other', status: 'graduated' };

  if (degreeLine) {
    const commaIndex = degreeLine.indexOf(',');
    const degree = commaIndex >= 0 ? cleanLine(degreeLine.slice(0, commaIndex)) : degreeLine;
    const field = commaIndex >= 0 ? cleanLine(degreeLine.slice(commaIndex + 1)) : '';
    education.degreeLevel = inferDegreeLevel(degreeLine);
    if (field) {
      education.degree = degree;
      education.fieldOfStudy = field;
    } else if (education.degreeLevel !== 'other') {
      education.degree = degree;
    } else {
      education.fieldOfStudy = degree;
    }
  }

  const end = date?.end || (date?.isCurrent ? undefined : date?.start);
  const graduationYear = parseYear(end) ?? parseYear(date?.start);
  if (graduationYear) {
    education.graduationYear = graduationYear;
    if (end && end.length === 7) education.graduationMonth = Number(end.slice(5, 7));
  }
  education.status = date?.isCurrent && !graduationYear ? 'in_progress' : inferEducationStatus(graduationYear);

  for (const line of body) {
    const grade = /^(?:grade|gpa)\s*:\s*(.+)$/i.exec(line);
    if (grade) education.gpa = cleanLine(grade[1]);
  }
  return education;
}

/** Parses the Education section (main page card or `/details/education/`). */
export function parseEducationLines(rawLines: string[]): EducationDraft[] {
  try {
    const lines = prepare(rawLines, 'education');
    const results: EducationDraft[] = [];

    const segments = segmentEntries(lines, { headerLines: 2, grouped: false });
    for (const segment of segments) {
      const [first, second] = segment.header;
      if (!first) continue;
      results.push(buildEducation(first, second, segment.date, segment.body));
    }

    // No date line anywhere: pair each degree-looking line with the line above it.
    if (segments.length === 0) {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (EDUCATION_META.test(line)) continue;
        if ((inferDegreeLevel(line) !== 'other' || line.includes(',')) && isHeaderish(lines[i - 1])) {
          results.push(buildEducation(lines[i - 1], line, null, lines.slice(i + 1, i + 3)));
          i += 1;
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

type CertificationDraft = Omit<ProfileCertification, 'id'>;

export interface ParsedCertifications {
  certifications: CertificationDraft[];
  /** Names from the `Skills:` lines, in order, de-duplicated. */
  skills: string[];
}

function isCertificationBodyLine(line: string): boolean {
  return (
    isDateRangeLine(line) ||
    parseCredentialId(line) !== null ||
    isExplicitSkillsLine(line) ||
    isNoiseLine(line)
  );
}

/** Parses the Licenses & certifications section. `credentialUrl` is never set (the DOM link is not in the text). */
export function parseCertificationLines(rawLines: string[]): ParsedCertifications {
  const result: ParsedCertifications = { certifications: [], skills: [] };
  try {
    const lines = trimSectionLines(Array.isArray(rawLines) ? rawLines : []);
    const body = stripHeading(lines, 'certifications');

    interface Draft {
      cert: CertificationDraft;
      headerCount: number;
      bodyCount: number;
    }
    let current: Draft | null = null;
    const skills: string[] = [];

    for (const line of body) {
      if (isNoiseLine(line)) {
        if (current) current.bodyCount += 1;
        continue;
      }
      if (isCertificationBodyLine(line)) {
        if (!current) continue;
        current.bodyCount += 1;
        const date = parseDateRange(line);
        if (date) {
          const issued = parseYear(date.start);
          const expires = parseYear(date.end);
          if (issued) current.cert.issuedYear = issued;
          if (expires && (!issued || /expire/i.test(line) || expires !== issued)) current.cert.expiresYear = expires;
          continue;
        }
        const explicit = parseSkillsLine(line);
        if (explicit) skills.push(...explicit);
        continue;
      }

      if (current && current.bodyCount === 0 && current.headerCount === 1) {
        current.cert.issuer = line;
        current.headerCount = 2;
        continue;
      }
      current = { cert: { name: line }, headerCount: 1, bodyCount: 0 };
      result.certifications.push(current.cert);
    }

    result.skills = dedupe(skills);
  } catch {
    // keep whatever was collected
  }
  return result;
}

// ---------------------------------------------------------------------------
// Skills page / card
// ---------------------------------------------------------------------------

const SKILL_PILLS = new Set([
  'all',
  'industry knowledge',
  'tools & technologies',
  'tools and technologies',
  'interpersonal skills',
  'languages',
  'other skills',
  'top skills',
]);
const CONTEXT_LINE = /\sat\s|^\d+\s+endorsements?$|passed linkedin skill assessment/i;

/**
 * Parses the Skills page (or the main-page card). Category pills, context
 * lines (`Software Engineer Intern at Maroon`, `3 endorsements`, a known
 * certification/education/project name) and chrome are skipped; everything
 * else is a skill name.
 */
export function parseSkillsLines(rawLines: string[], knownContextNames: string[] = []): string[] {
  try {
    const lines = prepare(rawLines, 'skills');
    const known = new Set((knownContextNames || []).map((name) => cleanLine(name).toLowerCase()).filter(Boolean));
    const names: string[] = [];
    for (const line of lines) {
      const key = line.toLowerCase();
      if (SKILL_PILLS.has(key) || known.has(key)) continue;
      if (CONTEXT_LINE.test(line)) continue;
      if (line.length > 80) continue;
      names.push(line);
    }
    return dedupe(names);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Top card / About
// ---------------------------------------------------------------------------

export interface ParsedTopCard {
  name?: string;
  headline?: string;
  location?: string;
}

const PRONOUNS = /^\(?(?:he|she|they|ze|xe)\s*\/\s*(?:him|her|them|hir|xem)\)?$/i;
const TOP_CARD_STOP = /^(?:contact info|[·•]|\d+\+?\s+(?:connections?|followers?)|open to|add section|enhance profile|resources|more)$/i;

/** `Jayden Chun` / headline / `Round Rock, Texas, United States` / `·` / `Contact info` / … */
export function parseTopCardLines(rawLines: string[]): ParsedTopCard {
  const result: ParsedTopCard = {};
  try {
    const lines = trimSectionLines(Array.isArray(rawLines) ? rawLines : []);
    if (lines.length === 0) return result;
    if (sectionKeyForHeading(lines[0])) return result; // a section card, not the top card

    result.name = lines[0].replace(/\s*\((?:he|she|they)\s*\/\s*\w+\)$/i, '').trim();
    let index = 1;
    if (index < lines.length && PRONOUNS.test(lines[index])) index += 1;

    const stopIndex = lines.findIndex((line, i) => i >= index && TOP_CARD_STOP.test(line));
    const end = stopIndex === -1 ? lines.length : stopIndex;

    if (index < end && !TOP_CARD_STOP.test(lines[index])) {
      result.headline = lines[index];
      index += 1;
    }
    // Location: the line right before the `·` / `Contact info` lines, else the
    // first comma-separated short line after the headline.
    let location: string | undefined;
    if (stopIndex > index - 1 && stopIndex - 1 >= index) location = lines[stopIndex - 1];
    if (!location) location = lines.slice(index, end).find((line) => line.includes(',') && line.length < 80);
    if (location && location !== result.headline && location.length < 120) result.location = location;
  } catch {
    // partial result
  }
  return result;
}

export interface ParsedAbout {
  summary: string;
  topSkills: string[];
}

/** `About` / paragraphs… / `Top skills` / `Git • Java • Machine Learning`. */
export function parseAboutLines(rawLines: string[]): ParsedAbout {
  const result: ParsedAbout = { summary: '', topSkills: [] };
  try {
    const lines = prepare(rawLines, 'about');
    const paragraphs: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^top skills$/i.test(line)) {
        const next = lines[i + 1];
        if (next) result.topSkills = dedupe(splitSkillList(next));
        break;
      }
      paragraphs.push(line);
    }
    result.summary = paragraphs.join('\n').trim();
  } catch {
    // partial result
  }
  return result;
}
