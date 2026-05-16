import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeepgramStreamingSpeechProvider } from '../../../src/domain/speech/deepgramStreamingProvider';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  sent: unknown[] = [];

  constructor(readonly url: string, readonly protocols?: string | string[]) {
    MockWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

async function openCreatedSocket<T>(sessionPromise: Promise<T>): Promise<{ session: T; socket: MockWebSocket }> {
  for (let attempt = 0; attempt < 5 && !MockWebSocket.instances[0]; attempt += 1) {
    await Promise.resolve();
  }
  const socket = MockWebSocket.instances[0];
  expect(socket).toBeDefined();
  socket.onopen?.();
  return {
    socket,
    session: await sessionPromise,
  };
}

describe('createDeepgramStreamingSpeechProvider', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it('opens Deepgram listen with German endpointing and interim results', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });

    const { socket } = await openCreatedSocket(
      provider.startTranscription({
        language: 'de',
        model: 'nova-3',
        endpointingMs: 450,
        interimResults: true,
        punctuate: true,
        smartFormat: true,
      })
    );

    expect(socket.url).toContain('wss://api.deepgram.com/v1/listen?');
    expect(socket.url).toContain('model=nova-3');
    expect(socket.url).toContain('language=de');
    expect(socket.url).toContain('endpointing=450');
    expect(socket.url).toContain('interim_results=true');
    expect(socket.url).toContain('punctuate=true');
    expect(socket.url).toContain('smart_format=true');
    expect(socket.protocols).toEqual(['token', 'temporary-token']);
  });

  it('falls back to the saved local API key when Deepgram auth grant is forbidden', async () => {
    const forbidden = Object.assign(new Error('Deepgram temporary token request failed: HTTP 403'), {
      status: 403,
    });
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockRejectedValue(forbidden),
      apiKey: 'deepgram-local-key',
      shouldFallbackToApiKey: error => (error as { status?: number }).status === 403,
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });

    const { socket } = await openCreatedSocket(
      provider.startTranscription({
        language: 'de',
        model: 'nova-3',
        endpointingMs: 450,
        interimResults: true,
        punctuate: true,
        smartFormat: true,
      })
    );

    expect(socket.protocols).toEqual(['token', 'deepgram-local-key']);
  });

  it('buffers finalized pieces until speech_final creates one learner turn', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });
    const { session, socket } = await openCreatedSocket(
      provider.startTranscription({
        language: 'de',
        model: 'nova-3',
        endpointingMs: 450,
        interimResults: true,
        punctuate: true,
        smartFormat: true,
      })
    );
    const events: unknown[] = [];
    session.onEvent(event => events.push(event));

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'Results',
        is_final: true,
        speech_final: false,
        channel: { alternatives: [{ transcript: 'Ich mochte', confidence: 0.91 }] },
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: 'Results',
        is_final: true,
        speech_final: true,
        channel: { alternatives: [{ transcript: 'einen Kaffee.', confidence: 0.93 }] },
      }),
    });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'final',
        turn: expect.objectContaining({
          speaker: 'learner',
          text: 'Ich mochte einen Kaffee.',
          provider: 'deepgram',
        }),
      })
    );
  });

  it('emits interim transcript updates without final learner turns', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });
    const { session, socket } = await openCreatedSocket(
      provider.startTranscription({
        language: 'de',
        model: 'nova-3',
        endpointingMs: 450,
        interimResults: true,
        punctuate: true,
        smartFormat: true,
      })
    );
    const events: unknown[] = [];
    session.onEvent(event => events.push(event));

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'Results',
        is_final: false,
        speech_final: false,
        channel: { alternatives: [{ transcript: 'Ich gehe', confidence: 0.82 }] },
      }),
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: 'interim',
        piece: expect.objectContaining({
          text: 'Ich gehe',
          isFinal: false,
          speechFinal: false,
        }),
      }),
    ]);
  });

  it('does not send audio chunks after a transcription socket has closed', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });
    const { session, socket } = await openCreatedSocket(
      provider.startTranscription({
        language: 'de',
        model: 'nova-3',
        endpointingMs: 450,
        interimResults: true,
        punctuate: true,
        smartFormat: true,
      })
    );

    socket.close();
    session.sendAudio(new Uint8Array([1, 2, 3]));

    expect(socket.sent).toEqual([]);
  });

  it('sends TTS text and flush commands over Deepgram speak WebSocket', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });

    const { session, socket } = await openCreatedSocket(
      provider.startSynthesis({
        ttsModel: 'aura-2-viktoria-de',
        encoding: 'linear16',
        sampleRate: 24000,
        speed: 1,
      })
    );

    session.sendText('Hallo, wie geht es dir?');
    session.flush();

    expect(socket.url).toContain('wss://api.deepgram.com/v1/speak?');
    expect(socket.url).toContain('model=aura-2-viktoria-de');
    expect(socket.url).toContain('encoding=linear16');
    expect(socket.url).toContain('sample_rate=24000');
    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'Speak', text: 'Hallo, wie geht es dir?' }),
      JSON.stringify({ type: 'Flush' }),
    ]);
  });

  it('emits binary TTS audio chunks', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });

    const { session, socket } = await openCreatedSocket(
      provider.startSynthesis({
        ttsModel: 'aura-2-viktoria-de',
        encoding: 'linear16',
        sampleRate: 24000,
      })
    );
    const events: unknown[] = [];
    session.onEvent(event => events.push(event));
    const audio = new Uint8Array([1, 2, 3]).buffer;

    socket.onmessage?.({ data: audio });

    expect(events).toEqual([
      expect.objectContaining({
        type: 'audio',
        audio,
        mimeType: 'audio/l16;rate=24000',
      }),
    ]);
  });
});
