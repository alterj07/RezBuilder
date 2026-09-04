/**
 * Small, pure inference helpers shared by every profile importer
 * (resume parser, LinkedIn data export, LinkedIn page scraper).
 */
import { DegreeLevel, EducationStatus, ExperienceType } from '../../types/profile';

/** Generates an id following the repo-wide `<prefix>_<time36>_<rand6>` convention. */
export function createProfileEntityId(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const DEGREE_PATTERNS: { level: DegreeLevel; pattern: RegExp }[] = [
  { level: 'phd', pattern: /\b(?:phd|dphil|doctor|doctorate|doctoral)\b/ },
  { level: 'master', pattern: /\b(?:master|masters|ms|msc|meng|mba|mtech|mfa|med|ma)\b/ },
  { level: 'bachelor', pattern: /\b(?:bachelor|bachelors|bs|bsc|ba|beng|btech|bba|bfa|bse)\b/ },
  { level: 'associate', pattern: /\b(?:associate|associates|aa|aas)\b/ },
  { level: 'bootcamp', pattern: /\bboot\s?camp\b/ },
  { level: 'high_school', pattern: /\b(?:high school|secondary school|ged)\b/ },
];

/**
 * Infers a `DegreeLevel` from free-form degree text such as "B.S.",
 * "Master of Science - MS" or "Ph.D. in Computer Science".
 * Falls back to `'other'` when nothing recognizable is present.
 */
export function inferDegreeLevel(degreeText: string | undefined | null): DegreeLevel {
  if (!degreeText) return 'other';
  // "b.s." -> "bs", "ph.d." -> "phd"; apostrophes ("bachelor's") -> "bachelors".
  const normalized = degreeText
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 'other';
  for (const { level, pattern } of DEGREE_PATTERNS) {
    if (pattern.test(normalized)) return level;
  }
  return 'other';
}

/** Extracts the first plausible 4-digit year (1950–2099) from free text. */
export function parseYear(text: string | number | undefined | null): number | undefined {
  if (text === undefined || text === null) return undefined;
  if (typeof text === 'number') {
    return Number.isInteger(text) && text >= 1950 && text <= 2099 ? text : undefined;
  }
  const match = text.match(/\b(19[5-9]\d|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Normalizes a human date ("Jan 2023", "January 2023", "2023", "01/2023",
 * "2023-01", "Jan 1, 2023") to `"YYYY-MM"` or `"YYYY"`.
 * Returns `undefined` when no year can be found; "Present"/"Current" also
 * yield `undefined` so callers can treat them as open-ended.
 */
export function normalizeDate(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed || /^(?:present|current|now|ongoing)$/i.test(trimmed)) return undefined;

  const year = parseYear(trimmed);
  if (!year) return undefined;

  let month: number | undefined;

  const isoMatch = trimmed.match(/\b(19[5-9]\d|20\d{2})-(\d{1,2})\b/);
  if (isoMatch) {
    month = parseInt(isoMatch[2], 10);
  } else {
    const slashMatch = trimmed.match(/\b(\d{1,2})\/(?:\d{1,2}\/)?(19[5-9]\d|20\d{2})\b/);
    if (slashMatch) {
      month = parseInt(slashMatch[1], 10);
    } else {
      const wordMatch = trimmed.toLowerCase().match(/\b([a-z]{3,9})\b/);
      if (wordMatch && MONTHS[wordMatch[1]] !== undefined) {
        month = MONTHS[wordMatch[1]];
      }
    }
  }

  if (month && month >= 1 && month <= 12) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  return String(year);
}

/** Returns true for "Present"-style end dates. */
export function isPresentMarker(text: string | undefined | null): boolean {
  return !!text && /^(?:present|current|now|ongoing)$/i.test(text.trim());
}

/**
 * Graduated when the graduating class is in the past, in progress when it is
 * this year or later. A missing year defaults to graduated (the safer guess for
 * a fit calculation; the UI prompts the user to confirm).
 */
export function inferEducationStatus(
  graduationYear: number | undefined,
  now: Date = new Date()
): EducationStatus {
  if (graduationYear === undefined) return 'graduated';
  return graduationYear < now.getFullYear() ? 'graduated' : 'in_progress';
}

/**
 * Infers an experience type from a job title. Only patterns that are reliable
 * in practice are recognized; everything else stays `undefined` so the user
 * can pick.
 */
export function inferExperienceType(title: string | undefined | null): ExperienceType | undefined {
  if (!title) return undefined;
  const t = title.toLowerCase();
  if (/\bintern(?:ship)?\b|\bco-?op\b/.test(t)) return 'internship';
  if (/\bcontract(?:or)?\b/.test(t)) return 'contract';
  if (/\bfreelance(?:r)?\b/.test(t)) return 'freelance';
  if (/\bvolunteer\b/.test(t)) return 'volunteer';
  if (/\bresearch (?:assistant|scientist|fellow|intern)\b|\bresearcher\b/.test(t)) return 'research';
  if (/\bpart[- ]time\b/.test(t)) return 'part_time';
  return undefined;
}

/** Splits a free-text description into clean bullet strings. */
export function splitIntoBullets(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|(?<=\S)\s*[•▪◦]\s+/)
    .map((line) => line.replace(/^[\s•\-*·▪◦]+/, '').trim())
    .filter((line) => line.length > 0);
}
