import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterProvider } from '../../../src/domain/ai/openRouterProvider';

describe('createOpenRouterProvider', () => {
  it('sends chat completion requests with JSON mode for JSON generation', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"topic":"Artikel","questionCount":5}',
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const provider = createOpenRouterProvider({
      apiKey: 'openrouter-key',
      model: 'openai/gpt-4o-mini',
      appTitle: 'DeutschBoost',
      siteUrl: 'https://deutschboost.local',
      fetchFn,
    });

    const result = await provider.generateJson<{ topic: string; questionCount: number }>({
      feature: 'activity-generation',
      schemaName: 'GrammarActivity',
      messages: [
        { role: 'system', content: 'Create German practice.' },
        { role: 'user', content: 'Create one grammar activity.' },
      ],
      options: {
        temperature: 0.2,
        maxTokens: 500,
      },
    });

    expect(result).toEqual({ topic: 'Artikel', questionCount: 5 });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openrouter-key',
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://deutschboost.local',
          'X-Title': 'DeutschBoost',
        }),
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Create German practice.' },
            { role: 'user', content: 'Create one grammar activity.' },
          ],
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      })
    );
  });

  it('throws a provider error when the API key is missing', async () => {
    const provider = createOpenRouterProvider({
      apiKey: '',
      model: 'openai/gpt-4o-mini',
      fetchFn: vi.fn(),
    });

    await expect(
      provider.generateText({
        feature: 'conversation-reply',
        messages: [{ role: 'user', content: 'Hallo' }],
      })
    ).rejects.toMatchObject({
      provider: 'openrouter',
      feature: 'conversation-reply',
      retryable: false,
    });
  });

  it('marks rate limits and server failures as retryable provider errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 })
    );
    const provider = createOpenRouterProvider({
      apiKey: 'openrouter-key',
      model: 'openai/gpt-4o-mini',
      fetchFn,
    });

    await expect(
      provider.generateText({
        feature: 'conversation-reply',
        messages: [{ role: 'user', content: 'Hallo' }],
      })
    ).rejects.toMatchObject({
      provider: 'openrouter',
      feature: 'conversation-reply',
      retryable: true,
    });
  });
});
