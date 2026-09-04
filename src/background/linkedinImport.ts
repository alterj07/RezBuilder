/**
 * Background-side orchestration of the "Import from LinkedIn" flow.
 *
 * LinkedIn's API does not expose skills/experience to third-party apps, so the
 * import opens the user's own profile (`/in/me/` redirects to the signed-in
 * profile) and asks that tab's content script to scrape the DOM.
 *
 * The main profile page only renders its top card; every other section stays a
 * skeleton until the user physically scrolls. The per-section detail pages
 * (`/in/<slug>/details/<section>/`) render fully within a few seconds without
 * scrolling, so the import walks them one after another in the same tab:
 *
 *   1. profile page → top card (+ any section that happened to render)
 *   2-7. experience, education, certifications, projects, volunteering, skills
 *   8. navigate the tab back to the profile page (best effort)
 *
 * Each step broadcasts `LINKEDIN_IMPORT_PROGRESS`; a failed page never aborts
 * the import and can be retried alone with `IMPORT_LINKEDIN_SECTION`. The tab
 * is deliberately left open so the user can see what was read.
 *
 * Everything is timer-driven with `setTimeout` so tests can use fake timers.
 */

import type { ProfileImport } from '../types/profile';

export const LINKEDIN_ME_URL = 'https://www.linkedin.com/in/me/';

export const LINKEDIN_SIGN_IN_ERROR = 'Please sign in to LinkedIn, then try again.';
export const LINKEDIN_LOAD_TIMEOUT_ERROR = 'LinkedIn took too long to load. Please try again.';
export const LINKEDIN_SCRAPE_FAILED_ERROR =
  'Could not read your LinkedIn profile. Make sure the profile page finished loading, then try again.';
export const LINKEDIN_IMPORT_BUSY_ERROR = 'A LinkedIn import is already running.';
export const LINKEDIN_IMPORT_CANCELLED_WARNING = 'Import cancelled; the pages read so far were kept.';

/** Error the content script returns while the page is still a skeleton. */
export const LINKEDIN_NOT_RENDERED_ERROR = 'LinkedIn profile has not finished rendering yet.';

export type LinkedInSectionKind =
  | 'experience'
  | 'education'
  | 'certifications'
  | 'projects'
  | 'volunteering'
  | 'skills';

export type LinkedInPageKind = 'profile' | LinkedInSectionKind;

export interface LinkedInSection {
  kind: LinkedInSectionKind;
  /** Path under `https://www.linkedin.com/in/<slug>/`. */
  path: string;
  /** Human label used in progress and summary lines. */
  label: string;
}

/** Detail pages visited after the top card, in order. */
export const LINKEDIN_SECTIONS: readonly LinkedInSection[] = [
  { kind: 'experience', path: 'details/experience/', label: 'Experience' },
  { kind: 'education', path: 'details/education/', label: 'Education' },
  { kind: 'certifications', path: 'details/certifications/', label: 'Certifications' },
  { kind: 'projects', path: 'details/projects/', label: 'Projects' },
  { kind: 'volunteering', path: 'details/volunteering-experiences/', label: 'Volunteering' },
  { kind: 'skills', path: 'details/skills/', label: 'Skills' },
];

/** Profile page + one step per section. */
export const LINKEDIN_IMPORT_TOTAL_STEPS = 1 + LINKEDIN_SECTIONS.length;

export type LinkedInPageStatusKind = 'ok' | 'empty' | 'error';

export interface LinkedInPageStatus {
  kind: LinkedInPageKind;
  /**
   * `ok`: the page rendered (count may be 0 when the section is genuinely empty
   * and the content script confirmed it rendered). `empty`: the page never
   * rendered anything usable. `error`: the tab could not be navigated or messaged.
   */
  status: LinkedInPageStatusKind;
  /** Entries read from that page (top-card fields + entries for the profile page). */
  count: number;
}

