import { AIProvider, AICompletionOptions } from './types';

export class GeminiProvider implements AIProvider {
  name = 'Google Gemini';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gemini-1.5-pro') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured. Please add your key in the Settings tab.');
    }

    const model = options?.model || this.defaultModel;
    const system = options?.systemPrompt || 'You are an expert ATS resume analyst and career copilot.';

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: system }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: options?.temperature !== undefined ? options?.temperature : 0.2,
            maxOutputTokens: options?.maxTokens || 4000,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err: any) {
      console.error('[RezBuilder] Gemini generation error:', err);
      throw new Error(err.message || 'Failed to call Gemini API');
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
      throw new Error('Failed to parse structured JSON from Gemini response.');
    }
  }
}
