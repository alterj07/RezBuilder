import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockChrome, SetupMockChromeResult } from './helpers/mockChrome';
import { jobClassifier } from '../src/content/detection/jobClassifier';
import { createDomDocument } from './helpers/domUtils';
import {
  LINKEDIN_FULL_PROFILE_HTML,
  LINKEDIN_PROFILE_URL,
  LINKEDIN_AUTHWALL_URL,
  LINKEDIN_LOGIN_URL,
} from './fixtures/linkedinProfileFixtures';
import type { ProfileImport } from '../src/types/profile';

// ---------------------------------------------------------------------------
// Fixtures: what the content script answers on each LinkedIn page
// ---------------------------------------------------------------------------

const SLUG = 'jane-doe-123';
const PROFILE_URL = `https://www.linkedin.com/in/${SLUG}/`;
const SELF_PROFILE_URL = `${PROFILE_URL}?isSelfProfile=true`;
const ME_URL = 'https://www.linkedin.com/in/me/';

type PageKind = 'profile' | 'experience' | 'education' | 'certifications' | 'projects' | 'volunteering' | 'skills';

const SECTION_URLS: Record<Exclude<PageKind, 'profile'>, string> = {
  experience: `${PROFILE_URL}details/experience/`,
  education: `${PROFILE_URL}details/education/`,
  certifications: `${PROFILE_URL}details/certifications/`,
  projects: `${PROFILE_URL}details/projects/`,
  volunteering: `${PROFILE_URL}details/volunteering-experiences/`,
  skills: `${PROFILE_URL}details/skills/`,
};

const EXPECTED_VISIT_ORDER = [
  SECTION_URLS.experience,
  SECTION_URLS.education,
  SECTION_URLS.certifications,
  SECTION_URLS.projects,
  SECTION_URLS.volunteering,
  SECTION_URLS.skills,
];

const RENDERING = { success: false, error: 'LinkedIn profile has not finished rendering yet.', page: 'unknown', rendered: [] };

const TOP_CARD: ProfileImport = {
  source: 'linkedin_page',
  contact: { name: 'Jane Doe', location: 'Austin, Texas, United States', linkedinUrl: PROFILE_URL },
  story: { summary: '' },
};

const PAGES: Record<PageKind, ProfileImport> = {
  profile: TOP_CARD,
  experience: {
    source: 'linkedin_page',
    experiences: [
      { company: 'Date Maroon', title: 'Software Engineer Intern', type: 'internship', bullets: ['Ran UAT'], skillsUsed: ['Software Development'] },
      { company: 'SILVIA Health', title: 'Student Intern', type: 'internship', bullets: ['UI/UX testing'] },
      { company: 'NASA', title: 'NASA HAS Scholar', type: 'internship', bullets: ['Engineered a lunar habitat'] },
    ],
  },
  education: {
    source: 'linkedin_page',
    education: [{ institution: 'Texas A&M University', degreeLevel: 'bachelor', status: 'in_progress', graduationYear: 2030 }],
  },
  certifications: {
    source: 'linkedin_page',
    certifications: [
      { name: 'Introduction to Model Context Protocol', issuer: 'Anthropic', issuedYear: 2026 },
      { name: 'AI Fluency Framework & Foundations', issuer: 'Anthropic', issuedYear: 2026 },
    ],
  },
  projects: {
    source: 'linkedin_page',
    experiences: [
      { company: '', title: 'Savor', type: 'project', bullets: ['Menu OCR pipeline'] },
      { company: '', title: 'Portfolio', type: 'project', bullets: ['Minimalist site'] },
    ],
  },
  volunteering: {
    source: 'linkedin_page',
    experiences: [{ company: 'Austin Korean Presbyterian Church', title: 'Care Team Leader', type: 'volunteer', bullets: [] }],
  },
  skills: {
    source: 'linkedin_page',
    // "go" duplicates "Go" case-insensitively → 4 unique skills.
    skills: [{ name: 'Go' }, { name: 'Kubernetes' }, { name: 'React' }, { name: 'TypeScript' }, { name: 'go' }],
  },
};

