/**
 * Background-side orchestration of the "Import from LinkedIn" flow.
 *
 * LinkedIn's API does not expose skills/experience to third-party apps, so the
 * import opens the user's own profile (`/in/me/` redirects to the signed-in
 * profile) and asks that tab's content script to scrape the DOM. LinkedIn
 * renders profile sections lazily, so the scrape is polled a few times.
 *
 * The tab is deliberately left open: the user can see what was read and open
 * `/details/skills/` for the full skill list.
 */

import { ProfileImport } from '../types/profile';

export const LINKEDIN_ME_URL = 'https://www.linkedin.com/in/me/';

export const LINKEDIN_SIGN_IN_ERROR = 'Please sign in to LinkedIn, then try again.';
export const LINKEDIN_LOAD_TIMEOUT_ERROR = 'LinkedIn took too long to load. Please try again.';
export const LINKEDIN_SCRAPE_FAILED_ERROR =
  'Could not read your LinkedIn profile. Make sure the profile page finished loading, then try again.';

export interface LinkedInImportOptions {
  /** How long to wait for the profile tab to finish loading. Default 20 s. */
  loadTimeoutMs?: number;
  /** How many times to ask the content script for the profile. Default 6. */
  scrapeAttempts?: number;
  /** Pause between scrape attempts. Default 1.5 s. */
  scrapeIntervalMs?: number;
}

export interface LinkedInImportResult {
  success: boolean;
  profile?: ProfileImport;
  error?: string;
  /** The LinkedIn tab that was opened, so the UI can focus or close it. */
  tabId?: number;
}

interface ScrapeResponse {
  success: boolean;
  profile?: ProfileImport;
  error?: string;
}

const DEFAULTS: Required<LinkedInImportOptions> = {
  loadTimeoutMs: 20_000,
  scrapeAttempts: 6,
  scrapeIntervalMs: 1_500,
};

/** LinkedIn bounced the tab to sign-in / verification instead of the profile. */
export function isLinkedInLoginUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /linkedin\.com\/(?:login|checkpoint|authwall|uas\/login|signup)/i.test(url) || /\/(?:login|checkpoint|authwall)(?:[/?#]|$)/i.test(url);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTabUrl(tabId: number): Promise<string | undefined> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab?.url || tab?.pendingUrl || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves with the tab's URL once it reports `status: 'complete'`, or with
 * `null` on timeout. Also resolves immediately when the tab is already loaded.
 */
function waitForTabLoad(tabId: number, timeoutMs: number): Promise<string | null> {
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
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab?.status === 'complete' && tab.url && tab.url !== 'about:blank') finish(tab.url);
      } catch {
        // Tab lookup failed; rely on onUpdated.
      }
    })();
  });
}

async function scrapeOnce(tabId: number): Promise<ScrapeResponse> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_LINKEDIN_PROFILE' })) as
      | ScrapeResponse
      | undefined;
    if (!response || typeof response !== 'object') {
      return { success: false, error: 'LinkedIn page did not respond.' };
    }
    return response;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'LinkedIn page is not ready yet.',
    };
  }
}

function hasSectionData(profile: ProfileImport | undefined): boolean {
  if (!profile) return false;
  return (
    (profile.experiences?.length || 0) > 0 ||
    (profile.education?.length || 0) > 0 ||
    (profile.skills?.length || 0) > 0 ||
    (profile.certifications?.length || 0) > 0
  );
}

/**
 * Opens the user's LinkedIn profile in a new tab and scrapes it.
 *
 * Polls the content script until it returns a profile with at least one
 * populated section, or until attempts run out — in which case the best
 * profile seen so far (possibly just the name) is returned.
 */
export async function importLinkedInProfile(options: LinkedInImportOptions = {}): Promise<LinkedInImportResult> {
  const settings = { ...DEFAULTS, ...options };

  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: LINKEDIN_ME_URL, active: true });
    tabId = tab?.id;
  } catch (err) {
    return { success: false, error: `Could not open LinkedIn: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (typeof tabId !== 'number') {
    return { success: false, error: 'Could not open a LinkedIn tab.' };
  }

  const loadedUrl = await waitForTabLoad(tabId, settings.loadTimeoutMs);
  if (loadedUrl === null) {
    return { success: false, error: LINKEDIN_LOAD_TIMEOUT_ERROR, tabId };
  }

  const finalUrl = (await getTabUrl(tabId)) || loadedUrl;
  if (isLinkedInLoginUrl(finalUrl)) {
    return { success: false, error: LINKEDIN_SIGN_IN_ERROR, tabId };
  }

  let lastError: string | undefined;
  let bestProfile: ProfileImport | undefined;

  for (let attempt = 1; attempt <= settings.scrapeAttempts; attempt++) {
    const response = await scrapeOnce(tabId);

    if (response.success && response.profile) {
      bestProfile = response.profile;
      if (hasSectionData(response.profile)) {
        return { success: true, profile: response.profile, tabId };
      }
    } else {
      lastError = response.error || lastError;
      // A late redirect to sign-in shows up as the content script refusing the URL.
      if (isLinkedInLoginUrl(await getTabUrl(tabId))) {
        return { success: false, error: LINKEDIN_SIGN_IN_ERROR, tabId };
      }
    }

    if (attempt < settings.scrapeAttempts) await sleep(settings.scrapeIntervalMs);
  }

  if (bestProfile) {
    return { success: true, profile: bestProfile, tabId };
  }
  return { success: false, error: lastError || LINKEDIN_SCRAPE_FAILED_ERROR, tabId };
}

/**
 * `chrome.runtime.onMessage` handler for `IMPORT_LINKEDIN_PROFILE`. Returns
 * true when the message was handled (response is delivered asynchronously).
 */
export function handleLinkedInImportMessage(
  message: { type?: string } | undefined,
  sendResponse: (response: LinkedInImportResult) => void
): boolean {
  if (!message || message.type !== 'IMPORT_LINKEDIN_PROFILE') return false;

  importLinkedInProfile()
    .then(sendResponse)
    .catch((err) => {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'LinkedIn import failed.',
      });
    });
  return true;
}