/** Broadcast via `chrome.runtime.sendMessage` before each step. */
export interface LinkedInImportProgress {
  type: 'LINKEDIN_IMPORT_PROGRESS';
  /** 1-based step number. */
  step: number;
  total: number;
  label: string;
  kind: LinkedInPageKind;
}

export interface LinkedInImportOptions {
  /** How long to wait for the profile page to finish loading. Default 20 s. */
  loadTimeoutMs?: number;
  /** How long to wait for a section page to finish loading. Default 15 s. */
  sectionLoadTimeoutMs?: number;
  /** Scrape attempts on the profile page. Default 6. */
  scrapeAttempts?: number;
  /** Scrape attempts on a section page. Default 5. */
  sectionScrapeAttempts?: number;
  /** Scrape attempts on the (flaky) skills page. Default 8. */
  skillsScrapeAttempts?: number;
  /** Pause between scrape attempts. Default 1.5 s. */
  scrapeIntervalMs?: number;
  /** Pause after a section page reports `complete` before the first scrape. Default 600 ms. */
  pagePauseMs?: number;
}

export interface LinkedInSectionImportOptions extends LinkedInImportOptions {
  /** Reuse this tab (created by an earlier import). A new tab is opened when it no longer exists. */
  tabId?: number;
  /** Profile slug (`/in/<slug>/`); resolved from the tab URL or `me` when omitted. */
  slug?: string;
  /** Names (companies, schools, certifications, projects) the scraper may see as skill context lines. */
  knownContextNames?: string[];
}

export interface LinkedInImportResult {
  /** True when the top card or any section page produced data. */
  success: boolean;
  profile?: ProfileImport;
  error?: string;
  /** The LinkedIn tab that was used, so the UI can retry a section in it. */
  tabId?: number;
  /** One entry per page visited, in visit order. */
  pages: LinkedInPageStatus[];
  /** Set when `CANCEL_LINKEDIN_IMPORT` stopped the import early. */
  cancelled?: boolean;
}

/** Message types routed to `handleLinkedInImportMessage`. */
export const LINKEDIN_IMPORT_MESSAGE_TYPES = [
  'IMPORT_LINKEDIN_PROFILE',
  'IMPORT_LINKEDIN_SECTION',
  'CANCEL_LINKEDIN_IMPORT',
] as const;

export type LinkedInImportMessageType = (typeof LINKEDIN_IMPORT_MESSAGE_TYPES)[number];

interface ScrapeResponse {
  success: boolean;
  profile?: ProfileImport;
  error?: string;
  page?: string;
  rendered?: string[];
}

interface ScrapeOutcome {
  response?: ScrapeResponse;
  /** Set when the tab could not be messaged at all (no content script, tab gone). */
  transportError?: string;
}

interface PollResult {
  profile?: ProfileImport;
  status: LinkedInPageStatusKind;
  count: number;
  error?: string;
}

interface SectionOutcome extends PollResult {
  loginWall?: boolean;
  warning?: string;
}

const DEFAULTS: Required<LinkedInImportOptions> = {
  loadTimeoutMs: 20_000,
  sectionLoadTimeoutMs: 15_000,
  scrapeAttempts: 6,
  sectionScrapeAttempts: 5,
  skillsScrapeAttempts: 8,
  scrapeIntervalMs: 1_500,
  pagePauseMs: 600,
};

// --- module state -----------------------------------------------------------

let importRunning = false;
let cancelRequested = false;

/** Requests that the running import stops after its current page. */
export function cancelLinkedInImport(): { success: boolean; cancelled: boolean } {
  cancelRequested = true;
  return { success: true, cancelled: importRunning };
}

// --- helpers ----------------------------------------------------------------

