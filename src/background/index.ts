// RezBuilder Background Service Worker (Manifest V3)

import {
  recordDetection,
  syncActiveJobFromTab,
  clearTabJob,
  publishActiveJob,
  appendJobHistory,
} from '../services/storage/tabJobStore';
import { JobPosting } from '../types/job';

/** Resolves the tab the user is currently looking at, if any. */
async function getActiveTabId(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Asks a tab's content script to re-evaluate its page. Tabs loaded before the
 * extension (or restricted pages such as chrome://) have no content script, so
 * a failure here is expected and means "no job on this tab".
 */
async function requestReevaluation(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'REEVALUATE_PAGE' });
  } catch {
    await recordDetection(tabId, null, tabId === (await getActiveTabId()));
  }
}

// Setup side panel behavior
chrome.runtime.onInstalled.addListener(() => {
  // Allow opening side panel on extension icon click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.error('Failed to set panel behavior:', err);
    });
  }

  // Create context menu for text selection fallback
  chrome.contextMenus.create({
    id: 'rezbuilder-analyze-selection',
    title: 'Analyze with RezBuilder',
    contexts: ['selection'],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'rezbuilder-analyze-selection' && info.selectionText && tab?.id) {
    // Save selected text as a manual job posting
    const jobPayload: JobPosting = {
      id: 'manual_' + Date.now(),
      title: 'Highlighted Job Description',
      company: tab.title || 'Unknown Company',
      location: 'Unknown',
      description: info.selectionText,
      requiredSkills: [],
      url: tab.url || '',
      source: 'manual',
      scrapedAt: new Date().toISOString(),
    };

    await recordDetection(tab.id, jobPayload, true);

    // Open side panel
    if (tab.windowId && chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
        console.warn('Could not open side panel:', err);
      });
    }
  }
});

// --- Tab lifecycle: keep the panel showing the job for the tab in view ---

// Switching tabs republishes that tab's cached job, emptying the panel when the
// tab has none. A re-evaluation is also requested so tabs that were open before
// the extension loaded still get parsed.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await syncActiveJobFromTab(tabId);
  await requestReevaluation(tabId);
});

// A navigation invalidates whatever was parsed for that tab. Clear on commit so
// a stale posting never outlives the page it came from, then re-parse on load.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const activeTabId = await getActiveTabId();

  if (changeInfo.status === 'loading' && changeInfo.url) {
    await recordDetection(tabId, null, tabId === activeTabId);
    return;
  }

  if (changeInfo.status === 'complete' && tabId === activeTabId) {
    await requestReevaluation(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await clearTabJob(tabId);
});

// A window switch changes which tab is in view without firing onActivated.
if (chrome.windows?.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const tabId = await getActiveTabId();
    if (tabId !== null) await syncActiveJobFromTab(tabId);
  });
}

// Message router between Content Scripts and Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content script reporting what it found on its page (automatic parsing).
  if (message.type === 'JOB_DETECTED' || message.type === 'NO_JOB_DETECTED') {
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') {
      sendResponse({ success: false, error: 'Message did not originate from a tab' });
      return true;
    }

    const job: JobPosting | null = message.type === 'JOB_DETECTED' ? message.payload || null : null;

    (async () => {
      const activeTabId = await getActiveTabId();
      await recordDetection(tabId, job, tabId === activeTabId);
      if (job) await appendJobHistory(job);
      sendResponse({ success: true });
    })();
    return true;
  }

  // Side panel asking for the job belonging to the tab currently in view.
  if (message.type === 'GET_ACTIVE_TAB_JOB') {
    (async () => {
      const tabId = await getActiveTabId();
      if (tabId === null) {
        await publishActiveJob(null);
        sendResponse({ job: null });
        return;
      }
      const job = await syncActiveJobFromTab(tabId);
      sendResponse({ job });
    })();
    return true;
  }

  if (message.type === 'JOB_SCRAPED') {
    const tabId = sender.tab?.id;
    (async () => {
      if (typeof tabId === 'number') {
        const activeTabId = await getActiveTabId();
        await recordDetection(tabId, message.payload || null, tabId === activeTabId);
      } else {
        await publishActiveJob(message.payload || null);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL' && sender.tab?.windowId) {
    if (chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch((err) => {
        console.warn('Could not open side panel:', err);
      });
      sendResponse({ success: true });
    }
    return true;
  }
});
