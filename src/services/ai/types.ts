export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIProvider {
  name: string;
  generateText(prompt: string, options?: AICompletionOptions): Promise<string>;
  generateStructuredJson<T>(prompt: string, options?: AICompletionOptions): Promise<T>;
}