/** LinkedIn bounced the tab to sign-in / verification instead of the profile. */
export function isLinkedInLoginUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /linkedin\.com\/(?:login|checkpoint|authwall|uas\/login|signup)/i.test(url) || /\/(?:login|checkpoint|authwall)(?:[/?#]|$)/i.test(url);
}

/** `https://www.linkedin.com/in/jane-doe-123/details/skills/?x=1` → `jane-doe-123`. */
export function resolveLinkedInSlug(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = /linkedin\.com\/in\/([^/?#]+)/i.exec(url);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Builds `https://www.linkedin.com/in/<slug>/<path>`. */
export function linkedInProfileUrl(slug: string, path = ''): string {
  return `https://www.linkedin.com/in/${slug}/${path}`;
}

function urlHasPath(url: string | undefined | null, path: string): boolean {
  if (!url) return false;
  const wanted = path.replace(/\/+$/, '');
  return new RegExp(`/in/[^/?#]+/${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?#]|$)`, 'i').test(url);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normKey(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function broadcastProgress(step: number, total: number, label: string, kind: LinkedInPageKind): void {
  const message: LinkedInImportProgress = { type: 'LINKEDIN_IMPORT_PROGRESS', step, total, label, kind };
  try {
    const maybePromise = chrome.runtime.sendMessage(message) as unknown;
    if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
      (maybePromise as Promise<unknown>).catch(() => {
        // Nobody is listening (side panel closed) — progress is best effort.
      });
    }
  } catch {
    // Same: best effort.
  }
}

async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return (await chrome.tabs.get(tabId)) || undefined;
  } catch {
    return undefined;
  }
}

async function getTabUrl(tabId: number): Promise<string | undefined> {
  const tab = await getTab(tabId);
  return tab?.url || tab?.pendingUrl || undefined;
}

/**
 * Resolves with the tab's URL once it reports `status: 'complete'`, or with
 * `null` on timeout. When `expectedUrl` is given, an already-complete tab is
 * only accepted immediately if it sits on that URL (so a navigation that has
 * not started yet is not mistaken for a finished one).
 */
function waitForTabLoad(tabId: number, timeoutMs: number, expectedUrl?: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        chrome.tabs.onUpdated.removeListener(listener);
      } catch {
        // Listener registry unavailable (test harness) — nothing to clean up.
      }
      resolve(url);
    };

    const listener = (updatedTabId: number, changeInfo: { status?: string; url?: string }, tab?: { url?: string }) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      finish(changeInfo.url || tab?.url || '');
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);

    // The tab may have finished loading before the listener was attached.
    (async () => {
      const tab = await getTab(tabId);
      if (!tab || tab.status !== 'complete' || !tab.url || tab.url === 'about:blank') return;
      if (expectedUrl && tab.url.split(/[?#]/)[0] !== expectedUrl.split(/[?#]/)[0]) return;
      finish(tab.url);
    })();
  });
}

/** Navigates the tab and waits for it to load. `null` = timeout; `error` = the tab is gone. */
async function navigateTab(
  tabId: number,
  url: string,
  timeoutMs: number
): Promise<{ url: string | null; error?: string }> {
  const loaded = waitForTabLoad(tabId, timeoutMs, url);
  try {
    await chrome.tabs.update(tabId, { url });
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'LinkedIn tab is no longer open.' };
  }
  return { url: await loaded };
}

async function scrapeOnce(tabId: number, knownContextNames?: string[]): Promise<ScrapeOutcome> {
  const message: { type: 'SCRAPE_LINKEDIN_PROFILE'; options?: { knownContextNames?: string[] } } = {
    type: 'SCRAPE_LINKEDIN_PROFILE',
  };
  if (knownContextNames) message.options = { knownContextNames };
  try {
    const response = (await chrome.tabs.sendMessage(tabId, message)) as ScrapeResponse | undefined;
    if (!response || typeof response !== 'object') {
      return { transportError: 'LinkedIn page did not respond.' };
    }
    return { response };
  } catch (err) {
    return { transportError: err instanceof Error ? err.message : 'LinkedIn page is not ready yet.' };
  }
}

function contactFieldCount(profile: ProfileImport | undefined): number {
  if (!profile?.contact) return 0;
  return Object.values(profile.contact).filter(hasText).length;
}

