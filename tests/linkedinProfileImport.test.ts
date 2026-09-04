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

const SCRAPED_PROFILE: ProfileImport = {
  source: 'linkedin_page',
  contact: { name: 'Jane Doe', linkedinUrl: LINKEDIN_PROFILE_URL },
  skills: [{ name: 'Go' }, { name: 'Kubernetes' }],
  experiences: [{ company: 'Acme Corp', title: 'Senior Software Engineer', bullets: [] }],
};

const NAME_ONLY_PROFILE: ProfileImport = {
  source: 'linkedin_page',
  contact: { name: 'Jane Doe' },
};

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
    for (const listener of harness.messageListeners) {
      listener(message, { id: 'rezbuilder-sidepanel' }, resolve);
    }
  });
}

/** Lets awaited promises inside the background settle without advancing timers. */
async function flushMicrotasks(rounds = 25): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/**
 * Simulates a LinkedIn tab's content script: `responses` are returned in
 * order, and the last one repeats. Returns the call log.
 */
function installFakeContentScript(harness: SetupMockChromeResult, responses: any[]): any[] {
  const calls: any[] = [];
  harness.messageListeners.push((message, _sender, sendResponse) => {
    if (message?.type !== 'SCRAPE_LINKEDIN_PROFILE') return;
    calls.push(message);
    const index = Math.min(calls.length - 1, responses.length - 1);
    sendResponse(responses[index]);
    return true;
  });
  return calls;
}

/** Starts an import and lets the background reach the point of waiting for the tab to load. */
async function startImport(harness: SetupMockChromeResult) {
  const pending = dispatch(harness, { type: 'IMPORT_LINKEDIN_PROFILE' });
  await flushMicrotasks();
  const tab = harness.createdTabs[0];
  expect(tab).toBeTruthy();
  return { pending, tab };
}

describe('LinkedIn profile import (background)', () => {
  let harness: SetupMockChromeResult;

  beforeEach(async () => {
    vi.useFakeTimers();
    harness = await bootBackground();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the /in/me/ profile in a new active tab and returns the scraped profile', async () => {
    installFakeContentScript(harness, [{ success: true, profile: SCRAPED_PROFILE }]);

    const { pending, tab } = await startImport(harness);
    expect(harness.mockChrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://www.linkedin.com/in/me/',
      active: true,
    });

    await harness.updateTab(tab.id, { status: 'complete', url: LINKEDIN_PROFILE_URL });
    const response = await pending;

    expect(response).toEqual({ success: true, profile: SCRAPED_PROFILE, tabId: tab.id });
    // The tab stays open so the user can see what was read.
    expect(harness.mockChrome.tabs.remove).toBeUndefined();
  });

  it('asks the user to sign in when LinkedIn redirects to the auth wall', async () => {
    const calls = installFakeContentScript(harness, [{ success: true, profile: SCRAPED_PROFILE }]);

    const { pending, tab } = await startImport(harness);
    await harness.updateTab(tab.id, { status: 'complete', url: LINKEDIN_AUTHWALL_URL });
    const response = await pending;

    expect(response.success).toBe(false);
    expect(response.error).toBe('Please sign in to LinkedIn, then try again.');
    expect(response.tabId).toBe(tab.id);
    expect(calls).toHaveLength(0);
  });

  it('asks the user to sign in when LinkedIn redirects to the login page', async () => {
    installFakeContentScript(harness, [{ success: true, profile: SCRAPED_PROFILE }]);

    const { pending, tab } = await startImport(harness);
    await harness.updateTab(tab.id, { status: 'complete', url: LINKEDIN_LOGIN_URL });
    const response = await pending;

    expect(response).toMatchObject({ success: false, error: /sign in/i });
  });

  it('retries while the page renders lazily and succeeds once sections appear', async () => {
    const calls = installFakeContentScript(harness, [
      { success: false, error: 'LinkedIn profile has not finished rendering yet.' },
      { success: true, profile: NAME_ONLY_PROFILE },
      { success: true, profile: SCRAPED_PROFILE },
    ]);

    const { pending, tab } = await startImport(harness);
    await harness.updateTab(tab.id, { status: 'complete', url: LINKEDIN_PROFILE_URL });
    await vi.advanceTimersByTimeAsync(1500 * 2);
    const response = await pending;

    expect(response.success).toBe(true);
    expect(response.profile).toEqual(SCRAPED_PROFILE);
    expect(calls).toHaveLength(3);
  });

  it('gives up with an error after six attempts when the content script never answers', async () => {
    const { pending, tab } = await startImport(harness);
    harness.setTabScriptable(tab.id, false);

    await harness.updateTab(tab.id, { status: 'complete', url: LINKEDIN_PROFILE_URL });
    await vi.advanceTimersByTimeAsync(1500 * 6);
    const response = await pending;

    expect(response.success).toBe(false);
    expect(response.error).toBeTruthy();
    expect(response.tabId).toBe(tab.id);
    const scrapeCalls = (harness.mockChrome.tabs.sendMessage as any).mock.calls.filter(
      (c: any[]) => c[0] === tab.id && c[1]?.type === 'SCRAPE_LINKEDIN_PROFILE'
    );
    expect(scrapeCalls).toHaveLength(6);
  });

  it('returns the best partial profile when no section ever renders', async () => {
    installFakeContentScript(harness, [{ success: true, profile: NAME_ONLY_PROFILE }]);

    const { pending, tab } = await startImport(harness);
    await harness.updateTab(tab.id, { status: 'complete', url: LINKEDIN_PROFILE_URL });
    await vi.advanceTimersByTimeAsync(1500 * 6);
    const response = await pending;

    expect(response.success).toBe(true);
    expect(response.profile).toEqual(NAME_ONLY_PROFILE);
  });

  it('fails when the tab never finishes loading', async () => {
    installFakeContentScript(harness, [{ success: true, profile: SCRAPED_PROFILE }]);

    const { pending } = await startImport(harness);
    await vi.advanceTimersByTimeAsync(20_000);
    const response = await pending;

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/too long/i);
    expect(harness.mockChrome.tabs.sendMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'SCRAPE_LINKEDIN_PROFILE' })
    );
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
