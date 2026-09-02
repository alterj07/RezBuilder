import { AIProvider } from './types';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { AIProviderType, UserSettings, DEFAULT_SETTINGS } from '../../types/settings';

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

export class AIFactory {
  public static getProvider(
    provider: AIProviderType = 'anthropic',
    apiKey: string = '',
    model?: string
  ): AIProvider {
    switch (provider) {
      case 'openai':
        return new OpenAIProvider(apiKey, model || 'gpt-4o');
      case 'gemini':
        return new GeminiProvider(apiKey, model || 'gemini-1.5-pro');
      case 'anthropic':
      default:
        return new AnthropicProvider(apiKey, model || 'claude-3-5-sonnet-20241022');
    }
  }

  public static async getActiveProvider(): Promise<AIProvider> {
    return getActiveAIProvider();
  }
}

export async function getActiveAIProvider(): Promise<AIProvider> {
  const settings = await getStoredSettings();

  switch (settings.aiProvider) {
    case 'openai':
      return AIFactory.getProvider('openai', settings.openaiApiKey || '', settings.openaiModel);
    case 'gemini':
      return AIFactory.getProvider('gemini', settings.geminiApiKey || '', settings.geminiModel);
    case 'anthropic':
    default:
      return AIFactory.getProvider('anthropic', settings.anthropicApiKey || '', settings.anthropicModel);
  }
}