function ok(page: PageKind, profile: ProfileImport = PAGES[page]) {
  return { success: true, page, rendered: [page], profile };
}

function pageOf(url: string): PageKind {
  if (/\/details\/experience\//.test(url)) return 'experience';
  if (/\/details\/education\//.test(url)) return 'education';
  if (/\/details\/certifications\//.test(url)) return 'certifications';
  if (/\/details\/projects\//.test(url)) return 'projects';
  if (/\/details\/volunteering-experiences\//.test(url)) return 'volunteering';
  if (/\/details\/skills\//.test(url)) return 'skills';
  return 'profile';
}

// ---------------------------------------------------------------------------
// Harness helpers
// ---------------------------------------------------------------------------

/** Boots a fresh background worker against a fresh chrome mock. */
async function bootBackground(): Promise<SetupMockChromeResult> {
  vi.resetModules();
  const harness = setupMockChrome();
  await import('../src/background/index');
  return harness;
}

/** Delivers a side-panel message to the background router and resolves with its response. */
function dispatch(harness: SetupMockChromeResult, message: any): Promise<any> {
  return new Promise((resolve) => {
    for (const listener of [...harness.messageListeners]) {
      listener(message, { id: 'rezbuilder-sidepanel' }, resolve);
    }
  });
}

/** Lets awaited promises inside the background settle without advancing timers. */
async function flushMicrotasks(rounds = 25): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/** Advances fake time in small steps until `pending` settles (or ~4 simulated minutes pass). */
async function settle<T>(pending: Promise<T>, maxMs = 240_000): Promise<T> {
  let done = false;
  pending.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    }
  );
  await flushMicrotasks();
  for (let elapsed = 0; !done && elapsed < maxMs; elapsed += 250) {
    await vi.advanceTimersByTimeAsync(250);
    await flushMicrotasks();
  }
  return pending;
}

type Responder = any[] | ((call: number, message: any) => any);

interface ScrapeCall {
  page: PageKind;
  url: string;
  message: any;
}

/**
 * Simulates the LinkedIn tab's content script: the answer depends on the
 * tab's current URL. `responders[page]` is either a list (last one repeats)
 * or a function of the per-page call number; pages without a responder answer
 * with their fixture. A responder that returns an Error throws it (no content
 * script on that page).
 */
function installFakeContentScript(
  harness: SetupMockChromeResult,
  responders: Partial<Record<PageKind, Responder>> = {}
): ScrapeCall[] {
  const calls: ScrapeCall[] = [];
  const perPage: Partial<Record<PageKind, number>> = {};
  harness.messageListeners.push((message, sender, sendResponse) => {
    if (message?.type !== 'SCRAPE_LINKEDIN_PROFILE') return;
    const tab = harness.createdTabs.find((t) => t.id === sender?.tab?.id);
    const url = tab?.url || sender?.tab?.url || '';
    const page = pageOf(url);
    const call = (perPage[page] = (perPage[page] || 0) + 1);
    calls.push({ page, url, message });

    const responder = responders[page];
    let response: any;
    if (typeof responder === 'function') response = responder(call, message);
    else if (Array.isArray(responder)) response = responder[Math.min(call - 1, responder.length - 1)];
    else response = ok(page);

    if (response instanceof Error) throw response;
    sendResponse(response);
    return true;
  });
  return calls;
}

/**
 * Makes created/navigated tabs finish loading `delayMs` after `tabs.create`
 * or `tabs.update`. `resolveUrl` maps the requested URL to the one LinkedIn
 * lands on (`/in/me/` → the slug); returning null means the page never loads.
 */
function installAutoLoader(
  harness: SetupMockChromeResult,
  resolveUrl: (url: string) => string | null = (url) => (url === ME_URL ? SELF_PROFILE_URL : url),
  delayMs = 50
) {
  const fire = (tabId: number, url?: string) => {
    if (!url) return;
    const finalUrl = resolveUrl(url);
    if (finalUrl === null) return;
    setTimeout(() => {
      void harness.updateTab(tabId, { status: 'complete', url: finalUrl });
    }, delayMs);
  };
  const originalCreate = harness.mockChrome.tabs.create.getMockImplementation();
  harness.mockChrome.tabs.create.mockImplementation(async (props: any) => {
    const tab = await originalCreate(props);
    fire(tab.id, props?.url);
    return tab;
  });
  const originalUpdate = harness.mockChrome.tabs.update.getMockImplementation();
  harness.mockChrome.tabs.update.mockImplementation(async (tabId: number, props: any) => {
    const tab = await originalUpdate(tabId, props);
    fire(tabId, props?.url);
    return tab;
  });
}

function scrapeCallsOn(calls: ScrapeCall[], page: PageKind): ScrapeCall[] {
  return calls.filter((c) => c.page === page);
}

function navigatedUrls(harness: SetupMockChromeResult): string[] {
  return harness.updatedTabs.map((u) => u.url!).filter(Boolean);
}

function pageStatus(response: any, kind: PageKind) {
  return response.pages.find((p: any) => p.kind === kind);
}

// ---------------------------------------------------------------------------

describe('LinkedIn profile import (background, multi-page)', () => {
  let harness: SetupMockChromeResult;

  beforeEach(async () => {
    vi.useFakeTimers();
    harness = await bootBackground();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens /in/me/, visits the six detail pages in order with the resolved slug, and merges every page', async () => {
    installAutoLoader(harness);
    const calls = installFakeContentScript(harness);

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(harness.mockChrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(harness.mockChrome.tabs.create).toHaveBeenCalledWith({ url: ME_URL, active: true });
    const tab = harness.createdTabs[0];
    expect(response.tabId).toBe(tab.id);

    // Six section navigations, then back to the profile.
    expect(navigatedUrls(harness)).toEqual([...EXPECTED_VISIT_ORDER, PROFILE_URL]);
    expect(harness.updatedTabs.every((u) => u.tabId === tab.id)).toBe(true);

    expect(response.success).toBe(true);
    expect(response.cancelled).toBeUndefined();
    expect(response.pages).toEqual([
      { kind: 'profile', status: 'ok', count: 3 },
      { kind: 'experience', status: 'ok', count: 3 },
      { kind: 'education', status: 'ok', count: 1 },
      { kind: 'certifications', status: 'ok', count: 2 },
      { kind: 'projects', status: 'ok', count: 2 },
      { kind: 'volunteering', status: 'ok', count: 1 },
      { kind: 'skills', status: 'ok', count: 5 },
    ]);

    const profile: ProfileImport = response.profile;
    expect(profile.source).toBe('linkedin_page');
    expect(profile.contact).toEqual(TOP_CARD.contact);
    expect(profile.experiences).toHaveLength(3 + 2 + 1);
    expect(profile.experiences!.map((x) => x.title)).toEqual([
      'Software Engineer Intern',
      'Student Intern',
      'NASA HAS Scholar',
      'Savor',
      'Portfolio',
      'Care Team Leader',
    ]);
    expect(profile.education).toHaveLength(1);
    expect(profile.certifications).toHaveLength(2);
    expect(profile.skills!.map((s) => s.name)).toEqual(['Go', 'Kubernetes', 'React', 'TypeScript']);
    expect(profile.warnings).toBeUndefined();

    // One scrape per page in the happy path, and each section was reached on its own URL.
    expect(calls.map((c) => c.page)).toEqual(['profile', 'experience', 'education', 'certifications', 'projects', 'volunteering', 'skills']);
    expect(scrapeCallsOn(calls, 'skills')[0].url).toBe(SECTION_URLS.skills);

    // The tab stays open so the user can see what was read.
    expect(harness.mockChrome.tabs.remove).toBeUndefined();
  });

  it('reports the profile page as ok from the top card alone', async () => {
    installAutoLoader(harness);
    installFakeContentScript(harness, {
      profile: [ok('profile', { source: 'linkedin_page', contact: { name: 'Jane Doe' } })],
    });

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(pageStatus(response, 'profile')).toEqual({ kind: 'profile', status: 'ok', count: 1 });
    expect(response.success).toBe(true);
    expect(response.profile.contact).toEqual({ name: 'Jane Doe' });
  });

  it('retries the profile page while it renders and moves on once the top card appears', async () => {
    installAutoLoader(harness);
    const calls = installFakeContentScript(harness, { profile: [RENDERING, RENDERING, ok('profile')] });

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(scrapeCallsOn(calls, 'profile')).toHaveLength(3);
    expect(response.success).toBe(true);
    expect(pageStatus(response, 'profile').status).toBe('ok');
  });

  it('marks skills as empty with a retry hint when that page never renders, and still succeeds', async () => {
    installAutoLoader(harness);
    const calls = installFakeContentScript(harness, { skills: [RENDERING] });

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(scrapeCallsOn(calls, 'skills')).toHaveLength(8);
    expect(pageStatus(response, 'skills')).toEqual({ kind: 'skills', status: 'empty', count: 0 });
    expect(response.success).toBe(true);
    expect(response.profile.skills).toBeUndefined();
    expect(response.profile.experiences).toHaveLength(6);
    expect(response.profile.warnings).toEqual([
      'Skills did not load — LinkedIn sometimes throttles this page. Scroll the LinkedIn tab, then use "Retry skills".',
    ]);
    // Other pages still got their five-attempt budget only when needed: one call each here.
    expect(scrapeCallsOn(calls, 'experience')).toHaveLength(1);
  });

  it('treats a section the content script confirms rendered but empty as ok with count 0', async () => {
    installAutoLoader(harness);
    installFakeContentScript(harness, {
      volunteering: [{ success: true, page: 'volunteering', rendered: ['volunteering'], profile: { source: 'linkedin_page', experiences: [] } }],
    });

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(pageStatus(response, 'volunteering')).toEqual({ kind: 'volunteering', status: 'ok', count: 0 });
    expect(response.profile.warnings).toBeUndefined();
  });

  it.each([
    ['auth wall', LINKEDIN_AUTHWALL_URL],
    ['login page', LINKEDIN_LOGIN_URL],
  ])('asks the user to sign in when LinkedIn redirects to the %s', async (_label, wallUrl) => {
    installAutoLoader(harness, () => wallUrl);
    const calls = installFakeContentScript(harness);

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(response.success).toBe(false);
    expect(response.error).toBe('Please sign in to LinkedIn, then try again.');
    expect(response.tabId).toBe(harness.createdTabs[0].id);
    expect(response.pages).toEqual([{ kind: 'profile', status: 'error', count: 0 }]);
    expect(calls).toHaveLength(0);
    expect(navigatedUrls(harness)).toEqual([]);
  });

  it('marks only the page whose content script cannot be reached as error', async () => {
    installAutoLoader(harness);
    const calls = installFakeContentScript(harness, {
      education: () => new Error('Could not establish connection. Receiving end does not exist.'),
    });

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(response.success).toBe(true);
    expect(pageStatus(response, 'education')).toEqual({ kind: 'education', status: 'error', count: 0 });
    expect(response.pages.filter((p: any) => p.kind !== 'education').every((p: any) => p.status === 'ok')).toBe(true);
    expect(scrapeCallsOn(calls, 'education')).toHaveLength(5);
    expect(response.profile.education).toBeUndefined();
    expect(response.profile.experiences).toHaveLength(6);
    expect(response.profile.warnings).toHaveLength(1);
    expect(response.profile.warnings[0]).toMatch(/^Education could not be read/);
    expect(response.profile.warnings[0]).toContain('Retry education');
    // The remaining pages were still visited.
    expect(navigatedUrls(harness)).toEqual([...EXPECTED_VISIT_ORDER, PROFILE_URL]);
  });

  it('marks a section whose page never finishes loading as error and continues', async () => {
    installAutoLoader(harness, (url) => (url === ME_URL ? SELF_PROFILE_URL : url === SECTION_URLS.projects ? null : url));
    const calls = installFakeContentScript(harness);

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(pageStatus(response, 'projects')).toEqual({ kind: 'projects', status: 'error', count: 0 });
    expect(scrapeCallsOn(calls, 'projects')).toHaveLength(0);
    expect(pageStatus(response, 'volunteering').status).toBe('ok');
    expect(pageStatus(response, 'skills').status).toBe('ok');
    expect(response.profile.warnings[0]).toMatch(/^Projects could not be read \(the page took too long to load\)/);
  });

  it('fails when the profile tab never finishes loading', async () => {
    installAutoLoader(harness, () => null);
    const calls = installFakeContentScript(harness);

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/too long/i);
    expect(response.pages).toEqual([{ kind: 'profile', status: 'error', count: 0 }]);
    expect(calls).toHaveLength(0);
  });

  it('broadcasts LINKEDIN_IMPORT_PROGRESS before each of the seven steps', async () => {
    installAutoLoader(harness);
    installFakeContentScript(harness);
    const progress: any[] = [];
    harness.messageListeners.push((message) => {
      if (message?.type === 'LINKEDIN_IMPORT_PROGRESS') progress.push(message);
    });

    await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(progress).toEqual([
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 1, total: 7, label: 'Profile', kind: 'profile' },
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 2, total: 7, label: 'Experience', kind: 'experience' },
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 3, total: 7, label: 'Education', kind: 'education' },
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 4, total: 7, label: 'Certifications', kind: 'certifications' },
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 5, total: 7, label: 'Projects', kind: 'projects' },
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 6, total: 7, label: 'Volunteering', kind: 'volunteering' },
      { type: 'LINKEDIN_IMPORT_PROGRESS', step: 7, total: 7, label: 'Skills', kind: 'skills' },
    ]);
  });

  it('passes the names collected so far as knownContextNames to later pages', async () => {
    installAutoLoader(harness);
    const calls = installFakeContentScript(harness);

    await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(scrapeCallsOn(calls, 'profile')[0].message.options).toBeUndefined();
    expect(scrapeCallsOn(calls, 'experience')[0].message.options).toEqual({ knownContextNames: [] });
    const skillsOptions = scrapeCallsOn(calls, 'skills')[0].message.options;
    // Companies, then the school, certifications, project titles and the volunteering org — in page order.
    expect(skillsOptions.knownContextNames).toEqual([
      'Date Maroon',
      'SILVIA Health',
      'NASA',
      'Texas A&M University',
      'Introduction to Model Context Protocol',
      'AI Fluency Framework & Foundations',
      'Savor',
      'Portfolio',
      'Austin Korean Presbyterian Church',
    ]);
  });

  it('stops after the current page on CANCEL_LINKEDIN_IMPORT and returns what was gathered', async () => {
    installAutoLoader(harness);
    installFakeContentScript(harness);
    let cancelResponse: any;
    harness.messageListeners.push((message) => {
      if (message?.type === 'LINKEDIN_IMPORT_PROGRESS' && message.kind === 'education') {
        void dispatch(harness, { type: 'CANCEL_LINKEDIN_IMPORT' }).then((r) => {
          cancelResponse = r;
        });
      }
    });

    const response = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));

    expect(cancelResponse).toEqual({ success: true, cancelled: true });
    expect(response.cancelled).toBe(true);
    expect(response.success).toBe(true);
    expect(response.pages.map((p: any) => p.kind)).toEqual(['profile', 'experience', 'education']);
    expect(response.profile.experiences).toHaveLength(3);
    expect(response.profile.education).toHaveLength(1);
    expect(response.profile.warnings).toEqual(['Import cancelled; the pages read so far were kept.']);
    // Certifications and later were never visited; the tab was still sent back to the profile.
    expect(navigatedUrls(harness)).toEqual([SECTION_URLS.experience, SECTION_URLS.education, PROFILE_URL]);
  });

  it('re-reads one section in the existing tab via IMPORT_LINKEDIN_SECTION', async () => {
    installAutoLoader(harness);
    const calls = installFakeContentScript(harness, { skills: (call) => (call <= 8 ? RENDERING : ok('skills')) });

    const first = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' }));
    expect(pageStatus(first, 'skills').status).toBe('empty');
    const tabId = first.tabId;
    harness.updatedTabs.length = 0;

    const retry = await settle(
      dispatch(harness, { type: 'IMPORT_LINKEDIN_SECTION', kind: 'skills', tabId, knownContextNames: ['Date Maroon'] })
    );

    expect(harness.mockChrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(navigatedUrls(harness)).toEqual([SECTION_URLS.skills]);
    expect(harness.updatedTabs[0].tabId).toBe(tabId);
    expect(retry).toEqual({
      success: true,
      tabId,
      pages: [{ kind: 'skills', status: 'ok', count: 5 }],
      profile: { source: 'linkedin_page', skills: [{ name: 'Go' }, { name: 'Kubernetes' }, { name: 'React' }, { name: 'TypeScript' }] },
    });
    const retryCall = scrapeCallsOn(calls, 'skills')[8];
    expect(retryCall.message.options).toEqual({ knownContextNames: ['Date Maroon'] });
  });

  it('scrapes in place when the tab already shows the section page, so a user scroll is kept', async () => {
    installAutoLoader(harness);
    installFakeContentScript(harness);
    const tab = await harness.mockChrome.tabs.create({ url: SECTION_URLS.skills, active: true });
    await vi.advanceTimersByTimeAsync(100);
    expect(harness.createdTabs[0].status).toBe('complete');
    harness.updatedTabs.length = 0;

    const retry = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_SECTION', kind: 'skills', tabId: tab.id }));

    expect(navigatedUrls(harness)).toEqual([]);
    expect(retry.success).toBe(true);
    expect(retry.pages).toEqual([{ kind: 'skills', status: 'ok', count: 5 }]);
  });

  it('opens a new tab on the section page when no tab is given', async () => {
    installAutoLoader(harness, (url) => url.replace('/in/me/', `/in/${SLUG}/`));
    installFakeContentScript(harness);

    const retry = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_SECTION', kind: 'education' }));

    expect(harness.mockChrome.tabs.create).toHaveBeenCalledWith({ url: 'https://www.linkedin.com/in/me/details/education/', active: true });
    expect(navigatedUrls(harness)).toEqual([]);
    expect(retry.success).toBe(true);
    expect(retry.tabId).toBe(harness.createdTabs[0].id);
    expect(retry.profile.education).toHaveLength(1);
  });

  it('reports a failed section retry without data', async () => {
    installAutoLoader(harness);
    installFakeContentScript(harness, { skills: [RENDERING] });
    const tab = await harness.mockChrome.tabs.create({ url: PROFILE_URL, active: true });
    await vi.advanceTimersByTimeAsync(100);

    const retry = await settle(dispatch(harness, { type: 'IMPORT_LINKEDIN_SECTION', kind: 'skills', tabId: tab.id }));

    expect(retry.success).toBe(false);
    expect(retry.pages).toEqual([{ kind: 'skills', status: 'empty', count: 0 }]);
    expect(retry.error).toMatch(/^Skills did not load/);
    expect(retry.profile).toBeUndefined();
  });

  it('does not treat the profile page as a job posting', () => {
    const result = jobClassifier.classify(LINKEDIN_PROFILE_URL, createDomDocument(LINKEDIN_FULL_PROFILE_HTML));

    expect(result.isJobPage).toBe(false);
    expect(result.positiveSignals).not.toContain('SIG_KNOWN_ATS_URL');
  });

  it('leaves the existing per-tab job routing untouched', async () => {
    harness.setActiveTab(1);
    const response = await dispatch(harness, { type: 'GET_ACTIVE_TAB_JOB' });
    await flushMicrotasks();
    expect(response).toEqual({ job: null });
  });
});
