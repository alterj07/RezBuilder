/**
 * Scrapes the signed-in user's OWN LinkedIn profile page into a `ProfileImport`.
 *
 * LinkedIn's public API does not expose skills/experience to third-party apps,
 * so this reads the rendered DOM. The 2026 layout has no stable ids, no `h1`
 * and no duplicated screen-reader spans; what is stable is the *text*: every
 * section renders a predictable sequence of lines. The scraper therefore only
 * locates the right element (top card, section card, details section), turns
 * it into lines (`domLines.ts`) and hands them to pure parsers
 * (`lineParser.ts`). The pre-2026 DOM is handled by `legacyScraper.ts` as a
 * fallback when the new path finds nothing.
 *
 * Everything is defensive: the scraper never throws, and anything it could not
 * find is reported through `warnings`.
 */

import { ProfileImport, SkillRating } from '../../types/profile';
import { elementLines } from './domLines';
import { scrapeLinkedInProfileLegacy } from './legacyScraper';
import {
  SectionKey,
  cleanLine,
  isNoiseLine,
  parseAboutLines,
  parseCertificationLines,
  parseEducationLines,
  parseExperienceLines,
  parseProjectLines,
  parseSkillsLines,
  parseTopCardLines,
  parseVolunteeringLines,
  sectionKeyForHeading,
  trimSectionLines,
} from './lineParser';
import { LinkedInPageKind, detectLinkedInPageKind, isLinkedInProfileUrl } from './pageKind';

export { isLinkedInProfileUrl, detectLinkedInPageKind } from './pageKind';
export type { LinkedInPageKind } from './pageKind';
export { inferDegreeLevel } from '../../services/profile/inference';

export interface ScrapeOptions {
  /**
   * Names that appear as context lines on the Skills page (certification,
   * education and project names) and must not be read as skills.
   */
  knownContextNames?: string[];
}

/** A section that produced at least one item. */
export type RenderedSection =
  | 'topCard'
  | 'about'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'projects'
  | 'volunteering'
  | 'skills';

export interface LinkedInPageScrape {
  profile: ProfileImport;
  page: LinkedInPageKind;
  rendered: RenderedSection[];
}

const DEFAULT_SKILL_RATING: SkillRating = 3;

// ---------------------------------------------------------------------------
// DOM lookup
// ---------------------------------------------------------------------------

function mainElement(doc: Document): Element | null {
  try {
    return doc.querySelector('main') || doc.body || doc.documentElement;
  } catch {
    return null;
  }
}

const SKILL_PILLS = /^(?:all|industry knowledge|tools & technologies|interpersonal skills|languages|other skills)$/i;

/** Lines that carry data, i.e. not the heading, the pills or UI chrome. */
function contentLines(lines: string[], key: SectionKey | null): string[] {
  const trimmed = trimSectionLines(lines);
  const body = trimmed.length > 0 && sectionKeyForHeading(trimmed[0]) ? trimmed.slice(1) : trimmed;
  return body.filter((line) => !isNoiseLine(line) && !(key === 'skills' && SKILL_PILLS.test(line)));
}

/** The top card: first `[data-testid="lazy-column"]` child, else the card around the first `main h2`. */
export function findTopCardElement(doc: Document): Element | null {
  try {
    const main = mainElement(doc);
    if (!main) return null;
    const column = main.querySelector('[data-testid="lazy-column"]');
    const firstCard = column?.children?.[0];
    if (firstCard) {
      const lines = elementLines(firstCard);
      if (lines.length > 0 && !sectionKeyForHeading(lines[0])) return firstCard;
    }
    // 2026 layout: the name is the first h2; pre-2026 layout: an h1.
    const heading =
      Array.from(main.querySelectorAll('h2')).find((h2) => !sectionKeyForHeading(cleanLine(h2.textContent))) ||
      main.querySelector('h1');
    if (!heading) return null;
    if (sectionKeyForHeading(cleanLine(heading.textContent))) return null;
    let card: Element | null = heading.closest('section, article, [data-testid]');
    if (!card || card === main) card = heading.parentElement;
    return card;
  } catch {
    return null;
  }
}

/** Heading text of a section card: its `h2`, else its first visible line. */
function sectionHeading(section: Element): string {
  try {
    const h2 = section.querySelector('h2, h3');
    if (h2) {
      const text = cleanLine(h2.textContent);
      if (text) return text;
    }
    return elementLines(section)[0] || '';
  } catch {
    return '';
  }
}

