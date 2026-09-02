import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockChrome, SetupMockChromeResult } from './helpers/mockChrome';

// A DOM that clears the 65-point classification threshold on positive signals
// alone (apply CTA + application form + description container), independent of URL.
const JOB_PAGE_DOM = `
  <main>
    <h1>Senior Platform Engineer</h1>
    <div class="job-description">
      We are hiring a platform engineer to own our Kubernetes estate, build
      internal developer tooling, and scale our observability stack across
      multiple production regions worldwide.
    </div>
    <h2>Responsibilities</h2>
    <form id="application_form" action="/apply">
      <input type="file" name="resume" />
      <input name="first_name" autocomplete="given-name" />
      <input name="last_name" autocomplete="family-name" />
      <button type="submit">Submit Application</button>
    </form>
    <a href="/apply-now">Apply Now</a>
  </main>
`;

const NON_JOB_PAGE_DOM = `
  <main>
    <h1>Understanding Consistent Hashing</h1>
    <div class="post-content">
      <p>Consistent hashing distributes keys across nodes with minimal remapping.</p>
    </div>
    <div class="comments-section"><p>Great write-up!</p></div>
  </main>
`;

function messagesOfType(harness: SetupMockChromeResult, type: string) {
  return (harness.mockChrome.runtime.sendMessage as any).mock.calls
    .map((c: any[]) => c[0])
    .filter((m: any) => m?.type === type);
}

describe('Content Script Automatic Parsing', () => {
  let harness: SetupMockChromeResult;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    harness = setupMockChrome();
    document.body.innerHTML = '';
  });

  it('reports a detected job to the background worker on load, with no user action', async () => {
    document.body.innerHTML = JOB_PAGE_DOM;

    await import('../src/content/index');

    const detected = messagesOfType(harness, 'JOB_DETECTED');
    expect(detected.length).toBeGreaterThan(0);
    expect(detected[0].payload).toBeTruthy();
    expect(detected[0].payload.title).toBeTruthy();
  });

  it('reports the absence of a job so the panel can empty itself', async () => {
    document.body.innerHTML = NON_JOB_PAGE_DOM;

    await import('../src/content/index');

    expect(messagesOfType(harness, 'NO_JOB_DETECTED').length).toBeGreaterThan(0);
    expect(messagesOfType(harness, 'JOB_DETECTED').length).toBe(0);
  });

  it('does not re-send an unchanged result on repeated evaluation', async () => {
    document.body.innerHTML = JOB_PAGE_DOM;
    const mod = await import('../src/content/index');

    const before = messagesOfType(harness, 'JOB_DETECTED').length;
    mod.reportPageState();
    mod.reportPageState();

    expect(messagesOfType(harness, 'JOB_DETECTED').length).toBe(before);
  });

  it('re-sends when the caller forces a refresh', async () => {
    document.body.innerHTML = JOB_PAGE_DOM;
    const mod = await import('../src/content/index');

    const before = messagesOfType(harness, 'JOB_DETECTED').length;
    mod.reportPageState({ force: true });

    expect(messagesOfType(harness, 'JOB_DETECTED').length).toBe(before + 1);
  });

  it('switches to a no-job report when the page content changes', async () => {
    document.body.innerHTML = JOB_PAGE_DOM;
    const mod = await import('../src/content/index');
    expect(messagesOfType(harness, 'JOB_DETECTED').length).toBeGreaterThan(0);

    document.body.innerHTML = NON_JOB_PAGE_DOM;
    mod.reportPageState();

    expect(messagesOfType(harness, 'NO_JOB_DETECTED').length).toBeGreaterThan(0);
  });

  it('answers REEVALUATE_PAGE with the current page state', async () => {
    document.body.innerHTML = JOB_PAGE_DOM;
    await import('../src/content/index');

    const response = await harness.sendFromTab(1, { type: 'REEVALUATE_PAGE' });

    expect(response.isJobPage).toBe(true);
    expect(response.job).toBeTruthy();
  });

  it('reports SCRAPE_CURRENT_PAGE failure on a non-job page', async () => {
    document.body.innerHTML = NON_JOB_PAGE_DOM;
    await import('../src/content/index');

    const response = await harness.sendFromTab(1, { type: 'SCRAPE_CURRENT_PAGE' });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/no job posting/i);
  });

  it('does not throw when the extension context is gone', async () => {
    document.body.innerHTML = JOB_PAGE_DOM;
    harness.mockChrome.runtime.sendMessage = vi.fn(() => {
      throw new Error('Extension context invalidated.');
    });

    await expect(import('../src/content/index')).resolves.toBeTruthy();
  });
});
