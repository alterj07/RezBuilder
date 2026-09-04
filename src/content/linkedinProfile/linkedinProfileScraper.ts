/**
 * Scrapes the signed-in user's OWN LinkedIn profile page into a `ProfileImport`.
 *
 * LinkedIn's public API does not expose skills/experience to third-party apps,
 * so this reads the rendered DOM instead. Class names on linkedin.com are
 * obfuscated and churn constantly; the scraper therefore anchors on the things
 * that have stayed stable for years:
 *
 *   - each profile section is a `<section>` containing an anchor `<div id="experience">`
 *     (`education`, `skills`, `licenses_and_certifications`, `about`), with an
 *     `<h2>` heading as a fallback;
 *   - entries are `<li>` elements under the section's first `<ul>`;
 *   - every visible string is rendered twice, once in a `[aria-hidden="true"]`
 *     span and once in a `.visually-hidden` span for screen readers.
 *
 * Everything is defensive: the scraper never throws, and anything it could not
 * find is reported through `warnings`.
 */

import {
  DegreeLevel,
  ExperienceType,
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileImport,
} from '../../types/profile';
import { cleanText } from '../scrapers/keywordExtractor';

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const PROFILE_URL_PATTERN =
  /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/in\/[^/?#\s]+(?:[/?#].*)?$/i;

const DETAILS_PATH_PATTERN = /\/in\/[^/?#]+\/details\/([a-z_-]+)\/?/i;

/** True for `linkedin.com/in/<slug>` (including `/in/me`) and its `/details/*` sub-pages. */
export function isLinkedInProfileUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return PROFILE_URL_PATTERN.test(url.trim());
}

type DetailsKind = 'skills' | 'experience' | 'education' | 'certifications' | null;

/** Which `/details/<kind>/` page a URL points at, if any. */
function detailsKind(url: string): DetailsKind {
  const match = DETAILS_PATH_PATTERN.exec(url || '');
  if (!match) return null;
  const kind = match[1].toLowerCase();
  if (kind === 'skills') return 'skills';
  if (kind === 'experience') return 'experience';
  if (kind === 'education') return 'education';
  if (kind === 'certifications' || kind === 'licenses_and_certifications') return 'certifications';
  return null;
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

const NOISE_LINE = /^(?:…|\.\.\.)?\s*(?:see more|see less|show more|show less|…more|…see more)$/i;
const SHOW_ALL_LINE = /^show all\b/i;

function isNoiseLine(line: string): boolean {
  return NOISE_LINE.test(line) || SHOW_ALL_LINE.test(line);
}

function isInsideVisuallyHidden(el: Element): boolean {
  return !!el.closest('.visually-hidden, .a11y-text, .sr-only');
}

function isInsideNestedList(el: Element, root: Element): boolean {
  let node: Element | null = el.parentElement;
  while (node && node !== root) {
    if (node.tagName === 'UL' || node.tagName === 'OL') return true;
    node = node.parentElement;
  }
  return false;
}

function pushLines(target: string[], rawText: string | null | undefined): void {
  if (!rawText) return;
  for (const piece of rawText.split(/\n+/)) {
    const line = cleanText(piece);
    if (!line || isNoiseLine(line)) continue;
    if (target.length > 0 && target[target.length - 1] === line) continue; // consecutive duplicate
    target.push(line);
  }
}

/**
 * Returns the visible text lines of an element, in document order.
 *
 * Prefers `[aria-hidden="true"]` spans (LinkedIn's visible copy) so each string
 * is read exactly once; falls back to leaf-element text when the markup is
 * plainer than expected. Consecutive duplicate lines are collapsed.
 */
function collectLines(root: Element | null, options: { skipNestedLists?: boolean } = {}): string[] {
  const lines: string[] = [];
  if (!root) return lines;

  const shouldSkip = (el: Element) =>
    isInsideVisuallyHidden(el) || (options.skipNestedLists === true && isInsideNestedList(el, root));

  const hiddenSpans = Array.from(root.querySelectorAll('[aria-hidden="true"]')).filter(
    (el) =>
      !el.querySelector('[aria-hidden="true"]') && // innermost only
      el.tagName !== 'SVG' &&
      el.tagName !== 'USE' &&
      !shouldSkip(el)
  );

  if (root.matches('[aria-hidden="true"]') && hiddenSpans.length === 0) {
    pushLines(lines, root.textContent);
    return lines;
  }

  if (hiddenSpans.length > 0) {
    for (const span of hiddenSpans) pushLines(lines, span.textContent);
    return lines;
  }

  // Fallback: plain markup without the duplicated-span pattern.
  if (root.children.length === 0) {
    pushLines(lines, root.textContent);
    return lines;
  }

  const leaves = Array.from(root.querySelectorAll('*')).filter((el) => {
    if (el.children.length !== 0) return false;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'USE' || tag === 'BUTTON') return false;
    return !shouldSkip(el);
  });
  for (const leaf of leaves) pushLines(lines, leaf.textContent);
  return lines;
}

function firstLine(el: Element | null): string {
  return collectLines(el)[0] || '';
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
};

const MONTH_RE = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const SINGLE_DATE_RE = `(?:(${MONTH_RE})\\s+)?(\\d{4})`;
const DATE_RANGE_PATTERN = new RegExp(
  `^${SINGLE_DATE_RE}\\s*[-–—]\\s*(?:${SINGLE_DATE_RE}|(present|current|now))(?:\\s*[·•].*)?$`,
  'i'
);
const SINGLE_YEAR_PATTERN = new RegExp(`^${SINGLE_DATE_RE}(?:\\s*[·•].*)?$`, 'i');

interface ParsedDateRange {
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  startYear?: number;
  endYear?: number;
}

function toIsoDate(month: string | undefined, year: string): string {
  const mm = month ? MONTHS[month.toLowerCase().replace('.', '').slice(0, 4)] || MONTHS[month.toLowerCase().slice(0, 3)] : undefined;
  return mm ? `${year}-${mm}` : year;
}

function isDateRangeLine(line: string): boolean {
  return DATE_RANGE_PATTERN.test(line);
}

function parseDateRange(line: string): ParsedDateRange | null {
  const m = DATE_RANGE_PATTERN.exec(line);
  if (m) {
    const [, startMonth, startYear, endMonth, endYear, present] = m;
    return {
      startDate: toIsoDate(startMonth, startYear),
      endDate: endYear ? toIsoDate(endMonth, endYear) : undefined,
      isCurrent: !!present,
      startYear: Number(startYear),
      endYear: endYear ? Number(endYear) : undefined,
    };
  }
  const single = SINGLE_YEAR_PATTERN.exec(line);
  if (single) {
    const [, month, year] = single;
    return {
      startDate: toIsoDate(month, year),
      endDate: toIsoDate(month, year),
      isCurrent: false,
      startYear: Number(year),
      endYear: Number(year),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section lookup
// ---------------------------------------------------------------------------

type SectionKey = 'about' | 'experience' | 'education' | 'skills' | 'certifications';

const SECTION_ANCHORS: Record<SectionKey, string[]> = {
  about: ['about'],
  experience: ['experience'],
  education: ['education'],
  skills: ['skills'],
  certifications: ['licenses_and_certifications', 'certifications'],
};

const SECTION_HEADINGS: Record<SectionKey, RegExp> = {
  about: /^about$/i,
  experience: /^experience$/i,
  education: /^education$/i,
  skills: /^skills$/i,
  certifications: /^licen[cs]es\s*(?:&|and)\s*certifications?$/i,
};

function findSection(doc: Document, key: SectionKey): Element | null {
  for (const id of SECTION_ANCHORS[key]) {
    const anchor = doc.getElementById(id);
    const section = anchor?.closest('section');
    if (section) return section;
  }
  const pattern = SECTION_HEADINGS[key];
  for (const section of Array.from(doc.querySelectorAll('section'))) {
    const heading = section.querySelector('h2, h3');
    if (heading && pattern.test(firstLine(heading) || cleanText(heading.textContent))) return section;
  }
  return null;
}

/** Direct `<li>` children of the first list in a section. */
function sectionEntries(section: Element | null): Element[] {
  if (!section) return [];
  const list = section.querySelector('ul, ol');
  if (!list) return [];
  return Array.from(list.children).filter((child) => child.tagName === 'LI');
}

/** On `/details/*` pages the entries live under the largest list in `<main>`. */
function detailsEntries(doc: Document): Element[] {
  const scope = doc.querySelector('main') || doc.body || doc.documentElement;
  if (!scope) return [];
  let best: Element | null = null;
  let bestCount = 0;
  for (const list of Array.from(scope.querySelectorAll('ul, ol'))) {
    if (isInsideNestedList(list, scope)) continue;
    const count = Array.from(list.children).filter((c) => c.tagName === 'LI').length;
    if (count > bestCount) {
      best = list;
      bestCount = count;
    }
  }
  return best ? Array.from(best.children).filter((c) => c.tagName === 'LI') : [];
}

// ---------------------------------------------------------------------------
// Entry parsers
// ---------------------------------------------------------------------------

const EMPLOYMENT_TYPES: { pattern: RegExp; type: ExperienceType }[] = [
  { pattern: /full[\s-]?time/i, type: 'full_time' },
  { pattern: /part[\s-]?time/i, type: 'part_time' },
  { pattern: /intern(?:ship)?|apprentice/i, type: 'internship' },
  { pattern: /contract|temporary/i, type: 'contract' },
  { pattern: /freelance|self[\s-]?employed/i, type: 'freelance' },
  { pattern: /volunteer/i, type: 'volunteer' },
  { pattern: /research/i, type: 'research' },
];

function employmentType(text: string): ExperienceType | undefined {
  for (const { pattern, type } of EMPLOYMENT_TYPES) {
    if (pattern.test(text)) return type;
  }
  return undefined;
}

function isEmploymentTypeOnly(text: string): boolean {
  return text.length < 40 && employmentType(text) !== undefined && !/[.,]/.test(text);
}

const SKILLS_LINE = /^skills?\s*:/i;
const SKILLS_SUMMARY_LINE = /\band\s+\+\d+\s+skills?$/i;

function parseSkillsLine(line: string): string[] | null {
  let body: string | null = null;
  if (SKILLS_LINE.test(line)) {
    body = line.replace(SKILLS_LINE, '');
  } else if (SKILLS_SUMMARY_LINE.test(line)) {
    body = line.replace(SKILLS_SUMMARY_LINE, '');
  }
  if (body === null) return null;
  return body
    .split(/\s*[·•]\s*|,\s*|\s+and\s+/)
    .map((s) => cleanText(s))
    .filter(Boolean);
}

function looksLikeLocation(line: string): boolean {
  if (line.length > 70) return false;
  if (/[.!?]$/.test(line)) return false;
  return true;
}

function splitDot(line: string): string[] {
  return line
    .split(/\s*[·•]\s*/)
    .map((s) => cleanText(s))
    .filter(Boolean);
}

interface ExperienceDraft {
  title: string;
  company: string;
  type?: ExperienceType;
  dates?: ParsedDateRange;
  location?: string;
  bullets: string[];
  skillsUsed: string[];
}

/**
 * Parses one role from its text lines. `header` carries whatever the caller
 * already knows (the company for a grouped entry).
 */
function parseRoleLines(lines: string[], header: Partial<ExperienceDraft> = {}): ExperienceDraft {
  const draft: ExperienceDraft = {
    title: '',
    company: header.company || '',
    type: header.type,
    location: header.location,
    bullets: [],
    skillsUsed: [],
  };
  if (lines.length === 0) return draft;

  draft.title = lines[0];
  let index = 1;

  // Second line: "Company · Full-time" (flat layout) or just "Full-time" (grouped role).
  if (index < lines.length && !isDateRangeLine(lines[index])) {
    const parts = splitDot(lines[index]);
    if (parts.length > 1) {
      draft.company = header.company || parts[0];
      draft.type = employmentType(parts.slice(1).join(' ')) || draft.type;
      index++;
    } else if (parts.length === 1 && isEmploymentTypeOnly(parts[0])) {
      draft.type = employmentType(parts[0]) || draft.type;
      index++;
    } else if (!header.company && parts.length === 1) {
      draft.company = parts[0];
      index++;
    }
  }

  let sawDate = false;
  let sawOwnLocation = false;
  for (; index < lines.length; index++) {
    const line = lines[index];
    const skills = parseSkillsLine(line);
    if (skills) {
      draft.skillsUsed.push(...skills);
      continue;
    }
    if (!sawDate && isDateRangeLine(line)) {
      draft.dates = parseDateRange(line) || undefined;
      sawDate = true;
      continue;
    }
    // The line right after the date range is the location (a role's own
    // location overrides the one inherited from a grouped company header).
    if (sawDate && !sawOwnLocation && draft.bullets.length === 0 && looksLikeLocation(line)) {
      draft.location = splitDot(line)[0];
      sawOwnLocation = true;
      continue;
    }
    draft.bullets.push(line);
  }

  return draft;
}

function draftToExperience(draft: ExperienceDraft): Omit<ProfileExperience, 'id'> | null {
  if (!draft.title && !draft.company) return null;
  const experience: Omit<ProfileExperience, 'id'> = {
    company: draft.company,
    title: draft.title,
    bullets: draft.bullets,
  };
  if (draft.type) experience.type = draft.type;
  if (draft.dates?.startDate) experience.startDate = draft.dates.startDate;
  if (draft.dates?.endDate) experience.endDate = draft.dates.endDate;
  if (draft.dates?.isCurrent) experience.isCurrent = true;
  if (draft.location) experience.location = draft.location;
  if (draft.skillsUsed.length > 0) experience.skillsUsed = Array.from(new Set(draft.skillsUsed));
  return experience;
}

/**
 * Parses an experience `<li>`. Handles both the flat layout (one role per
 * entry) and the grouped layout, where a company entry nests one `<li>` per
 * role. A nested list is treated as roles only when its items carry date
 * ranges and the entry header does not — otherwise it is the description /
 * skills sub-component list of a flat entry.
 */
function parseExperienceEntry(li: Element): Omit<ProfileExperience, 'id'>[] {
  const headerLines = collectLines(li, { skipNestedLists: true });
  const nestedList = li.querySelector('ul, ol');
  const nestedItems = nestedList
    ? Array.from(nestedList.children).filter((c) => c.tagName === 'LI')
    : [];

  const headerHasDate = headerLines.some(isDateRangeLine);
  const roleItems = nestedItems.filter((item) => collectLines(item).some(isDateRangeLine));
  const grouped = !headerHasDate && roleItems.length > 0;

  if (!grouped) {
    const parsed = draftToExperience(parseRoleLines(collectLines(li)));
    return parsed ? [parsed] : [];
  }

  // Grouped: header = [Company, "Full-time · 3 yrs", Location?]
  const header: Partial<ExperienceDraft> = { company: headerLines[0] || '' };
  for (const line of headerLines.slice(1)) {
    const parts = splitDot(line);
    const type = employmentType(parts[0] || '');
    if (type && !header.type) {
      header.type = type;
    } else if (!header.location && looksLikeLocation(line) && !/\d+\s*(?:yrs?|mos?)\b/i.test(line)) {
      header.location = parts[0];
    }
  }

  const results: Omit<ProfileExperience, 'id'>[] = [];
  for (const item of roleItems) {
    const parsed = draftToExperience(parseRoleLines(collectLines(item), header));
    if (parsed) results.push(parsed);
  }
  return results;
}

/** Degree level from free text such as "Bachelor of Science - BS". */
export function inferDegreeLevel(text: string): DegreeLevel {
  const raw = text || '';
  const lower = raw.toLowerCase();

  if (/ph\.?\s?d|doctor|doctorate|d\.?phil/i.test(lower)) return 'phd';
  if (/master|\bmba\b|\bmeng\b|\bmsc\b|\bm\.?\s?s\.?\b|\bm\.?\s?a\.?\b|\bm\.?\s?eng\b|\bm\.?\s?ed\b|\bllm\b/i.test(lower)) {
    return 'master';
  }
  if (/bachelor|\bbsc\b|\bbeng\b|\bbba\b|\bbfa\b|\bbtech\b|\bb\.?\s?s\.?\b|\bb\.?\s?a\.?\b|\bb\.?\s?e\.?\b|\bb\.?\s?eng\b|\bb\.?\s?tech\b/i.test(lower)) {
    return 'bachelor';
  }
  if (/associate/i.test(lower) || /\bA\.?\s?A\.?S?\b|\bA\.?\s?S\.?\b/.test(raw)) return 'associate';
  if (/boot\s?camp|nanodegree|certificate program/i.test(lower)) return 'bootcamp';
  if (/high school|secondary school|\bged\b/i.test(lower)) return 'high_school';
  return 'other';
}

function parseEducationEntry(li: Element, currentYear: number): Omit<ProfileEducation, 'id'> | null {
  const lines = collectLines(li);
  if (lines.length === 0) return null;

  const education: Omit<ProfileEducation, 'id'> = {
    institution: lines[0],
    degreeLevel: 'other',
    status: 'graduated',
  };

  let degreeText = '';
  for (const line of lines.slice(1)) {
    const dates = isDateRangeLine(line) || SINGLE_YEAR_PATTERN.test(line) ? parseDateRange(line) : null;
    if (dates) {
      if (dates.endYear !== undefined) {
        education.graduationYear = dates.endYear;
        education.status = dates.endYear < currentYear ? 'graduated' : 'in_progress';
        if (dates.endDate && dates.endDate.length === 7) {
          education.graduationMonth = Number(dates.endDate.slice(5, 7));
        }
      }
      continue;
    }
    const grade = /^(?:grade|gpa)\s*:\s*(.+)$/i.exec(line);
    if (grade) {
      education.gpa = cleanText(grade[1]);
      continue;
    }
    if (/^activities and societies\s*:/i.test(line) || parseSkillsLine(line)) continue;
    if (!degreeText) degreeText = line;
  }

  if (degreeText) {
    const [degree, ...field] = degreeText.split(/,\s*/);
    education.degree = cleanText(degree);
    if (field.length > 0) education.fieldOfStudy = cleanText(field.join(', '));
    education.degreeLevel = inferDegreeLevel(degreeText);
  }

  return education;
}

function parseSkillEntry(li: Element): string | null {
  const name = collectLines(li)[0];
  if (!name) return null;
  // Endorsement counters and "Show all" links are never skills.
  if (/^\d+\s+endorsements?$/i.test(name) || SHOW_ALL_LINE.test(name)) return null;
  return name;
}

function externalHref(li: Element): string | undefined {
  for (const anchor of Array.from(li.querySelectorAll('a[href]'))) {
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#')) continue;
    if (/linkedin\.com|^\//i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) return href;
  }
  return undefined;
}

function parseCertificationEntry(li: Element): Omit<ProfileCertification, 'id'> | null {
  const lines = collectLines(li);
  if (lines.length === 0) return null;

  const certification: Omit<ProfileCertification, 'id'> = { name: lines[0] };
  for (const line of lines.slice(1)) {
    const issued = /issued\s+(?:[a-z]+\.?\s+)?(\d{4})/i.exec(line);
    const expires = /expire[sd]?\s+(?:[a-z]+\.?\s+)?(\d{4})/i.exec(line);
    if (issued || expires) {
      if (issued) certification.issuedYear = Number(issued[1]);
      if (expires) certification.expiresYear = Number(expires[1]);
      continue;
    }
    if (/^credential id/i.test(line) || /^show credential/i.test(line) || parseSkillsLine(line)) continue;
    if (isDateRangeLine(line) || SINGLE_YEAR_PATTERN.test(line)) {
      const dates = parseDateRange(line);
      if (dates?.startYear) certification.issuedYear = dates.startYear;
      if (dates?.endYear && dates.endYear !== dates.startYear) certification.expiresYear = dates.endYear;
      continue;
    }
    if (!certification.issuer) certification.issuer = line;
  }

  const url = externalHref(li);
  if (url) certification.credentialUrl = url;
  return certification;
}

// ---------------------------------------------------------------------------
// Top card (name / headline / location)
// ---------------------------------------------------------------------------

const NON_LOCATION_SMALL_TEXT = /connections?|followers?|contact info|mutual|he\/him|she\/her|they\/them|pronouns/i;

interface TopCard {
  name?: string;
  headline?: string;
  location?: string;
}

function textAfter(reference: Element, candidate: Element): boolean {
  return (reference.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function readTopCard(doc: Document): TopCard {
  const h1 = doc.querySelector('main h1') || doc.querySelector('h1');
  if (!h1) return {};

  const result: TopCard = {};
  const name = firstLine(h1) || cleanText(h1.textContent);
  if (name) result.name = name;

  const card: Element = h1.closest('section') || h1.closest('main') || doc.body || doc.documentElement;

  const headlineEl = Array.from(card.querySelectorAll('.text-body-medium')).find((el) => textAfter(h1, el));
  let headline = headlineEl ? firstLine(headlineEl) || cleanText(headlineEl.textContent) : '';
  if (!headline) {
    const div = Array.from(card.querySelectorAll('div')).find((el) => {
      if (!textAfter(h1, el) || el.contains(h1) || isInsideVisuallyHidden(el)) return false;
      const text = cleanText(el.textContent);
      return text.length > 0 && text.length < 220 && text !== name && !/^\d+\+?\s+(?:connections?|followers?)$/i.test(text);
    });
    headline = div ? cleanText(div.textContent) : '';
  }
  if (headline && headline !== name) result.headline = headline;

  const locationEl = Array.from(card.querySelectorAll('.text-body-small')).find((el) => {
    if (!textAfter(h1, el) || isInsideVisuallyHidden(el)) return false;
    const text = firstLine(el) || cleanText(el.textContent);
    return text.length > 0 && text.length < 120 && !NON_LOCATION_SMALL_TEXT.test(text);
  });
  let location = locationEl ? firstLine(locationEl) || cleanText(locationEl.textContent) : '';
  if (!location) {
    const candidate = Array.from(card.querySelectorAll('span, div')).find((el) => {
      if (!textAfter(h1, el) || el.contains(h1) || isInsideVisuallyHidden(el)) return false;
      if (el.children.length > 0) return false;
      const text = cleanText(el.textContent);
      return text.includes(',') && text.length < 80 && text !== headline && !NON_LOCATION_SMALL_TEXT.test(text);
    });
    location = candidate ? cleanText(candidate.textContent) : '';
  }
  if (location) result.location = location;

  return result;
}

function canonicalUrl(doc: Document, url: string): string | undefined {
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  if (isLinkedInProfileUrl(canonical) && !/\/in\/me\/?(?:[?#]|$)/i.test(canonical)) {
    return canonical.split(/[?#]/)[0];
  }
  if (isLinkedInProfileUrl(url)) {
    const base = url.split(/[?#]/)[0];
    const slugMatch = /^(https?:\/\/[^/]+\/in\/[^/?#]+)/i.exec(base);
    return slugMatch ? slugMatch[1] + '/' : base;
  }
  return undefined;
}

function hasShowAllControl(section: Element, kind: string): boolean {
  for (const control of Array.from(section.querySelectorAll('a, button'))) {
    const href = control.getAttribute('href') || '';
    if (href.includes(`/details/${kind}`)) return true;
    const text = cleanText(control.textContent);
    if (/^show all\b/i.test(text)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function dedupeSkills(names: string[]): { name: string }[] {
  const seen = new Set<string>();
  const result: { name: string }[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push({ name });
  }
  return result;
}

/**
 * Scrapes a LinkedIn profile page (or one of its `/details/*` sub-pages) into a
 * partial profile. Never throws.
 */
export function scrapeLinkedInProfile(document: Document, url: string): ProfileImport {
  const result: ProfileImport = { source: 'linkedin_page', warnings: [] };
  const warnings = result.warnings as string[];

  try {
    if (!document) {
      warnings.push('No document to scrape.');
      return result;
    }

    const currentYear = new Date().getFullYear();
    const details = detailsKind(url);

    // --- Contact --------------------------------------------------------
    // Details sub-pages title their <h1> with the section name, not the user.
    const topCard = details === null ? readTopCard(document) : {};
    const linkedinUrl = canonicalUrl(document, url);
    if (topCard.name || linkedinUrl) {
      result.contact = {};
      if (topCard.name) result.contact.name = topCard.name;
      if (topCard.location) result.contact.location = topCard.location;
      if (linkedinUrl) result.contact.linkedinUrl = linkedinUrl;
    }
    if (!topCard.name && details === null) {
      warnings.push('Could not find the profile name (top card not rendered yet?).');
    }

    // --- Details sub-pages: one list, one kind -------------------------
    if (details !== null) {
      const entries = detailsEntries(document);
      if (entries.length === 0) {
        warnings.push(`No ${details} entries found on this details page.`);
      }
      if (details === 'skills') {
        const names = entries.map(parseSkillEntry).filter((n): n is string => !!n);
        result.skills = dedupeSkills(names);
      } else if (details === 'experience') {
        result.experiences = entries.flatMap(parseExperienceEntry);
      } else if (details === 'education') {
        result.education = entries
          .map((li) => parseEducationEntry(li, currentYear))
          .filter((e): e is Omit<ProfileEducation, 'id'> => !!e);
      } else if (details === 'certifications') {
        result.certifications = entries
          .map(parseCertificationEntry)
          .filter((c): c is Omit<ProfileCertification, 'id'> => !!c);
      }
      return result;
    }

    // --- About / summary -------------------------------------------------
    const aboutSection = findSection(document, 'about');
    let summary = '';
    if (aboutSection) {
      const lines = collectLines(aboutSection).filter((line) => !SECTION_HEADINGS.about.test(line));
      summary = lines.join(' ').trim();
    }
    if (!summary && topCard.headline) summary = topCard.headline;
    if (summary) result.story = { summary };
    if (!aboutSection) warnings.push('No About section found; used the headline as the summary.');

    // --- Experience ------------------------------------------------------
    const experienceSection = findSection(document, 'experience');
    if (experienceSection) {
      result.experiences = sectionEntries(experienceSection).flatMap((li) => {
        try {
          return parseExperienceEntry(li);
        } catch {
          return [];
        }
      });
      if (result.experiences.length === 0) warnings.push('Experience section found but no entries could be parsed.');
    } else {
      warnings.push('No Experience section found.');
    }

    // --- Education -------------------------------------------------------
    const educationSection = findSection(document, 'education');
    if (educationSection) {
      result.education = sectionEntries(educationSection)
        .map((li) => {
          try {
            return parseEducationEntry(li, currentYear);
          } catch {
            return null;
          }
        })
        .filter((e): e is Omit<ProfileEducation, 'id'> => !!e);
      if (result.education.length === 0) warnings.push('Education section found but no entries could be parsed.');
    } else {
      warnings.push('No Education section found.');
    }

    // --- Skills ----------------------------------------------------------
    const skillsSection = findSection(document, 'skills');
    const skillNames: string[] = [];
    if (skillsSection) {
      for (const li of sectionEntries(skillsSection)) {
        const name = parseSkillEntry(li);
        if (name) skillNames.push(name);
      }
      if (hasShowAllControl(skillsSection, 'skills')) {
        warnings.push(`Only ${skillNames.length} skills visible; open /details/skills/ for the full list`);
      }
    } else {
      warnings.push('No Skills section found.');
    }
    for (const experience of result.experiences || []) {
      for (const skill of experience.skillsUsed || []) skillNames.push(skill);
    }
    if (skillNames.length > 0) result.skills = dedupeSkills(skillNames);

    // --- Certifications --------------------------------------------------
    const certificationsSection = findSection(document, 'certifications');
    if (certificationsSection) {
      result.certifications = sectionEntries(certificationsSection)
        .map((li) => {
          try {
            return parseCertificationEntry(li);
          } catch {
            return null;
          }
        })
        .filter((c): c is Omit<ProfileCertification, 'id'> => !!c);
    } else {
      warnings.push('No Licenses & certifications section found.');
    }

    return result;
  } catch (err) {
    warnings.push(`LinkedIn profile scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}