/** Section cards on the main profile page, keyed by section. Outermost match wins. */
export function findProfileSections(doc: Document): Partial<Record<SectionKey, Element>> {
  const found: Partial<Record<SectionKey, Element>> = {};
  try {
    const main = mainElement(doc);
    if (!main) return found;
    let candidates: Element[] = Array.from(main.querySelectorAll('section'));
    if (candidates.length === 0) {
      const column = main.querySelector('[data-testid="lazy-column"]');
      candidates = Array.from(column ? column.children : main.children);
    }
    for (const section of candidates) {
      const key = sectionKeyForHeading(sectionHeading(section));
      if (!key) continue;
      const existing = found[key];
      if (existing && existing.contains(section)) continue;
      found[key] = section;
    }
  } catch {
    // partial
  }
  return found;
}

const DETAIL_SECTION_KEY: Partial<Record<LinkedInPageKind, SectionKey>> = {
  experience: 'experience',
  education: 'education',
  certifications: 'certifications',
  projects: 'projects',
  volunteering: 'volunteering',
  skills: 'skills',
  languages: 'languages',
};

/**
 * Lines of the main section of a `/details/*` page: the largest `main section`
 * whose first line is the expected heading; else the heading's position inside
 * `main`'s lines. Empty when the heading is not on the page.
 */
export function findDetailSectionLines(doc: Document, page: LinkedInPageKind): string[] {
  const key = DETAIL_SECTION_KEY[page];
  if (!key) return [];
  try {
    const main = mainElement(doc);
    if (!main) return [];
    let best: string[] = [];
    let bestLength = -1;
    // The heading is the first line, allowing for an icon-only back button
    // or a stray label rendered before it.
    const headingIndex = (lines: string[]) =>
      lines.slice(0, 3).findIndex((line) => sectionKeyForHeading(line) === key);
    for (const section of Array.from(main.querySelectorAll('section'))) {
      const lines = elementLines(section);
      const start = headingIndex(lines);
      if (start === -1) continue;
      const length = lines.join('\n').length;
      if (length > bestLength) {
        best = lines.slice(start);
        bestLength = length;
      }
    }
    if (bestLength >= 0) return trimSectionLines(best);

    const all = elementLines(main);
    const index = all.findIndex((line) => sectionKeyForHeading(line) === key);
    return index === -1 ? [] : trimSectionLines(all.slice(index));
  } catch {
    return [];
  }
}

/**
 * Pre-2026 markers: an `h1` name, the old `pv-*`/`pvs-*` class names, the
 * anchor divs, or the duplicated `aria-hidden` text spans. The legacy scraper
 * reads `<ul>` lists, which on the 2026 layout would only find the footer.
 */
export function looksLikeLegacyLayout(doc: Document): boolean {
  try {
    if (doc.querySelector('main h1, .pv-top-card, .pvs-list, .pv-profile-card__anchor, .scaffold-layout__main, #experience, #about')) {
      return true;
    }
    return doc.querySelectorAll('main span[aria-hidden="true"]').length >= 3;
  } catch {
    return false;
  }
}

/** LinkedIn's 404 ("This page doesn't exist"). */
export function isNotFoundPage(doc: Document): boolean {
  try {
    const main = mainElement(doc);
    const text = cleanLine(main?.textContent || '').toLowerCase();
    return /this page doesn['’]t exist|page not found|couldn['’]t find the page/.test(text);
  } catch {
    return false;
  }
}

