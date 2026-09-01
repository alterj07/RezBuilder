import { AIProvider } from './types';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { UserSettings, DEFAULT_SETTINGS } from '../../types/settings';

const SETTINGS_KEY = 'rezbuilder_settings';

export async function getStoredSettings(): Promise<UserSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const result = await chrome.storage.local.get([SETTINGS_KEY]);
    return result[SETTINGS_KEY] ? { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] } : DEFAULT_SETTINGS;
  }
  return DEFAULT_SETTINGS;
}

export async function saveStoredSettings(settings: UserSettings): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }
}

export async function getActiveAIProvider(): Promise<AIProvider> {
  const settings = await getStoredSettings();

  switch (settings.aiProvider) {
    case 'openai':
      return new OpenAIProvider(settings.openaiApiKey || '', settings.openaiModel || 'gpt-4o');
    case 'gemini':
      return new GeminiProvider(settings.geminiApiKey || '', settings.geminiModel || 'gemini-1.5-pro');
    case 'anthropic':
    default:
      return new AnthropicProvider(settings.anthropicApiKey || '', settings.anthropicModel || 'claude-3-5-sonnet-20241022');
  }
}
