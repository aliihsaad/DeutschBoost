import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultLocalProviderSettings,
  type LocalProviderSettings,
} from '../../src/domain/settings/providerSettings';
import { createLocalProviderRuntime } from '../../src/application/providerRuntime';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;

  constructor(readonly url: string, readonly protocols?: string | string[]) {
    MockWebSocket.instances.push(this);
  }

  send() {}

  close() {}
}

describe('providerRuntime', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it('does not create runtime providers from disabled local settings', () => {
    const runtime = createLocalProviderRuntime(createDefaultLocalProviderSettings());

    expect(runtime.aiProvider).toBeNull();
    expect(runtime.speechProvider).toBeNull();
    expect(runtime.snapshots.ai.configured).toBe(false);
    expect(runtime.snapshots.speech.configured).toBe(false);
  });

  it('materializes OpenRouter and Deepgram providers from saved local settings', () => {
    const settings: LocalProviderSettings = {
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: false,
        provider: 'gemini-live',
        model: 'gemini-3.1-flash-live-preview',
        voiceName: 'Kore',
      },
    };

    const runtime = createLocalProviderRuntime(settings, {
      fetchFn: vi.fn(),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    expect(runtime.aiProvider?.id).toBe('openrouter');
    expect(runtime.speechProvider?.id).toBe('deepgram');
    expect(runtime.streamingAiProvider?.id).toBe('openrouter');
    expect(runtime.streamingSpeechProvider?.id).toBe('deepgram');
    expect(runtime.liveConversationProvider).toBeNull();
    expect(runtime.snapshots.ai.configured).toBe(true);
    expect(runtime.snapshots.speech.configured).toBe(true);
  });

  it('materializes Gemini Live as a separate realtime conversation provider', () => {
    const settings: LocalProviderSettings = {
      ai: {
        enabled: false,
        provider: 'openrouter',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: false,
        provider: 'deepgram',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    };

    const runtime = createLocalProviderRuntime(settings, {
      WebSocketCtor: MockWebSocket,
    });

    expect(runtime.liveConversationProvider?.id).toBe('gemini-live');
    expect(runtime.snapshots.live).toMatchObject({
      kind: 'live',
      providerName: 'Gemini Live',
      configured: true,
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    });
    expect(runtime.aiProvider).toBeNull();
    expect(runtime.speechProvider).toBeNull();
  });

  it('lets Deepgram streaming fall back to the saved key when auth grant is forbidden', async () => {
    const settings: LocalProviderSettings = {
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: false,
        provider: 'gemini-live',
        model: 'gemini-3.1-flash-live-preview',
        voiceName: 'Kore',
      },
    };
    const runtime = createLocalProviderRuntime(settings, {
      fetchFn: vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
      WebSocketCtor: MockWebSocket,
    });

    const sessionPromise = runtime.streamingSpeechProvider?.startTranscription({
      language: 'de',
      model: 'nova-3',
      endpointingMs: 450,
      interimResults: true,
      punctuate: true,
      smartFormat: true,
    });

    for (let attempt = 0; attempt < 5 && !MockWebSocket.instances[0]; attempt += 1) {
      await Promise.resolve();
    }
    expect(MockWebSocket.instances[0]?.protocols).toEqual(['token', 'deepgram-key']);
    MockWebSocket.instances[0]?.onopen?.();
    await expect(sessionPromise).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
  });
});
