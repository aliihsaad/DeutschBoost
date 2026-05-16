import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterStreamingProvider } from '../../../src/domain/ai/openRouterStreamingProvider';

describe('createOpenRouterStreamingProvider', () => {
  it('streams text deltas and ignores SSE comments', async () => {
    const body = [
      ': OPENROUTER PROCESSING',
      '',
      'data: {"choices":[{"delta":{"content":"Hallo"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"!"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    );
    const provider = createOpenRouterStreamingProvider({
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
      fetchFn,
    });
    const chunks: string[] = [];

    for await (const chunk of provider.streamText({
      feature: 'conversation-live-tutor',
      messages: [{ role: 'user', content: 'Sag hallo.' }],
      options: { maxTokens: 80, temperature: 0.4 },
    })) {
      chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['Hallo', '!']);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openrouter-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'Sag hallo.' }],
          temperature: 0.4,
          max_tokens: 80,
          stream: true,
        }),
      })
    );
  });

  it('includes OpenRouter app metadata headers when configured', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('data: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    );
    const provider = createOpenRouterStreamingProvider({
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
      appTitle: 'DeutschBoost',
      siteUrl: 'https://deutschboost.local',
      fetchFn,
    });

    for await (const _ of provider.streamText({
      feature: 'conversation-live-tutor',
      messages: [{ role: 'user', content: 'Hallo.' }],
    })) {
      // consume stream
    }

    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'HTTP-Referer': 'https://deutschboost.local',
          'X-Title': 'DeutschBoost',
        }),
      })
    );
  });

  it('throws a retryable error for rate limits', async () => {
    const provider = createOpenRouterStreamingProvider({
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
      fetchFn: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Rate limited' } }), { status: 429 })
      ),
    });

    await expect(
      collectText(provider.streamText({
        feature: 'conversation-live-tutor',
        messages: [{ role: 'user', content: 'Hallo' }],
      }))
    ).rejects.toMatchObject({
      provider: 'openrouter',
      feature: 'conversation-live-tutor',
      retryable: true,
    });
  });
});

async function collectText(stream: AsyncIterable<{ text: string }>): Promise<string> {
  let result = '';

  for await (const chunk of stream) {
    result += chunk.text;
  }

  return result;
}
