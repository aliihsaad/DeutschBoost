import { describe, expect, it, vi } from 'vitest';
import { createGeminiAiProvider, type GeminiClientLike } from '../../../src/domain/ai/geminiProvider';

describe('createGeminiAiProvider', () => {
  it('wraps a Gemini-compatible client with the provider interface', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: '{"topic":"Wortstellung","questionCount":3}',
    });
    const client: GeminiClientLike = {
      models: {
        generateContent,
      },
    };
    const provider = createGeminiAiProvider({
      client,
      defaultJsonModel: 'gemini-2.5-flash',
      defaultTextModel: 'gemini-2.5-flash',
    });

    const result = await provider.generateJson<{ topic: string; questionCount: number }>({
      feature: 'activity-generation',
      messages: [
        { role: 'system', content: 'Create German practice.' },
        { role: 'user', content: 'Create word-order questions.' },
      ],
      options: {
        temperature: 0.3,
        maxTokens: 600,
      },
    });

    expect(result).toEqual({ topic: 'Wortstellung', questionCount: 3 });
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: 'SYSTEM:\nCreate German practice.\n\nUSER:\nCreate word-order questions.',
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 600,
      },
    });
  });

  it('returns text responses from a Gemini-compatible client', async () => {
    const client: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'Hallo! Wie geht es dir?',
        }),
      },
    };

    const provider = createGeminiAiProvider({ client });

    await expect(
      provider.generateText({
        feature: 'conversation-reply',
        messages: [{ role: 'user', content: 'Hallo' }],
      })
    ).resolves.toBe('Hallo! Wie geht es dir?');
  });
});
