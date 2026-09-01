import { scraperRegistry } from './scrapers/scraperRegistry';
import { FloatingButton } from './floatingButton';
import { JobPosting } from '../types/job';

let floatingBtn: FloatingButton | null = null;
let lastUrl = window.location.href;

async function handleScrape(): Promise<JobPosting | null> {
  const job = scraperRegistry.detectAndScrape(window.location.href, document);
  if (job) {
    // 1. Store in chrome.storage.local
    await chrome.storage.local.set({ activeJob: job });

    // Also add to job history
    const stored = await chrome.storage.local.get(['jobHistory']);
    const history: JobPosting[] = stored.jobHistory || [];
    const exists = history.some((j) => j.url === job.url && j.title === job.title);
    if (!exists) {
      history.unshift(job);
      // Keep last 30 jobs
      await chrome.storage.local.set({ jobHistory: history.slice(0, 30) });
    }

    // 2. Open side panel
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    return job;
  }
  return null;
}

function evaluatePageForJob() {
  const currentUrl = window.location.href;
  const isJob = scraperRegistry.detectAndScrape(currentUrl, document);

  if (isJob) {
    if (!floatingBtn) {
      floatingBtn = new FloatingButton(handleScrape);
    }
    floatingBtn.mount();
  }
}

// Initial evaluation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', evaluatePageForJob);
} else {
  evaluatePageForJob();
}

// Observe URL and DOM changes for SPAs (LinkedIn, Indeed, Lever)
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(evaluatePageForJob, 1000);
  }
});
observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

// Periodic fallback check (e.g. after AJAX loads job pane)
setInterval(() => {
  evaluatePageForJob();
}, 3000);

// Message listener for manual trigger from side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_CURRENT_PAGE') {
    const job = scraperRegistry.detectAndScrape(window.location.href, document);
    if (job) {
      chrome.storage.local.set({ activeJob: job }).then(() => {
        sendResponse({ success: true, job });
      });
    } else {
      sendResponse({ success: false, error: 'No job posting detected on current page' });
    }
    return true;
  }
});
