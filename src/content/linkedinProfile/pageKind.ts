/**
 * Classifies LinkedIn URLs into the page kinds the own-profile scraper knows
 * how to read. Pure string logic, shared by the content script and the
 * background importer.
 */

export type LinkedInPageKind =
  | 'profile'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'projects'
  | 'volunteering'
  | 'skills'
  | 'languages'
  | 'unknown';

const PROFILE_URL_PATTERN =
  /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/in\/[^/?#\s]+(?:[/?#].*)?$/i;

const DETAILS_PATH_PATTERN = /\/in\/[^/?#]+\/details\/([a-z_-]+)\/?(?:[?#].*)?$/i;

/** True for `linkedin.com/in/<slug>` (including `/in/me`) and its `/details/*` sub-pages. */
export function isLinkedInProfileUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return PROFILE_URL_PATTERN.test(url.trim());
}

const DETAILS_KINDS: Record<string, LinkedInPageKind> = {
  experience: 'experience',
  education: 'education',
  certifications: 'certifications',
  licenses_and_certifications: 'certifications',
  projects: 'projects',
  'volunteering-experiences': 'volunteering',
  volunteering: 'volunteering',
  skills: 'skills',
  languages: 'languages',
};

/**
 * `/in/<slug>/details/experience/` -> 'experience', `/in/<slug>/` -> 'profile',
 * anything that is not a profile page (or a details page we cannot read) -> 'unknown'.
 */
export function detectLinkedInPageKind(url: string): LinkedInPageKind {
  if (!isLinkedInProfileUrl(url)) return 'unknown';
  const details = DETAILS_PATH_PATTERN.exec(url.trim());
  if (!details) return 'profile';
  return DETAILS_KINDS[details[1].toLowerCase()] || 'unknown';
}

/** The `/details/<segment>/` path segment LinkedIn uses for a page kind. */
export function detailsPathFor(kind: LinkedInPageKind): string | null {
  switch (kind) {
    case 'experience':
      return 'experience';
    case 'education':
      return 'education';
    case 'certifications':
      return 'certifications';
    case 'projects':
      return 'projects';
    case 'volunteering':
      return 'volunteering-experiences';
    case 'skills':
      return 'skills';
    case 'languages':
      return 'languages';
    default:
      return null;
  }
}
