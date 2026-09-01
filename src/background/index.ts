// RezBuilder Background Service Worker (Manifest V3)

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
    const jobPayload = {
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

    await chrome.storage.local.set({ activeJob: jobPayload });

    // Open side panel
    if (tab.windowId && chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});

// Message router between Content Scripts and Side Panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'JOB_SCRAPED') {
    chrome.storage.local.set({ activeJob: message.payload }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL' && _sender.tab?.windowId) {
    if (chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: _sender.tab.windowId });
      sendResponse({ success: true });
    }
    return true;
  }
});
