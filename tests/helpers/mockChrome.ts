import { vi } from 'vitest';

export interface MockChromeStore {
  local: Record<string, any>;
  sync: Record<string, any>;
}

export interface SetupMockChromeResult {
  mockChrome: any;
  store: MockChromeStore;
  messageListeners: ((message: any, sender: any, sendResponse: (response?: any) => void) => void | boolean)[];
  storageListeners: ((changes: Record<string, { oldValue?: any; newValue?: any }>, areaName: string) => void)[];
  resetStore: () => void;
}

/**
 * Creates and mounts a fully operational in-memory Chrome Extension API mock harness on globalThis.chrome.
 */
export function setupMockChrome(): SetupMockChromeResult {
  const store: MockChromeStore = {
    local: {},
    sync: {},
  };

  const messageListeners: ((
    message: any,
    sender: any,
    sendResponse: (response?: any) => void
  ) => void | boolean)[] = [];

  const storageListeners: ((
    changes: Record<string, { oldValue?: any; newValue?: any }>,
    areaName: string
  ) => void)[] = [];

  const createStorageArea = (areaName: 'local' | 'sync') => {
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
      query: vi.fn(async (_queryInfo: any) => [{ id: 1, url: 'https://boards.greenhouse.io/stripe/jobs/987654' }]),
      sendMessage: vi.fn(async (_tabId: number, msg: any) => {
        let asyncResponseReceived: any = null;
        for (const listener of messageListeners) {
          listener(msg, { id: 'rezbuilder-sender' }, (response: any) => {
            asyncResponseReceived = response;
          });
        }
        return asyncResponseReceived ?? { success: true };
      }),
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
    messageListeners.length = 0;
    storageListeners.length = 0;
  };

  return {
    mockChrome,
    store,
    messageListeners,
    storageListeners,
    resetStore,
  };
}
