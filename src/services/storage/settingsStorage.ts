import { UserSettings, DEFAULT_SETTINGS } from '../../types/settings';

const SETTINGS_KEY = 'rezbuilder_settings';

export class SettingsStorageService {
  async getSettings(): Promise<UserSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get([SETTINGS_KEY]);
      return result[SETTINGS_KEY] ? { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] } : DEFAULT_SETTINGS;
    }
    return DEFAULT_SETTINGS;
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
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
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.clear();
      // Re-initialize default settings
      await this.saveSettings(DEFAULT_SETTINGS);
    }
  }
}

export const settingsStorage = new SettingsStorageService();
