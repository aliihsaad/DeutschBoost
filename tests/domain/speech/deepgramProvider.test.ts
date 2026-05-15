import { describe, expect, it, vi } from 'vitest';
import { createDeepgramSpeechProvider } from '../../../src/domain/speech/deepgramProvider';

describe('createDeepgramSpeechProvider', () => {
  it('transcribes prerecorded audio and normalizes the learner transcript turn', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: 'request-123',
          metadata: {
            model_info: { name: 'nova-3' },
          },
          results: {
            channels: [
              {
                alternatives: [
                  {
                    transcript: '  Guten   Morgen, ich lerne Deutsch. ',
                    confidence: 0.97,
                  },
                ],
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const provider = createDeepgramSpeechProvider({
      apiKey: 'deepgram-key',
      model: 'nova-3',
      language: 'de',
      fetchFn,
      now: () => '2026-05-15T10:00:00.000Z',
    });

    const result = await provider.transcribe({
      feature: 'conversation-turn',
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/webm',
      options: {
        punctuation: true,
        diarize: true,
      },
    });

    expect(result.transcript).toEqual({
      speaker: 'learner',
      text: 'Guten Morgen, ich lerne Deutsch.',
      occurredAt: '2026-05-15T10:00:00.000Z',
      confidence: 0.97,
      provider: 'deepgram',
    });
    expect(result.rawText).toBe('  Guten   Morgen, ich lerne Deutsch. ');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.deepgram.com/v1/listen?model=nova-3&language=de&punctuate=true&diarize=true',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Token deepgram-key',
          'Content-Type': 'audio/webm',
        },
        body: new Uint8Array([1, 2, 3]),
      })
    );
  });

  it('throws a provider error when the API key is missing', async () => {
    const provider = createDeepgramSpeechProvider({
      apiKey: '',
      fetchFn: vi.fn(),
    });

    await expect(
      provider.transcribe({
        feature: 'conversation-turn',
        audio: new Uint8Array([1]),
        mimeType: 'audio/webm',
      })
    ).rejects.toMatchObject({
      provider: 'deepgram',
      feature: 'conversation-turn',
      retryable: false,
    });
  });

  it('marks server failures as retryable provider errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ err_msg: 'temporarily unavailable' }), { status: 503 })
    );
    const provider = createDeepgramSpeechProvider({
      apiKey: 'deepgram-key',
      fetchFn,
    });

    await expect(
      provider.transcribe({
        feature: 'conversation-turn',
        audio: new Uint8Array([1]),
        mimeType: 'audio/webm',
      })
    ).rejects.toMatchObject({
      provider: 'deepgram',
      feature: 'conversation-turn',
      retryable: true,
    });
  });
});
