import { vi } from 'vitest';

export interface MockChromeStore {
  local: Record<string, any>;
  sync: Record<string, any>;
  session: Record<string, any>;
}

export interface SetupMockChromeResult {
  mockChrome: any;
  store: MockChromeStore;
  messageListeners: ((message: any, sender: any, sendResponse: (response?: any) => void) => void | boolean)[];
  storageListeners: ((changes: Record<string, { oldValue?: any; newValue?: any }>, areaName: string) => void)[];
  resetStore: () => void;
  /** Sets which tab `chrome.tabs.query({active:true})` resolves to. */
  setActiveTab: (tabId: number | null, url?: string) => void;
  /** Registers a tab whose content script responds to background messages. */
  setTabScriptable: (tabId: number, scriptable: boolean) => void;
  /** Fires chrome.tabs.onActivated for the given tab. */
  activateTab: (tabId: number, url?: string) => Promise<void>;
  /** Fires chrome.tabs.onUpdated for the given tab. */
  updateTab: (tabId: number, changeInfo: any) => Promise<void>;
  /** Fires chrome.tabs.onRemoved for the given tab. */
  removeTab: (tabId: number) => Promise<void>;
  /** Delivers a message to background listeners as if sent from a tab. */
  sendFromTab: (tabId: number, message: any) => Promise<any>;
  /** Tabs opened through `chrome.tabs.create`, in creation order. */
  createdTabs: MockTab[];
  /** Every `chrome.tabs.update(tabId, { url })` call, in order. */
  updatedTabs: { tabId: number; url?: string; active?: boolean }[];
}

export interface MockTab {
  id: number;
  url?: string;
  pendingUrl?: string;
  windowId: number;
  active: boolean;
  status: 'loading' | 'complete';
}

/**
 * Creates and mounts a fully operational in-memory Chrome Extension API mock harness on globalThis.chrome.
 */
