export type AIProviderType = 'anthropic' | 'openai' | 'gemini';

export interface UserSettings {
  aiProvider: AIProviderType;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  atsPreset: 'standard' | 'enterprise' | 'modern' | 'custom';
  customWeights?: {
    keywordMatch: number;
    placement: number;
    sectionCompleteness: number;
    parseSuccess: number;
    relevance: number;
  };
  enableFloatingButton: boolean;
  autoAnalyzeOnScrape: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  aiProvider: 'anthropic',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-pro',
  atsPreset: 'standard',
  customWeights: {
    keywordMatch: 45,
    placement: 15,
    sectionCompleteness: 15,
    parseSuccess: 15,
    relevance: 10,
  },
  enableFloatingButton: true,
  autoAnalyzeOnScrape: true,
};
