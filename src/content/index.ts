import { jobClassifier } from './detection/jobClassifier';
import { scraperRegistry } from './scrapers/scraperRegistry';
import { FloatingButton } from './floatingButton';
import { formFiller } from './autofill/formFiller';
import { JobPosting } from '../types/job';

let floatingBtn: FloatingButton | null = null;
let lastUrl = typeof window !== 'undefined' ? window.location.href : '';
let evaluationTimeout: any = null;

/**
 * Executes full job scraping on demand (e.g. user clicked FAB or sidepanel triggered).
 * Persists active job to chrome.storage.local and opens side panel.
 */
export async function handleScrape(): Promise<JobPosting | null> {
  const currentUrl = window.location.href;
  const classification = jobClassifier.classify(currentUrl, document);
  const job = scraperRegistry.detectAndScrape(currentUrl, document, classification.schemaJobPosting);

  if (job) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ activeJob: job });

      // Save to job history (up to 30 recent jobs)
      const stored = await chrome.storage.local.get(['jobHistory']);
      const history: JobPosting[] = stored.jobHistory || [];
      const exists = history.some((j) => j.url === job.url && j.title === job.title);
      if (!exists) {
        history.unshift(job);
        await chrome.storage.local.set({ jobHistory: history.slice(0, 30) });
      }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    }
    return job;
  }
  return null;
}

/**
 * Fast page evaluation to mount or unmount the floating button.
 * Uses lightweight JobClassifier without heavy skill extraction unless confirmed.
 */
export function evaluatePageForJob(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const currentUrl = window.location.href;
  const classification = jobClassifier.classify(currentUrl, document);

  if (classification.isJobPage && (classification.confidence === 'high' || classification.confidence === 'medium')) {
    if (!floatingBtn) {
      floatingBtn = new FloatingButton(handleScrape);
    }
    floatingBtn.mount();
    return true;
  } else {
    if (floatingBtn) {
      floatingBtn.unmount();
    }
    return false;
  }
}

// Initial evaluation
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => evaluatePageForJob());
  } else {
    evaluatePageForJob();
  }

  // Observe URL and DOM changes for SPAs (debounced)
  if (typeof MutationObserver !== 'undefined' && (document.body || document.documentElement)) {
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (evaluationTimeout) clearTimeout(evaluationTimeout);
        evaluationTimeout = setTimeout(evaluatePageForJob, 500);
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Periodic fallback check for delayed AJAX rendering
  setInterval(() => {
    if (!floatingBtn || !document.getElementById('rezbuilder-floating-root')) {
      evaluatePageForJob();
    }
  }, 5000);
}

// Message router for Sidepanel & Background requests
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Contract 1: GET_JOB_DATA -> { isJobPage: boolean, job?: JobPosting }
    if (message.type === 'GET_JOB_DATA') {
      const classification = jobClassifier.classify(window.location.href, document);
      if (classification.isJobPage) {
        const job = scraperRegistry.detectAndScrape(window.location.href, document, classification.schemaJobPosting);
        if (job && chrome.storage?.local) {
          chrome.storage.local.set({ activeJob: job });
        }
        sendResponse({ isJobPage: true, job: job || undefined });
      } else {
        sendResponse({ isJobPage: false });
      }
      return true;
    }

    // Contract 2: SCRAPE_CURRENT_PAGE -> { success: boolean, job?: JobPosting, error?: string }
    if (message.type === 'SCRAPE_CURRENT_PAGE') {
      const classification = jobClassifier.classify(window.location.href, document);
      const job = scraperRegistry.detectAndScrape(window.location.href, document, classification.schemaJobPosting);
      if (job) {
        if (chrome.storage?.local) {
          chrome.storage.local.set({ activeJob: job }).then(() => {
            sendResponse({ success: true, job });
          });
        } else {
          sendResponse({ success: true, job });
        }
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
