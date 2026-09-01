import { AIProvider, AICompletionOptions } from './types';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured. Please add your key in the Settings tab.');
    }

    const model = options?.model || this.defaultModel;
    const system = options?.systemPrompt || 'You are an expert ATS resume analyst and career copilot.';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          max_tokens: options?.maxTokens || 4000,
          temperature: options?.temperature !== undefined ? options?.temperature : 0.2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      console.error('[RezBuilder] OpenAI generation error:', err);
      throw new Error(err.message || 'Failed to call OpenAI API');
    }
  }

  async generateStructuredJson<T>(prompt: string, options?: AICompletionOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid, raw JSON. Do not include markdown code blocks or text before or after the JSON payload.`;
    const text = await this.generateText(jsonPrompt, options);

    try {
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleaned) as T;
    } catch (err) {
      console.error('[RezBuilder] JSON parse error on response:', text);
      throw new Error('Failed to parse structured JSON from OpenAI response.');
    }
  }
}