function entryCount(profile: ProfileImport | undefined): number {
  if (!profile) return 0;
  return (
    (profile.experiences?.length || 0) +
    (profile.education?.length || 0) +
    (profile.certifications?.length || 0) +
    (profile.skills?.length || 0)
  );
}

/** Entries a page of the given kind contributed. */
function countFor(kind: LinkedInPageKind, profile: ProfileImport | undefined): number {
  if (!profile) return 0;
  switch (kind) {
    case 'profile':
      return contactFieldCount(profile) + entryCount(profile);
    case 'experience':
    case 'projects':
    case 'volunteering':
      return profile.experiences?.length || 0;
    case 'education':
      return profile.education?.length || 0;
    case 'certifications':
      return profile.certifications?.length || 0;
    case 'skills':
      return profile.skills?.length || 0;
  }
}

function hasAnyData(profile: ProfileImport | undefined): boolean {
  if (!profile) return false;
  return contactFieldCount(profile) > 0 || entryCount(profile) > 0 || hasText(profile.story?.summary);
}

/** The scraper answered for a different page than the one we navigated to (navigation not committed yet). */
function isForeignPage(kind: LinkedInPageKind, response: ScrapeResponse): boolean {
  if (!response.page || response.page === 'unknown') return false;
  return response.page !== kind;
}

/**
 * Polls the content script until the page yields data for `kind`, or until
 * attempts run out. Returns the best profile seen and a page status.
 */
async function pollScrape(
  tabId: number,
  kind: LinkedInPageKind,
  attempts: number,
  intervalMs: number,
  knownContextNames?: string[]
): Promise<PollResult> {
  let best: ProfileImport | undefined;
  let responded = false;
  let renderedEmpty = false;
  let lastError: string | undefined;
  let lastTransportError: string | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const outcome = await scrapeOnce(tabId, knownContextNames);

    if (outcome.transportError !== undefined) {
      lastTransportError = outcome.transportError;
    } else if (outcome.response) {
      const response = outcome.response;
      if (isForeignPage(kind, response)) {
        lastError = LINKEDIN_NOT_RENDERED_ERROR;
      } else {
        responded = true;
        if (response.success && response.profile) {
          const count = countFor(kind, response.profile);
          if (count > 0 || (kind === 'profile' && hasAnyData(response.profile))) {
            return { profile: response.profile, status: 'ok', count };
          }
          if (!best) best = response.profile;
          if (response.rendered?.includes(kind)) renderedEmpty = true;
        } else {
          lastError = response.error || lastError;
        }
      }
    }

    if (cancelRequested || attempt === attempts) break;
    await sleep(intervalMs);
  }

  if (!responded) {
    return { profile: best, status: 'error', count: 0, error: lastTransportError || lastError || LINKEDIN_SCRAPE_FAILED_ERROR };
  }
  if (renderedEmpty) {
    // The content script saw the section rendered with nothing in it.
    return { profile: best, status: 'ok', count: 0 };
  }
  return { profile: best, status: 'empty', count: 0, error: lastError || LINKEDIN_NOT_RENDERED_ERROR };
}

function emptyPageWarning(section: LinkedInSection): string {
  return `${section.label} did not load — LinkedIn sometimes throttles this page. Scroll the LinkedIn tab, then use "Retry ${section.label.toLowerCase()}".`;
}

function errorPageWarning(section: LinkedInSection, error: string | undefined): string {
  return `${section.label} could not be read${error ? ` (${error})` : ''}. Use "Retry ${section.label.toLowerCase()}" to try again.`;
}