/** True once the page's section (or the top card) holds data beyond heading/pills. */
export function pageHasRenderedContent(doc: Document, page: LinkedInPageKind): boolean {
  try {
    if (page === 'profile') {
      const card = findTopCardElement(doc);
      return !!card && !!parseTopCardLines(elementLines(card)).name;
    }
    const key = DETAIL_SECTION_KEY[page] || null;
    return contentLines(findDetailSectionLines(doc, page), key).length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function canonicalUrl(doc: Document, url: string): string | undefined {
  try {
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    if (isLinkedInProfileUrl(canonical) && !/\/in\/me\/?(?:[?#]|$)/i.test(canonical)) {
      const slug = /^(https?:\/\/[^/]+\/in\/[^/?#]+)/i.exec(canonical);
      if (slug) return slug[1] + '/';
    }
  } catch {
    // fall through
  }
  if (isLinkedInProfileUrl(url) && !/\/in\/me\/?(?:[?#]|$)/i.test(url)) {
    const slug = /^(https?:\/\/[^/]+\/in\/[^/?#]+)/i.exec(url);
    return slug ? slug[1] + '/' : undefined;
  }
  return undefined;
}

class SkillCollector {
  private readonly seen = new Set<string>();
  readonly skills: { name: string; rating: SkillRating }[] = [];

  add(names: string[] | undefined): void {
    for (const raw of names || []) {
      const name = cleanLine(raw);
      const key = name.toLowerCase();
      if (!name || this.seen.has(key)) continue;
      this.seen.add(key);
      this.skills.push({ name, rating: DEFAULT_SKILL_RATING });
    }
  }
}

interface Assembly {
  profile: ProfileImport;
  rendered: RenderedSection[];
  skills: SkillCollector;
  warnings: string[];
}

function parseSectionLines(assembly: Assembly, key: SectionKey, lines: string[], options: ScrapeOptions): void {
  const { profile, rendered, skills } = assembly;
  switch (key) {
    case 'about': {
      const about = parseAboutLines(lines);
      if (about.summary) {
        profile.story = { ...(profile.story || {}), summary: about.summary };
        rendered.push('about');
      }
      skills.add(about.topSkills);
      break;
    }
    case 'experience': {
      const experiences = parseExperienceLines(lines);
      if (experiences.length > 0) {
        profile.experiences = [...(profile.experiences || []), ...experiences];
        rendered.push('experience');
      }
      for (const experience of experiences) skills.add(experience.skillsUsed);
      break;
    }
    case 'projects': {
      const projects = parseProjectLines(lines);
      if (projects.length > 0) {
        profile.experiences = [...(profile.experiences || []), ...projects];
        rendered.push('projects');
      }
      for (const project of projects) skills.add(project.skillsUsed);
      break;
    }
    case 'volunteering': {
      const volunteering = parseVolunteeringLines(lines);
      if (volunteering.length > 0) {
        profile.experiences = [...(profile.experiences || []), ...volunteering];
        rendered.push('volunteering');
      }
      for (const entry of volunteering) skills.add(entry.skillsUsed);
      break;
    }
    case 'education': {
      const education = parseEducationLines(lines);
      if (education.length > 0) {
        profile.education = [...(profile.education || []), ...education];
        rendered.push('education');
      }
      break;
    }
    case 'certifications': {
      const parsed = parseCertificationLines(lines);
      if (parsed.certifications.length > 0) {
        profile.certifications = [...(profile.certifications || []), ...parsed.certifications];
        rendered.push('certifications');
      }
      skills.add(parsed.skills);
      break;
    }
    case 'skills': {
      const names = parseSkillsLines(lines, options.knownContextNames || []);
      if (names.length > 0) rendered.push('skills');
      skills.add(names);
      break;
    }
    case 'languages':
      // Not imported: the profile has no language field yet.
      break;
  }
}

const MAIN_PAGE_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'about', label: 'About' },
  { key: 'experience', label: 'Experience' },
  { key: 'education', label: 'Education' },
  { key: 'certifications', label: 'Licenses & certifications' },
  { key: 'projects', label: 'Projects' },
  { key: 'volunteering', label: 'Volunteering' },
  { key: 'skills', label: 'Skills' },
];

function scrapeMainPage(doc: Document, assembly: Assembly, options: ScrapeOptions): void {
  const { profile, rendered, warnings } = assembly;

  const card = findTopCardElement(doc);
  const topCard = card ? parseTopCardLines(elementLines(card)) : {};
  if (topCard.name) {
    profile.contact = { ...(profile.contact || {}), name: topCard.name };
    if (topCard.location) profile.contact.location = topCard.location;
    rendered.push('topCard');
  } else {
    warnings.push('Could not find the profile name (top card not rendered yet?).');
  }

  const sections = findProfileSections(doc);
  for (const { key, label } of MAIN_PAGE_SECTIONS) {
    const section = sections[key];
    if (!section) {
      warnings.push(`${label} section has not loaded on the main page`);
      continue;
    }
    const before = rendered.length;
    parseSectionLines(assembly, key, elementLines(section), options);
    if (rendered.length === before && key !== 'skills') {
      warnings.push(`${label} section found but no entries could be parsed.`);
    }
  }

  if (!profile.story?.summary && topCard.headline) {
    profile.story = { ...(profile.story || {}), summary: topCard.headline };
    warnings.push('No About section found; used the headline as the summary.');
  }
}

function scrapeDetailPage(doc: Document, page: LinkedInPageKind, assembly: Assembly, options: ScrapeOptions): void {
  const key = DETAIL_SECTION_KEY[page];
  if (!key) return;
  const lines = findDetailSectionLines(doc, page);
  if (lines.length === 0) {
    assembly.warnings.push(`No ${page} section found on this details page.`);
    return;
  }
  parseSectionLines(assembly, key, lines, options);
  if (contentLines(lines, key).length === 0) {
    assembly.warnings.push(`The ${page} details page has not rendered its entries yet.`);
  }
}

function renderedFromProfile(profile: ProfileImport): RenderedSection[] {
  const rendered: RenderedSection[] = [];
  if (profile.contact?.name) rendered.push('topCard');
  if (profile.story?.summary) rendered.push('about');
  if (profile.experiences?.some((e) => e.type === 'project')) rendered.push('projects');
  if (profile.experiences?.some((e) => e.type === 'volunteer')) rendered.push('volunteering');
  if (profile.experiences?.some((e) => e.type !== 'project' && e.type !== 'volunteer')) rendered.push('experience');
  if (profile.education?.length) rendered.push('education');
  if (profile.certifications?.length) rendered.push('certifications');
  if (profile.skills?.length) rendered.push('skills');
  return rendered;
}

/**
 * Scrapes a LinkedIn profile page or one of its `/details/*` pages. Reports
 * which sections actually produced data so callers can tell "not rendered
 * yet" from "empty". Never throws.
 */
export function scrapeLinkedInPage(document: Document, url: string, options: ScrapeOptions = {}): LinkedInPageScrape {
  const page = detectLinkedInPageKind(url || '');
  const profile: ProfileImport = { source: 'linkedin_page', warnings: [] };
  const assembly: Assembly = { profile, rendered: [], skills: new SkillCollector(), warnings: profile.warnings as string[] };

  try {
    if (!document) {
      assembly.warnings.push('No document to scrape.');
      return { profile, page, rendered: [] };
    }
    if (page === 'unknown') {
      assembly.warnings.push('Not a LinkedIn profile page.');
      return { profile, page, rendered: [] };
    }
    if (isNotFoundPage(document)) {
      assembly.warnings.push('LinkedIn says this page does not exist.');
      return { profile, page, rendered: [] };
    }

    const linkedinUrl = canonicalUrl(document, url);
    if (linkedinUrl) profile.contact = { linkedinUrl };

    if (page === 'profile') {
      scrapeMainPage(document, assembly, options || {});
    } else {
      scrapeDetailPage(document, page, assembly, options || {});
    }

    if (assembly.skills.skills.length > 0) profile.skills = assembly.skills.skills;

    if (assembly.rendered.length === 0 && looksLikeLegacyLayout(document)) {
      // Pre-2026 markup: hand the page to the legacy scraper.
      const legacy = scrapeLinkedInProfileLegacy(document, url);
      const legacyRendered = renderedFromProfile(legacy);
      if (legacyRendered.length > 0) {
        legacy.warnings = [...(legacy.warnings || []), 'Parsed with the legacy LinkedIn layout scraper.'];
        if (legacy.skills) legacy.skills = legacy.skills.map((s) => ({ ...s, rating: s.rating || DEFAULT_SKILL_RATING }));
        return { profile: legacy, page, rendered: legacyRendered };
      }
    }

    return { profile, page, rendered: assembly.rendered };
  } catch (err) {
    assembly.warnings.push(`LinkedIn profile scrape failed: ${err instanceof Error ? err.message : String(err)}`);
    return { profile, page, rendered: assembly.rendered };
  }
}

/** Convenience wrapper returning only the partial profile. Never throws. */
export function scrapeLinkedInProfile(document: Document, url: string, options?: ScrapeOptions): ProfileImport {
  return scrapeLinkedInPage(document, url, options).profile;
}
