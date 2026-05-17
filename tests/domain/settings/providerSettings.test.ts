import { describe, expect, it, vi } from 'vitest';
import {
  DEEPGRAM_LANGUAGE_OPTIONS,
  DEEPGRAM_MODEL_OPTIONS,
  DEEPGRAM_TTS_MODEL_OPTIONS,
  GEMINI_LIVE_MODEL_OPTIONS,
  GEMINI_LIVE_VOICE_OPTIONS,
  OPENROUTER_MODEL_OPTIONS,
  buildProviderSettingsSnapshots,
  createAiProviderFromSettings,
  createDefaultLocalProviderSettings,
  createLiveConversationProviderFromSettings,
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
      ttsModel: 'aura-2-viktoria-de',
      language: 'de',
    });
    expect(settings.live).toMatchObject({
      enabled: false,
      provider: 'gemini-live',
      model: 'gemini-3.1-flash-live-preview',
      voiceName: 'Kore',
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
    expect(snapshots.live).toMatchObject({
      kind: 'live',
      providerName: 'Gemini Live',
      enabled: false,
      configured: false,
      model: 'gemini-3.1-flash-live-preview',
    });
  });

  it('exposes fixed model choices for the settings UI', () => {
    expect(OPENROUTER_MODEL_OPTIONS.map(option => option.value)).toContain('openrouter/auto');
    expect(OPENROUTER_MODEL_OPTIONS.map(option => option.value)).toContain('openai/gpt-4o-mini');
    expect(DEEPGRAM_MODEL_OPTIONS.map(option => option.value)).toEqual(['nova-3', 'nova-2']);
    expect(DEEPGRAM_TTS_MODEL_OPTIONS.map(option => option.value)).toContain('aura-2-viktoria-de');
    expect(DEEPGRAM_TTS_MODEL_OPTIONS.map(option => option.value)).toContain('aura-2-julius-de');
    expect(DEEPGRAM_LANGUAGE_OPTIONS.map(option => option.value)).toContain('de');
    expect(GEMINI_LIVE_MODEL_OPTIONS.map(option => option.value)).toEqual([
      'gemini-3.1-flash-live-preview',
      'gemini-2.5-flash-live-preview',
    ]);
    expect(GEMINI_LIVE_VOICE_OPTIONS.map(option => option.value)).toContain('Kore');
    expect(GEMINI_LIVE_VOICE_OPTIONS.map(option => option.value)).toContain('Puck');
  });

  it('defaults Deepgram TTS to a German Aura voice', () => {
    const settings = createDefaultLocalProviderSettings();

    expect(settings.speech.ttsModel).toBe('aura-2-viktoria-de');
  });

  it('does not create cloud providers when settings are disabled or missing keys', () => {
    const settings = createDefaultLocalProviderSettings();

    expect(createAiProviderFromSettings(settings.ai)).toBeNull();
    expect(createSpeechProviderFromSettings(settings.speech)).toBeNull();
    expect(createLiveConversationProviderFromSettings(settings.live)).toBeNull();

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
    expect(
      createLiveConversationProviderFromSettings({
        ...settings.live,
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
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openrouter-key',
          'X-Title': 'DeutschBoost',
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
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
      '/api/deepgram/v1/listen?model=nova-3&language=de',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Token deepgram-key',
          'Content-Type': 'audio/webm',
        }),
      })
    );
  });

  it('passes Deepgram TTS model into the speech provider', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    );
    const provider = createSpeechProviderFromSettings(
      {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-julius-de',
        language: 'de',
      },
      { fetchFn }
    );

    await provider?.synthesize({
      feature: 'settings-test',
      text: 'Hallo.',
    });

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/deepgram/v1/speak?model=aura-2-julius-de',
      expect.any(Object)
    );
  });

  it('creates a Gemini Live provider from enabled live conversation settings', () => {
    const provider = createLiveConversationProviderFromSettings(
      {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-3.1-flash-live-preview',
        voiceName: 'Kore',
      },
      { WebSocketCtor: vi.fn() as never }
    );

    expect(provider?.id).toBe('gemini-live');
    expect(provider?.displayName).toBe('Gemini Live');
  });
});