/** Names of companies, schools, certifications and projects gathered so far. */
export function collectKnownContextNames(profiles: ProfileImport[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const add = (value: string | undefined) => {
    if (!hasText(value)) return;
    const key = normKey(value);
    if (seen.has(key)) return;
    seen.add(key);
    names.push(value.trim());
  };
  for (const profile of profiles) {
    profile.certifications?.forEach((c) => add(c.name));
    profile.education?.forEach((e) => add(e.institution));
    profile.experiences?.forEach((x) => {
      add(x.company);
      if (x.type === 'project') add(x.title);
    });
  }
  return names;
}

/**
 * Navigates the tab to a section page and scrapes it. With `reuseCurrentPage`
 * the navigation is skipped when the tab already shows that page (so a user
 * who scrolled the skills page keeps what they loaded).
 */
async function importSectionPage(
  tabId: number,
  slug: string,
  section: LinkedInSection,
  settings: Required<LinkedInImportOptions>,
  knownContextNames: string[],
  reuseCurrentPage = false
): Promise<SectionOutcome> {
  const url = linkedInProfileUrl(slug, section.path);

  let loadedUrl: string | null = null;
  let alreadyThere = false;
  if (reuseCurrentPage) {
    const tab = await getTab(tabId);
    if (tab && tab.status === 'complete' && urlHasPath(tab.url, section.path)) {
      alreadyThere = true;
      loadedUrl = tab.url || url;
    }
  }

  if (!alreadyThere) {
    const nav = await navigateTab(tabId, url, settings.sectionLoadTimeoutMs);
    if (nav.error) {
      return { status: 'error', count: 0, error: nav.error, warning: errorPageWarning(section, nav.error) };
    }
    if (nav.url === null) {
      return {
        status: 'error',
        count: 0,
        error: LINKEDIN_LOAD_TIMEOUT_ERROR,
        warning: errorPageWarning(section, 'the page took too long to load'),
      };
    }
    loadedUrl = nav.url;
  }

  const finalUrl = (await getTabUrl(tabId)) || loadedUrl || url;
  if (isLinkedInLoginUrl(finalUrl)) {
    return { status: 'error', count: 0, error: LINKEDIN_SIGN_IN_ERROR, loginWall: true, warning: LINKEDIN_SIGN_IN_ERROR };
  }

  if (!alreadyThere && settings.pagePauseMs > 0) await sleep(settings.pagePauseMs);

  const attempts = section.kind === 'skills' ? settings.skillsScrapeAttempts : settings.sectionScrapeAttempts;
  const polled = await pollScrape(tabId, section.kind, attempts, settings.scrapeIntervalMs, knownContextNames);

  const outcome: SectionOutcome = { ...polled };
  if (polled.status === 'empty') outcome.warning = emptyPageWarning(section);
  else if (polled.status === 'error') {
    if (isLinkedInLoginUrl(await getTabUrl(tabId))) {
      outcome.loginWall = true;
      outcome.error = LINKEDIN_SIGN_IN_ERROR;
      outcome.warning = LINKEDIN_SIGN_IN_ERROR;
    } else {
      outcome.warning = errorPageWarning(section, polled.error);
    }
  }
  return outcome;
}

// --- merge ------------------------------------------------------------------

function dedupeBy<T>(entries: T[], keyOf: (entry: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of entries) {
    const key = keyOf(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/**
 * Combines the per-page imports into one `ProfileImport`.
 *
 * - Contact comes from the top card; section pages only fill fields it left empty.
 * - `story.summary` is the first non-empty one seen (top card first).
 * - Section arrays are concatenated — detail pages first, then whatever the
 *   profile page rendered opportunistically — and deduplicated
 *   case-insensitively (skills by name, experiences by company + title,
 *   education by institution + level, certifications by name).
 * - Warnings are concatenated and deduplicated.
 */
export function mergeLinkedInPages(input: {
  topCard?: ProfileImport;
  sections: ProfileImport[];
  warnings?: string[];
}): ProfileImport {
  const { topCard, sections } = input;
  const ordered = topCard ? [...sections, topCard] : sections;
  const storyOrder = topCard ? [topCard, ...sections] : sections;

  const merged: ProfileImport = { source: 'linkedin_page' };

  const contact: NonNullable<ProfileImport['contact']> = { ...(topCard?.contact || {}) };
  for (const page of sections) {
    for (const [key, value] of Object.entries(page.contact || {})) {
      const k = key as keyof typeof contact;
      if (!hasText(contact[k]) && hasText(value)) contact[k] = value;
    }
  }
  if (Object.values(contact).some(hasText)) merged.contact = contact;

  const withSummary = storyOrder.find((page) => hasText(page.story?.summary));
  const story = withSummary?.story || storyOrder.find((page) => page.story)?.story;
  if (story) merged.story = { ...story };

  const experiences = dedupeBy(
    ordered.flatMap((page) => page.experiences || []),
    (x) => `${normKey(x.company)}|${normKey(x.title)}|${x.type || ''}`
  );
  if (experiences.length > 0) merged.experiences = experiences;

  const education = dedupeBy(
    ordered.flatMap((page) => page.education || []),
    (e) => `${normKey(e.institution)}|${e.degreeLevel}`
  );
  if (education.length > 0) merged.education = education;

  const certifications = dedupeBy(ordered.flatMap((page) => page.certifications || []), (c) => normKey(c.name));
  if (certifications.length > 0) merged.certifications = certifications;

  const skills = dedupeBy(ordered.flatMap((page) => page.skills || []), (s) => normKey(s.name));
  if (skills.length > 0) merged.skills = skills;

  const warnings = dedupeBy(
    [...storyOrder.flatMap((page) => page.warnings || []), ...(input.warnings || [])].filter(hasText),
    (w) => w.trim()
  );
  if (warnings.length > 0) merged.warnings = warnings;

  return merged;
}

// --- public flows -----------------------------------------------------------

/**
 * Opens the user's LinkedIn profile in a new tab, reads the top card, then
 * walks the per-section detail pages and merges everything into one import.
 *
 * Never throws for a failed page: each page gets a `pages` entry and, when it
 * yielded nothing, a warning telling the user how to retry it.
 */
export async function importLinkedInProfile(options: LinkedInImportOptions = {}): Promise<LinkedInImportResult> {
  if (importRunning) {
    return { success: false, error: LINKEDIN_IMPORT_BUSY_ERROR, pages: [] };
  }
  importRunning = true;
  cancelRequested = false;
  try {
    return await runProfileImport({ ...DEFAULTS, ...options });
  } finally {
    importRunning = false;
  }
}

async function runProfileImport(settings: Required<LinkedInImportOptions>): Promise<LinkedInImportResult> {
  const pages: LinkedInPageStatus[] = [];
  const total = LINKEDIN_IMPORT_TOTAL_STEPS;

  // Step 1: the profile page (top card).
  broadcastProgress(1, total, 'Profile', 'profile');

  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: LINKEDIN_ME_URL, active: true });
    tabId = tab?.id;
  } catch (err) {
    return { success: false, error: `Could not open LinkedIn: ${err instanceof Error ? err.message : String(err)}`, pages };
  }
  if (typeof tabId !== 'number') {
    return { success: false, error: 'Could not open a LinkedIn tab.', pages };
  }

  const loadedUrl = await waitForTabLoad(tabId, settings.loadTimeoutMs);
  if (loadedUrl === null) {
    pages.push({ kind: 'profile', status: 'error', count: 0 });
    return { success: false, error: LINKEDIN_LOAD_TIMEOUT_ERROR, tabId, pages };
  }

  const finalUrl = (await getTabUrl(tabId)) || loadedUrl;
  if (isLinkedInLoginUrl(finalUrl)) {
    pages.push({ kind: 'profile', status: 'error', count: 0 });
    return { success: false, error: LINKEDIN_SIGN_IN_ERROR, tabId, pages };
  }

  const slug = resolveLinkedInSlug(finalUrl) || 'me';

  const topCard = await pollScrape(tabId, 'profile', settings.scrapeAttempts, settings.scrapeIntervalMs);
  pages.push({ kind: 'profile', status: topCard.status, count: topCard.count });

  if (!topCard.profile && isLinkedInLoginUrl(await getTabUrl(tabId))) {
    // A late redirect to sign-in shows up as the content script refusing the URL.
    return { success: false, error: LINKEDIN_SIGN_IN_ERROR, tabId, pages };
  }

  const warnings: string[] = [];
  if (topCard.status === 'error' && topCard.error) warnings.push(`Profile page could not be read (${topCard.error}).`);

  const sectionProfiles: ProfileImport[] = [];
  const gathered = (): ProfileImport[] => (topCard.profile ? [topCard.profile, ...sectionProfiles] : sectionProfiles);
  let visitedSection = false;
  let loginWall = false;

  // Steps 2-7: the detail pages.
  for (let i = 0; i < LINKEDIN_SECTIONS.length; i++) {
    if (cancelRequested || loginWall) break;
    const section = LINKEDIN_SECTIONS[i];
    broadcastProgress(i + 2, total, section.label, section.kind);
    visitedSection = true;

    const outcome = await importSectionPage(tabId, slug, section, settings, collectKnownContextNames(gathered()));
    pages.push({ kind: section.kind, status: outcome.status, count: outcome.count });
    if (outcome.profile && outcome.count > 0) sectionProfiles.push(outcome.profile);
    if (outcome.warning) warnings.push(outcome.warning);
    if (outcome.loginWall) loginWall = true;
  }

  const cancelled = cancelRequested;
  if (cancelled) warnings.push(LINKEDIN_IMPORT_CANCELLED_WARNING);

  // Step 8: leave the tab on the profile page (best effort, not awaited).
  if (visitedSection) {
    try {
      const back = chrome.tabs.update(tabId, { url: linkedInProfileUrl(slug) }) as unknown;
      if (back && typeof (back as Promise<unknown>).catch === 'function') {
        (back as Promise<unknown>).catch(() => {
          // The tab may have been closed; nothing to restore.
        });
      }
    } catch {
      // Same.
    }
  }

  const merged = mergeLinkedInPages({ topCard: topCard.profile, sections: sectionProfiles, warnings });
  const success = hasAnyData(merged);

  const result: LinkedInImportResult = { success, tabId, pages };
  if (success) result.profile = merged;
  else if (loginWall) result.error = LINKEDIN_SIGN_IN_ERROR;
  else result.error = topCard.error || LINKEDIN_SCRAPE_FAILED_ERROR;
  if (cancelled) result.cancelled = true;
  return result;
}

/**
 * Re-reads one section page, reusing the import tab when it is still open
 * (and skipping the navigation when the tab already shows that page).
 */
export async function importLinkedInSection(
  kind: LinkedInSectionKind,
  options: LinkedInSectionImportOptions = {}
): Promise<LinkedInImportResult> {
  const section = LINKEDIN_SECTIONS.find((s) => s.kind === kind);
  if (!section) {
    return { success: false, error: `Unknown LinkedIn section "${String(kind)}".`, pages: [] };
  }
  if (importRunning) {
    return { success: false, error: LINKEDIN_IMPORT_BUSY_ERROR, pages: [] };
  }
  importRunning = true;
  cancelRequested = false;
  try {
    return await runSectionImport(section, { ...DEFAULTS, ...options });
  } finally {
    importRunning = false;
  }
}

async function runSectionImport(
  section: LinkedInSection,
  settings: Required<LinkedInImportOptions> & LinkedInSectionImportOptions
): Promise<LinkedInImportResult> {
  broadcastProgress(1, 1, section.label, section.kind);

  let tabId = typeof settings.tabId === 'number' ? settings.tabId : undefined;
  let slug = hasText(settings.slug) ? settings.slug.trim() : undefined;

  if (tabId !== undefined) {
    const tab = await getTab(tabId);
    if (!tab) tabId = undefined;
    else if (!slug) slug = resolveLinkedInSlug(tab.url || tab.pendingUrl) || undefined;
  }

  const pages: LinkedInPageStatus[] = [];

  if (tabId === undefined) {
    // No usable tab: open the section page directly (`/in/me/…` redirects to the slug).
    const url = linkedInProfileUrl(slug || 'me', section.path);
    try {
      const tab = await chrome.tabs.create({ url, active: true });
      tabId = tab?.id;
    } catch (err) {
      return { success: false, error: `Could not open LinkedIn: ${err instanceof Error ? err.message : String(err)}`, pages };
    }
    if (typeof tabId !== 'number') {
      return { success: false, error: 'Could not open a LinkedIn tab.', pages };
    }
    const loadedUrl = await waitForTabLoad(tabId, settings.loadTimeoutMs);
    if (loadedUrl === null) {
      pages.push({ kind: section.kind, status: 'error', count: 0 });
      return { success: false, error: LINKEDIN_LOAD_TIMEOUT_ERROR, tabId, pages };
    }
    const finalUrl = (await getTabUrl(tabId)) || loadedUrl;
    if (isLinkedInLoginUrl(finalUrl)) {
      pages.push({ kind: section.kind, status: 'error', count: 0 });
      return { success: false, error: LINKEDIN_SIGN_IN_ERROR, tabId, pages };
    }
    if (!slug) slug = resolveLinkedInSlug(finalUrl) || undefined;
    if (settings.pagePauseMs > 0) await sleep(settings.pagePauseMs);
  }

  const outcome = await importSectionPage(
    tabId,
    slug || 'me',
    section,
    settings,
    settings.knownContextNames || [],
    true
  );
  pages.push({ kind: section.kind, status: outcome.status, count: outcome.count });

  if (outcome.loginWall) {
    return { success: false, error: LINKEDIN_SIGN_IN_ERROR, tabId, pages };
  }

  const success = outcome.count > 0;
  const result: LinkedInImportResult = { success, tabId, pages };
  if (success && outcome.profile) {
    result.profile = mergeLinkedInPages({ sections: [outcome.profile], warnings: outcome.warning ? [outcome.warning] : [] });
  } else {
    result.error = outcome.warning || outcome.error || LINKEDIN_SCRAPE_FAILED_ERROR;
    if (outcome.profile) result.profile = mergeLinkedInPages({ sections: [outcome.profile] });
  }
  return result;
}

// --- message routing --------------------------------------------------------

/** Shape of the messages `handleLinkedInImportMessage` accepts. */
export interface LinkedInImportMessage {
  type: LinkedInImportMessageType;
  /** `IMPORT_LINKEDIN_SECTION` only. */
  kind?: string;
  tabId?: number;
  slug?: string;
  knownContextNames?: unknown[];
}

export function isLinkedInImportMessage(message: { type?: string } | undefined): message is LinkedInImportMessage {
  return !!message && (LINKEDIN_IMPORT_MESSAGE_TYPES as readonly string[]).includes(message.type || '');
}

/**
 * `chrome.runtime.onMessage` handler for `IMPORT_LINKEDIN_PROFILE`,
 * `IMPORT_LINKEDIN_SECTION` and `CANCEL_LINKEDIN_IMPORT`. Returns true when the
 * message was handled (response is delivered asynchronously).
 */
export function handleLinkedInImportMessage(
  message: { type?: string } | undefined,
  sendResponse: (response: LinkedInImportResult | { success: boolean; cancelled: boolean }) => void
): boolean {
  if (!isLinkedInImportMessage(message)) return false;

  if (message.type === 'CANCEL_LINKEDIN_IMPORT') {
    sendResponse(cancelLinkedInImport());
    return true;
  }

  const run =
    message.type === 'IMPORT_LINKEDIN_SECTION'
      ? importLinkedInSection(message.kind as LinkedInSectionKind, {
          tabId: typeof message.tabId === 'number' ? message.tabId : undefined,
          slug: typeof message.slug === 'string' ? message.slug : undefined,
          knownContextNames: Array.isArray(message.knownContextNames)
            ? message.knownContextNames.filter((n): n is string => typeof n === 'string')
            : undefined,
        })
      : importLinkedInProfile();

  run.then(sendResponse).catch((err) => {
    sendResponse({
      success: false,
      error: err instanceof Error ? err.message : 'LinkedIn import failed.',
      pages: [],
    });
  });
  return true;
}
