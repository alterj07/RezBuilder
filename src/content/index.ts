import { jobClassifier } from './detection/jobClassifier';
import { scraperRegistry } from './scrapers/scraperRegistry';
import { FloatingButton } from './floatingButton';
import { formFiller } from './autofill/formFiller';
import { JobPosting } from '../types/job';

let floatingBtn: FloatingButton | null = null;
let lastUrl = typeof window !== 'undefined' ? window.location.href : '';
let evaluationTimeout: any = null;

// Identity of the last state reported to the background worker, used to avoid
// re-sending the same result on every DOM mutation.
let lastReportedKey: string | null = null;

function reportKey(url: string, job: JobPosting | null): string {
  return job ? `${url}::${job.title}::${job.company}` : `${url}::none`;
}

function sendToBackground(message: any): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  try {
    const maybePromise = chrome.runtime.sendMessage(message) as unknown as Promise<unknown> | undefined;
    // The service worker may be asleep or the context invalidated mid-navigation;
    // neither is actionable from the page.
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {});
    }
  } catch {
    // Extension context invalidated (e.g. reload) — nothing to do.
  }
}

/**
 * Classifies the current page and scrapes it when it is a job posting.
 * Pure read of the page; performs no storage writes or messaging.
 */
export function parseCurrentPage(): JobPosting | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const currentUrl = window.location.href;
  const classification = jobClassifier.classify(currentUrl, document);
  if (!classification.isJobPage) return null;

  return scraperRegistry.detectAndScrape(currentUrl, document, classification.schemaJobPosting);
}

/**
 * Parses the page and reports the outcome to the background worker so the side
 * panel reflects this tab — including reporting the absence of a job, which is
 * what empties the panel when the user lands on a non-job page.
 */
export function reportPageState(options: { force?: boolean } = {}): JobPosting | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const currentUrl = window.location.href;
  const job = parseCurrentPage();
  const key = reportKey(currentUrl, job);

  if (!options.force && key === lastReportedKey) return job;
  lastReportedKey = key;

  if (job) {
    sendToBackground({ type: 'JOB_DETECTED', payload: job });
  } else {
    sendToBackground({ type: 'NO_JOB_DETECTED', url: currentUrl });
  }

  return job;
}

/**
 * Executes full job scraping on demand (e.g. user clicked FAB) and opens the panel.
 */
export async function handleScrape(): Promise<JobPosting | null> {
  const job = reportPageState({ force: true });

  if (job) {
    sendToBackground({ type: 'OPEN_SIDE_PANEL' });
  }
  return job;
}

/**
 * Fast page evaluation: mounts or unmounts the floating button and reports the
 * current detection state to the background worker.
 */
export function evaluatePageForJob(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const currentUrl = window.location.href;
  const classification = jobClassifier.classify(currentUrl, document);
  const isJob =
    classification.isJobPage &&
    (classification.confidence === 'high' || classification.confidence === 'medium');

  if (isJob) {
    if (!floatingBtn) {
      floatingBtn = new FloatingButton(handleScrape);
    }
    floatingBtn.mount();
  } else if (floatingBtn) {
    floatingBtn.unmount();
  }

  reportPageState();
  return isJob;
}

/** Resets memoized reporting state. Exposed for tests. */
export function resetReportCache(): void {
  lastReportedKey = null;
}

// Initial evaluation
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => evaluatePageForJob());
  } else {
    evaluatePageForJob();
  }

  // Observe URL and DOM changes for SPAs (debounced). LinkedIn and Workday swap
  // postings without a full navigation, so the DOM is re-checked as well as the URL.
  if (typeof MutationObserver !== 'undefined' && (document.body || document.documentElement)) {
    const observer = new MutationObserver(() => {
      if (evaluationTimeout) clearTimeout(evaluationTimeout);
      const urlChanged = window.location.href !== lastUrl;
      if (urlChanged) {
        lastUrl = window.location.href;
        lastReportedKey = null;
      }
      evaluationTimeout = setTimeout(evaluatePageForJob, urlChanged ? 500 : 1200);
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Periodic fallback check for delayed AJAX rendering
  setInterval(() => {
    evaluatePageForJob();
  }, 5000);
}

// Message router for Sidepanel & Background requests
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Background asking this tab to re-report (tab activated, navigation complete).
    if (message.type === 'REEVALUATE_PAGE') {
      const job = reportPageState({ force: true });
      sendResponse({ isJobPage: !!job, job: job || undefined });
      return true;
    }

    // Contract 1: GET_JOB_DATA -> { isJobPage: boolean, job?: JobPosting }
    if (message.type === 'GET_JOB_DATA') {
      const job = reportPageState({ force: true });
      sendResponse({ isJobPage: !!job, job: job || undefined });
      return true;
    }

    // Contract 2: SCRAPE_CURRENT_PAGE -> { success: boolean, job?: JobPosting, error?: string }
    if (message.type === 'SCRAPE_CURRENT_PAGE') {
      const job = reportPageState({ force: true });
      if (job) {
        sendResponse({ success: true, job });
      } else {
        sendResponse({ success: false, error: 'No job posting detected on current page' });
      }
      return true;
    }

    // Contract 3: TRIGGER_AUTOFILL -> { success: boolean, filledCount: number, fieldsFilled: string[], platform: string, message?: string, error?: string }
    if (message.type === 'TRIGGER_AUTOFILL') {
      if (!message.resume) {
        sendResponse({ success: false, filledCount: 0, fieldsFilled: [], platform: 'generic', error: 'No resume provided for auto-fill' });
        return true;
      }

      const result = formFiller.fill(document, message.resume, message.options);
      const filledFieldNames = result.fields.filter((f) => f.status === 'filled').map((f) => f.name);

      if (floatingBtn && result.success) {
        floatingBtn.showStatus('success', `Auto-filled ${result.filledCount} fields!`);
      }

      sendResponse({
        success: result.success,
        filledCount: result.filledCount,
        fieldsFilled: filledFieldNames,
        platform: result.platform,
        fields: result.fields,
        message: result.message,
        error: result.error,
      });
      return true;
    }
  });
}
