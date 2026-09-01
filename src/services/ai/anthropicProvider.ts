import { AIProvider, AICompletionOptions } from './types';

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic Claude';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is not configured. Please add your key in the Settings tab.');
    }

    const model = options?.model || this.defaultModel;
    const system = options?.systemPrompt || 'You are an expert ATS resume analyst and career copilot.';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          system,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens || 4000,
          temperature: options?.temperature !== undefined ? options?.temperature : 0.2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API Error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const textBlock = data.content?.find((c: any) => c.type === 'text');
      return textBlock?.text || '';
    } catch (err: any) {
      console.error('[RezBuilder] Anthropic generation error:', err);
      throw new Error(err.message || 'Failed to call Anthropic API');
    }
  }

  async generateStructuredJson<T>(prompt: string, options?: AICompletionOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid, raw JSON. Do not include markdown code blocks (such as \`\`\`json) or any conversational text before or after the JSON payload.`;
    const text = await this.generateText(jsonPrompt, options);

    try {
      // Clean possible markdown code fences if model output them
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleaned) as T;
    } catch (err) {
      console.error('[RezBuilder] JSON parse error on response:', text);
      throw new Error('Failed to parse structured response from AI model. Please try again.');
    }
  }
}
