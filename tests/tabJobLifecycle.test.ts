import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockChrome, SetupMockChromeResult } from './helpers/mockChrome';
import { jobClassifier } from '../src/content/detection/jobClassifier';
import { createDomDocument } from './helpers/domUtils';
import { GREENHOUSE_DOM_FIXTURE, ALGOMASTER_NEGATIVE_DOM_FIXTURE } from './fixtures/domFixtures';
import { JobPosting } from '../src/types/job';

function makeJob(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job_' + (overrides.title || 'default'),
    title: 'Senior Backend Engineer',
    company: 'Stripe',
    location: 'Remote',
    description: 'Build payment infrastructure at scale.',
    requiredSkills: ['Go', 'Kubernetes'],
    url: 'https://boards.greenhouse.io/stripe/jobs/1',
    source: 'greenhouse',
    scrapedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Boots a fresh background service worker against a fresh mock chrome. */
async function bootBackground(): Promise<SetupMockChromeResult> {
  vi.resetModules();
  const harness = setupMockChrome();
  await import('../src/background/index');
  return harness;
}

describe('Per-Tab Job Lifecycle', () => {
  describe('1. tabJobStore registry', () => {
    let harness: SetupMockChromeResult;

    beforeEach(async () => {
      vi.resetModules();
      harness = setupMockChrome();
    });

    it('stores jobs per tab id without collision', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      await store.setTabJob(1, makeJob({ title: 'Backend Engineer' }));
      await store.setTabJob(2, makeJob({ title: 'Frontend Engineer' }));

      expect((await store.getTabJob(1))?.title).toBe('Backend Engineer');
      expect((await store.getTabJob(2))?.title).toBe('Frontend Engineer');
    });

    it('clears only the targeted tab entry', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      await store.setTabJob(1, makeJob({ title: 'Backend Engineer' }));
      await store.setTabJob(2, makeJob({ title: 'Frontend Engineer' }));

      await store.clearTabJob(1);

      expect(await store.getTabJob(1)).toBeNull();
      expect((await store.getTabJob(2))?.title).toBe('Frontend Engineer');
    });

    it('removes activeJob from storage when publishing null', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      await store.publishActiveJob(makeJob());
      expect(harness.store.local.activeJob).toBeDefined();

      await store.publishActiveJob(null);
      expect(harness.store.local.activeJob).toBeUndefined();
    });

    it('notifies storage listeners when the active job is cleared', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      await store.publishActiveJob(makeJob());

      const seen: any[] = [];
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.activeJob) seen.push(changes.activeJob);
      });

      await store.publishActiveJob(null);

      expect(seen.length).toBe(1);
      expect(seen[0].newValue).toBeUndefined();
    });

    it('de-duplicates job history by url and title', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      const job = makeJob();
      await store.appendJobHistory(job);
      await store.appendJobHistory(job);
      await store.appendJobHistory(makeJob({ title: 'Other Role' }));

      expect(harness.store.local.jobHistory).toHaveLength(2);
    });

    it('caps job history at the configured limit', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      for (let i = 0; i < 40; i++) {
        await store.appendJobHistory(makeJob({ title: `Role ${i}`, url: `https://x.co/${i}` }));
      }
      expect(harness.store.local.jobHistory).toHaveLength(30);
    });

    it('survives a corrupted registry value', async () => {
      const store = await import('../src/services/storage/tabJobStore');
      harness.store.session.tabJobs = 'not-an-object';
      expect(await store.getTabJobs()).toEqual({});
    });
  });

  describe('2. Automatic parsing via content-script reports', () => {
    it('publishes a job reported by the active tab', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);

      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Staff SRE' }) });

      expect(harness.store.local.activeJob?.title).toBe('Staff SRE');
    });

    it('records a background tab job without disturbing the visible panel', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Visible Role' }) });

      // Tab 2 is not in view; its detection must not overwrite the panel.
      await harness.sendFromTab(2, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Hidden Role' }) });

      expect(harness.store.local.activeJob?.title).toBe('Visible Role');
      expect(harness.store.session.tabJobs['2'].title).toBe('Hidden Role');
    });

    it('appends automatically parsed jobs to history', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Tracked Role' }) });

      expect(harness.store.local.jobHistory[0].title).toBe('Tracked Role');
    });

    it('ignores reports that did not originate from a tab', async () => {
      const harness = await bootBackground();
      const response = await harness.sendFromTab(undefined as any, {
        type: 'JOB_DETECTED',
        payload: makeJob(),
      });
      expect(response?.success).toBe(false);
    });
  });

  describe('3. Emptying the panel on non-job tabs', () => {
    it('clears the active job when the tab reports no posting', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob() });
      expect(harness.store.local.activeJob).toBeDefined();

      await harness.sendFromTab(1, { type: 'NO_JOB_DETECTED', url: 'https://algomaster.io/learn/x' });

      expect(harness.store.local.activeJob).toBeUndefined();
    });

    it('empties the panel when switching to a tab that has no job', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Job Tab Role' }) });

      // Tab 2 has never reported a posting.
      await harness.activateTab(2);

      expect(harness.store.local.activeJob).toBeUndefined();
    });

    it('restores the cached posting when switching back to a job tab', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Cached Role' }) });

      await harness.activateTab(2);
      expect(harness.store.local.activeJob).toBeUndefined();

      await harness.activateTab(1);
      expect(harness.store.local.activeJob?.title).toBe('Cached Role');
    });

    it('keeps each tab isolated across repeated switching', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Role One' }) });
      harness.setActiveTab(2);
      await harness.sendFromTab(2, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Role Two' }) });

      await harness.activateTab(1);
      expect(harness.store.local.activeJob?.title).toBe('Role One');

      await harness.activateTab(2);
      expect(harness.store.local.activeJob?.title).toBe('Role Two');
    });

    it('clears the panel when the active tab has no content script', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob() });

      // A chrome:// page or a tab loaded before the extension.
      harness.setTabScriptable(3, false);
      await harness.activateTab(3);

      expect(harness.store.local.activeJob).toBeUndefined();
    });
  });

  describe('4. Navigation invalidates stale postings', () => {
    it('clears the tab job when the tab navigates away', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob() });

      await harness.updateTab(1, { status: 'loading', url: 'https://news.ycombinator.com/' });

      expect(harness.store.local.activeJob).toBeUndefined();
      expect(harness.store.session.tabJobs['1']).toBeUndefined();
    });

    it('does not clear on a status change without a url change', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Kept Role' }) });

      await harness.updateTab(1, { status: 'loading' });

      expect(harness.store.local.activeJob?.title).toBe('Kept Role');
    });

    it('evicts a tab entry when the tab is closed', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob() });

      await harness.removeTab(1);

      expect(harness.store.session.tabJobs['1']).toBeUndefined();
    });
  });

  describe('5. Side panel query contract', () => {
    it('returns the active tab job for GET_ACTIVE_TAB_JOB', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob({ title: 'Queried Role' }) });

      const response = await harness.sendFromTab(1, { type: 'GET_ACTIVE_TAB_JOB' });

      expect(response.job?.title).toBe('Queried Role');
    });

    it('returns null and clears storage when the active tab has no job', async () => {
      const harness = await bootBackground();
      harness.setActiveTab(1);
      await harness.sendFromTab(1, { type: 'JOB_DETECTED', payload: makeJob() });
      harness.setActiveTab(9);

      const response = await harness.sendFromTab(9, { type: 'GET_ACTIVE_TAB_JOB' });

      expect(response.job).toBeNull();
      expect(harness.store.local.activeJob).toBeUndefined();
    });
  });

  describe('6. LinkedIn job surface recognition', () => {
    const linkedInJobUrls = [
      'https://www.linkedin.com/jobs/view/4123456789/',
      'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4123456789',
      'https://www.linkedin.com/jobs/search/?currentJobId=4123456789&keywords=engineer',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=4123456789',
    ];

    it.each(linkedInJobUrls)('classifies %s as a job page', (url) => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(true);
      expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
    });

    it('still ignores non-job LinkedIn surfaces', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = jobClassifier.classify('https://www.linkedin.com/feed/', doc);

      expect(result.positiveSignals).not.toContain('SIG_KNOWN_ATS_URL');
    });

    it('does not let the LinkedIn widening bypass negative vetoes', () => {
      const doc = createDomDocument(ALGOMASTER_NEGATIVE_DOM_FIXTURE);
      const result = jobClassifier.classify(
        'https://algomaster.io/learn/system-design/course-introduction',
        doc
      );

      expect(result.isJobPage).toBe(false);
    });
  });
});
