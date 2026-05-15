import { describe, expect, it, vi } from 'vitest';
import {
  buildProviderSettingsSnapshots,
  createAiProviderFromSettings,
  createDefaultLocalProviderSettings,
  createSpeechProviderFromSettings,
} from '../../../src/domain/settings/providerSettings';

describe('providerSettings', () => {
  it('creates local-first defaults with cloud providers disabled', () => {
    const settings = createDefaultLocalProviderSettings();
    const snapshots = buildProviderSettingsSnapshots(settings);

    expect(settings.ai).toMatchObject({
      enabled: false,
      provider: 'openrouter',
      model: 'openrouter/auto',
    });
    expect(settings.speech).toMatchObject({
      enabled: false,
      provider: 'deepgram',
      model: 'nova-3',
      language: 'de',
    });
    expect(snapshots.ai).toMatchObject({
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: false,
      configured: false,
      model: 'openrouter/auto',
    });
    expect(snapshots.speech).toMatchObject({
      kind: 'speech',
      providerName: 'Deepgram',
      enabled: false,
      configured: false,
      model: 'nova-3',
      language: 'de',
    });
  });

  it('does not create cloud providers when settings are disabled or missing keys', () => {
    const settings = createDefaultLocalProviderSettings();

    expect(createAiProviderFromSettings(settings.ai)).toBeNull();
    expect(createSpeechProviderFromSettings(settings.speech)).toBeNull();

    expect(
      createAiProviderFromSettings({
        ...settings.ai,
        enabled: true,
        apiKey: '   ',
      })
    ).toBeNull();
    expect(
      createSpeechProviderFromSettings({
        ...settings.speech,
        enabled: true,
        apiKey: '',
      })
    ).toBeNull();
  });

  it('creates an OpenRouter provider from enabled local AI settings', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hallo!' } }],
        }),
        { status: 200 }
      )
    );
    const provider = createAiProviderFromSettings(
      {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'anthropic/claude-3.5-sonnet',
        baseUrl: 'https://openrouter.test/api/v1',
        appTitle: 'DeutschBoost Local',
        siteUrl: 'app://deutschboost',
      },
      { fetchFn }
    );

    expect(provider?.id).toBe('openrouter');

    const text = await provider?.generateText({
      feature: 'conversation-reply',
      messages: [{ role: 'user', content: 'Hallo' }],
    });

    expect(text).toBe('Hallo!');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.test/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openrouter-key',
          'X-Title': 'DeutschBoost Local',
          'HTTP-Referer': 'app://deutschboost',
        }),
        body: expect.stringContaining('anthropic/claude-3.5-sonnet'),
      })
    );
  });

  it('creates a Deepgram provider from enabled local speech settings', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            channels: [
              {
                alternatives: [{ transcript: 'Guten Morgen', confidence: 0.92 }],
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const provider = createSpeechProviderFromSettings(
      {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
        baseUrl: 'https://deepgram.test/v1/listen',
      },
      {
        fetchFn,
        now: () => '2026-05-15T12:00:00.000Z',
      }
    );

    expect(provider?.id).toBe('deepgram');

    const result = await provider?.transcribe({
      feature: 'voice-turn',
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/webm',
    });

    expect(result?.transcript).toMatchObject({
      speaker: 'learner',
      text: 'Guten Morgen',
      occurredAt: '2026-05-15T12:00:00.000Z',
      confidence: 0.92,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://deepgram.test/v1/listen?model=nova-3&language=de',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Token deepgram-key',
          'Content-Type': 'audio/webm',
        }),
      })
    );
  });
});
