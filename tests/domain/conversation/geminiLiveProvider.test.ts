import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createGeminiLiveConversationProvider } from '../../../src/domain/conversation/geminiLiveProvider';
import type { LiveConversationEvent } from '../../../src/domain/conversation/liveConversationProvider';
import { CEFRLevel, ConversationMode } from '../../../types';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 1;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer | Blob }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event?: { code?: number; reason?: string }) => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send = vi.fn((data: unknown) => {
    this.sent.push(data);
  });

  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: '' });
  });

  open() {
    this.onopen?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
}

describe('Gemini Live conversation provider', () => {
  beforeEach(() => {
    vi.useRealTimers();
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the fixed Gemini Live WebSocket and waits for setupComplete before making the session usable', async () => {
    const provider = createGeminiLiveConversationProvider({
      apiKey: 'gemini-key',
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      voiceName: 'Kore',
      WebSocketCtor: MockWebSocket,
    });

    const sessionPromise = provider.startSession({
      level: CEFRLevel.B1,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      topic: 'Cafe',
      description: 'Order coffee naturally.',
    });

    const socket = MockWebSocket.instances[0]!;
    expect(socket.url).toBe(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=gemini-key'
    );

    socket.open();

    expect(JSON.parse(socket.sent[0] as string)).toMatchObject({
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
    expect(JSON.parse(socket.sent[0] as string).setup.systemInstruction.parts[0].text).toContain(
      'German conversation tutor'
    );
    expect(JSON.parse(socket.sent[0] as string).setup.systemInstruction.parts[0].text).toContain('CEFR B1');

    await expect(resolvesBeforeNextMacrotask(sessionPromise)).resolves.toBe('pending');

    socket.message({ setupComplete: {} });

    await expect(sessionPromise).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
  });

  it('rejects with a useful error when the socket never opens', async () => {
    vi.useFakeTimers();
    const provider = createGeminiLiveConversationProvider({
      apiKey: 'gemini-key',
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      voiceName: 'Kore',
      WebSocketCtor: MockWebSocket,
      openTimeoutMs: 100,
    });

    const sessionPromise = provider.startSession({
      level: CEFRLevel.B1,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
    });

    const rejection = expect(sessionPromise).rejects.toThrow('Gemini Live connection timed out');
    vi.advanceTimersByTime(100);
    await rejection;
  });

  it('sends PCM16 audio chunks and emits typed server events', async () => {
    const provider = createGeminiLiveConversationProvider({
      apiKey: 'gemini-key',
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      voiceName: 'Puck',
      WebSocketCtor: MockWebSocket,
    });
    const sessionPromise = provider.startSession({
      level: CEFRLevel.A2,
      motherLanguage: 'Arabic',
      mode: ConversationMode.SPEAKING_ACTIVITY,
    });
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    socket.message({ setupComplete: {} });
    const session = await sessionPromise;
    const events: LiveConversationEvent[] = [];
    session.onEvent(event => events.push(event));

    session.sendAudioPcm16(new Uint8Array([1, 2, 3]));
    session.sendAudioStreamEnd();

    expect(JSON.parse(socket.sent[1] as string)).toEqual({
      realtimeInput: {
        audio: {
          data: 'AQID',
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    });
    expect(JSON.parse(socket.sent[2] as string)).toEqual({
      realtimeInput: {
        audioStreamEnd: true,
      },
    });

    socket.message({
      serverContent: {
        inputTranscription: { text: 'Ich moechte Kaffee.' },
        outputTranscription: { text: 'Sehr gut. Ich moechte einen Kaffee.' },
        modelTurn: {
          parts: [
            {
              inlineData: {
                data: 'BAUG',
                mimeType: 'audio/pcm;rate=24000',
              },
            },
          ],
        },
        interrupted: true,
        turnComplete: true,
      },
    });

    expect(events).toEqual([
      { type: 'input-transcript', text: 'Ich moechte Kaffee.' },
      { type: 'output-transcript', text: 'Sehr gut. Ich moechte einen Kaffee.' },
      {
        type: 'audio',
        audio: new Uint8Array([4, 5, 6]).buffer,
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
      },
      { type: 'interrupted' },
      { type: 'turn-complete' },
    ]);
  });
});

async function resolvesBeforeNextMacrotask<T>(promise: Promise<T>): Promise<'resolved' | 'pending'> {
  return Promise.race([
    promise.then(() => 'resolved' as const),
    new Promise<'pending'>(resolve => {
      setTimeout(() => resolve('pending'), 0);
    }),
  ]);
}
