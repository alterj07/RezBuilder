import { UserSettings, DEFAULT_SETTINGS } from '../../types/settings';

const SETTINGS_KEY = 'rezbuilder_settings';

let memorySettings: UserSettings = { ...DEFAULT_SETTINGS };

export class SettingsStorageService {
  async getSettings(): Promise<UserSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get([SETTINGS_KEY]);
        return result[SETTINGS_KEY] ? { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] } : DEFAULT_SETTINGS;
      } catch (err) {
        console.warn('[RezBuilder] chrome.storage.local.get error, using memorySettings fallback:', err);
        return { ...memorySettings };
      }
    }
    return { ...memorySettings };
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    memorySettings = { ...settings };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
      } catch (err) {
        console.warn('[RezBuilder] chrome.storage.local.set error, saved in memorySettings fallback:', err);
      }
    }
  }

  async updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    await this.saveSettings(updated);
    return updated;
  }

  /**
   * Nuclear data wipe: removes all resumes, active jobs, history, tailored drafts, and cached prep guides
   */
  async clearAllRezBuilderData(): Promise<void> {
    memorySettings = { ...DEFAULT_SETTINGS };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.clear();
        // Re-initialize default settings
        await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
      } catch (err) {
        console.warn('[RezBuilder] chrome.storage.local.clear error, cleared memorySettings fallback:', err);
      }
    }
  }
}

export const settingsStorage = new SettingsStorageService();