export function setupMockChrome(): SetupMockChromeResult {
  const store: MockChromeStore = {
    local: {},
    sync: {},
    session: {},
  };

  let activeTabId: number | null = 1;
  let activeTabUrl = 'https://boards.greenhouse.io/stripe/jobs/987654';
  const nonScriptableTabs = new Set<number>();
  // Tabs opened via chrome.tabs.create get ids well above the hand-picked ids tests use.
  const createdTabs: MockTab[] = [];
  const updatedTabs: { tabId: number; url?: string; active?: boolean }[] = [];
  let nextCreatedTabId = 1000;
  const findCreatedTab = (tabId: number) => createdTabs.find((t) => t.id === tabId);
  const tabActivatedListeners: ((info: { tabId: number; windowId: number }) => any)[] = [];
  const tabUpdatedListeners: ((tabId: number, changeInfo: any, tab: any) => any)[] = [];
  const tabRemovedListeners: ((tabId: number, info: any) => any)[] = [];
  const windowFocusListeners: ((windowId: number) => any)[] = [];
  const installedListeners: (() => void)[] = [];

  const messageListeners: ((
    message: any,
    sender: any,
    sendResponse: (response?: any) => void
  ) => void | boolean)[] = [];

  const storageListeners: ((
    changes: Record<string, { oldValue?: any; newValue?: any }>,
    areaName: string
  ) => void)[] = [];

  const createStorageArea = (areaName: 'local' | 'sync' | 'session') => {
    const areaStore = store[areaName];

    return {
      get: vi.fn(async (keys?: string | string[] | Record<string, any> | null) => {
        if (!keys) {
          return { ...areaStore };
        }
        if (typeof keys === 'string') {
          return { [keys]: areaStore[keys] };
        }
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach((k) => {
            if (areaStore[k] !== undefined) {
              result[k] = areaStore[k];
            }
          });
          return result;
        }
        if (typeof keys === 'object') {
          const result: Record<string, any> = { ...keys };
          Object.keys(keys).forEach((k) => {
            if (areaStore[k] !== undefined) {
              result[k] = areaStore[k];
            }
          });
          return result;
        }
        return { ...areaStore };
      }),

      set: vi.fn(async (items: Record<string, any>) => {
        const changes: Record<string, { oldValue?: any; newValue?: any }> = {};
        Object.entries(items).forEach(([key, val]) => {
          changes[key] = {
            oldValue: areaStore[key],
            newValue: val,
          };
          areaStore[key] = val;
        });

        // Trigger storage change listeners
        storageListeners.forEach((fn) => {
          try {
            fn(changes, areaName);
          } catch (err) {
            console.error('[MockChrome] Error in storage listener:', err);
          }
        });
      }),

      remove: vi.fn(async (keys: string | string[]) => {
        const keysArr = Array.isArray(keys) ? keys : [keys];
        const changes: Record<string, { oldValue?: any; newValue?: any }> = {};
        keysArr.forEach((k) => {
          if (areaStore[k] !== undefined) {
            changes[k] = { oldValue: areaStore[k], newValue: undefined };
            delete areaStore[k];
          }
        });
        storageListeners.forEach((fn) => {
          try {
            fn(changes, areaName);
          } catch (err) {
            console.error('[MockChrome] Error in storage listener:', err);
          }
        });
      }),

      clear: vi.fn(async () => {
        const changes: Record<string, { oldValue?: any; newValue?: any }> = {};
        Object.keys(areaStore).forEach((k) => {
          changes[k] = { oldValue: areaStore[k], newValue: undefined };
          delete areaStore[k];
        });
        storageListeners.forEach((fn) => {
          try {
            fn(changes, areaName);
          } catch (err) {
            console.error('[MockChrome] Error in storage listener:', err);
          }
        });
      }),
    };
  };

  const mockChrome = {
    storage: {
      local: createStorageArea('local'),
      sync: createStorageArea('sync'),
      session: createStorageArea('session'),
      onChanged: {
        addListener: vi.fn((fn) => {
          messageListeners;
          storageListeners.push(fn);
        }),
        removeListener: vi.fn((fn) => {
          const idx = storageListeners.indexOf(fn);
          if (idx !== -1) storageListeners.splice(idx, 1);
        }),
      },
    },

    runtime: {
      sendMessage: vi.fn(async (msg: any) => {
        let asyncResponseReceived: any = null;
        let responseSent = false;

        for (const listener of messageListeners) {
          const isAsync = listener(msg, { id: 'rezbuilder-tab' }, (response: any) => {
            asyncResponseReceived = response;
            responseSent = true;
          });
          if (!isAsync && responseSent) {
            return asyncResponseReceived;
          }
        }
        return asyncResponseReceived ?? { success: true };
      }),

      onInstalled: {
        addListener: vi.fn((fn: () => void) => {
          installedListeners.push(fn);
        }),
        removeListener: vi.fn(),
      },

      onMessage: {
        addListener: vi.fn((fn) => {
          messageListeners.push(fn);
        }),
        removeListener: vi.fn((fn) => {
          const idx = messageListeners.indexOf(fn);
          if (idx !== -1) messageListeners.splice(idx, 1);
        }),
      },
    },

    sidePanel: {
      open: vi.fn(async (_options?: { tabId?: number; windowId?: number }) => {}),
      setPanelBehavior: vi.fn(async (_options?: { openPanelOnActionClick?: boolean }) => {}),
    },

    tabs: {
      query: vi.fn(async (_queryInfo: any) =>
        activeTabId === null ? [] : [{ id: activeTabId, url: activeTabUrl, windowId: 100 }]
      ),
      create: vi.fn(async (createProperties: { url?: string; active?: boolean } = {}) => {
        const tab: MockTab = {
          id: nextCreatedTabId++,
          url: createProperties.url,
          pendingUrl: createProperties.url,
          windowId: 100,
          active: createProperties.active !== false,
          status: 'loading',
        };
        createdTabs.push(tab);
        if (tab.active) {
          activeTabId = tab.id;
          if (tab.url) activeTabUrl = tab.url;
        }
        return { ...tab };
      }),
      get: vi.fn(async (tabId: number) => {
        const created = findCreatedTab(tabId);
        if (created) return { ...created };
        if (tabId === activeTabId) return { id: activeTabId, url: activeTabUrl, windowId: 100, active: true, status: 'complete' };
        throw new Error(`No tab with id: ${tabId}.`);
      }),
      // Navigating a tab: created tabs go back to `loading` until a test fires
      // `updateTab(tabId, { status: 'complete' })`; the active hand-picked tab just changes url.
      update: vi.fn(async (tabId: number, updateProperties: { url?: string; active?: boolean } = {}) => {
        updatedTabs.push({ tabId, ...updateProperties });
        const created = findCreatedTab(tabId);
        if (created) {
          if (updateProperties.url) {
            created.url = updateProperties.url;
            created.pendingUrl = updateProperties.url;
            created.status = 'loading';
          }
          if (updateProperties.active !== undefined) created.active = updateProperties.active;
          if (created.active) {
            activeTabId = created.id;
            if (created.url) activeTabUrl = created.url;
          }
          return { ...created };
        }
        if (tabId === activeTabId) {
          if (updateProperties.url) activeTabUrl = updateProperties.url;
          return { id: activeTabId, url: activeTabUrl, windowId: 100, active: true, status: 'loading' };
        }
        throw new Error(`No tab with id: ${tabId}.`);
      }),
      sendMessage: vi.fn(async (tabId: number, msg: any) => {
        if (nonScriptableTabs.has(tabId)) {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        const created = findCreatedTab(tabId);
        const senderUrl = created?.url || activeTabUrl;
        let asyncResponseReceived: any = null;
        for (const listener of messageListeners) {
          listener(msg, { id: 'rezbuilder-sender', tab: { id: tabId, url: senderUrl } }, (response: any) => {
            asyncResponseReceived = response;
          });
        }
        return asyncResponseReceived ?? { success: true };
      }),
      onActivated: {
        addListener: vi.fn((fn) => {
          tabActivatedListeners.push(fn);
        }),
        removeListener: vi.fn(),
      },
      onUpdated: {
        addListener: vi.fn((fn) => {
          tabUpdatedListeners.push(fn);
        }),
        removeListener: vi.fn((fn) => {
          const idx = tabUpdatedListeners.indexOf(fn);
          if (idx !== -1) tabUpdatedListeners.splice(idx, 1);
        }),
      },
      onRemoved: {
        addListener: vi.fn((fn) => {
          tabRemovedListeners.push(fn);
        }),
        removeListener: vi.fn(),
      },
    },

    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: {
        addListener: vi.fn((fn) => {
          windowFocusListeners.push(fn);
        }),
        removeListener: vi.fn(),
      },
    },

    contextMenus: {
      create: vi.fn((_createProperties: any, _callback?: () => void) => {}),
      onClicked: {
        addListener: vi.fn((_fn) => {}),
      },
    },
  };

  (globalThis as any).chrome = mockChrome;

  const resetStore = () => {
    Object.keys(store.local).forEach((k) => delete store.local[k]);
    Object.keys(store.sync).forEach((k) => delete store.sync[k]);
    Object.keys(store.session).forEach((k) => delete store.session[k]);
    messageListeners.length = 0;
    storageListeners.length = 0;
    tabActivatedListeners.length = 0;
    tabUpdatedListeners.length = 0;
    tabRemovedListeners.length = 0;
    windowFocusListeners.length = 0;
    installedListeners.length = 0;
    nonScriptableTabs.clear();
    createdTabs.length = 0;
    updatedTabs.length = 0;
    nextCreatedTabId = 1000;
    activeTabId = 1;
  };

  const setActiveTab = (tabId: number | null, url?: string) => {
    activeTabId = tabId;
    if (url) activeTabUrl = url;
  };

  const setTabScriptable = (tabId: number, scriptable: boolean) => {
    if (scriptable) nonScriptableTabs.delete(tabId);
    else nonScriptableTabs.add(tabId);
  };

  // Each driver awaits the listeners it fires so tests observe settled state.
  const activateTab = async (tabId: number, url?: string) => {
    setActiveTab(tabId, url);
    await Promise.all(tabActivatedListeners.map((fn) => fn({ tabId, windowId: 100 })));
  };

  const updateTab = async (tabId: number, changeInfo: any) => {
    // Created tabs track their own url/status so chrome.tabs.get reflects navigation.
    const created = findCreatedTab(tabId);
    if (created) {
      if (changeInfo?.url) created.url = changeInfo.url;
      if (changeInfo?.status) created.status = changeInfo.status;
    }
    const tab = created ? { ...created } : { id: tabId, url: activeTabUrl };
    // Snapshot: a listener may remove itself while being notified.
    await Promise.all([...tabUpdatedListeners].map((fn) => fn(tabId, changeInfo, tab)));
  };

  const removeTab = async (tabId: number) => {
    await Promise.all(tabRemovedListeners.map((fn) => fn(tabId, { windowId: 100, isWindowClosing: false })));
  };

  const sendFromTab = async (tabId: number, message: any) => {
    let response: any = null;
    const pending: Promise<any>[] = [];
    for (const listener of messageListeners) {
      const result: any = listener(message, { id: 'rezbuilder', tab: { id: tabId, url: activeTabUrl } }, (r: any) => {
        response = r;
      });
      if (result && typeof result.then === 'function') pending.push(result);
    }
    await Promise.all(pending);
    // Background handlers respond from an async IIFE; yield until it settles.
    for (let i = 0; i < 20 && response === null; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return response;
  };

  return {
    mockChrome,
    store,
    messageListeners,
    storageListeners,
    resetStore,
    setActiveTab,
    setTabScriptable,
    activateTab,
    updateTab,
    removeTab,
    sendFromTab,
    createdTabs,
    updatedTabs,
  };
}
