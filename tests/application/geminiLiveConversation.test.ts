import { describe, expect, it, vi } from 'vitest';
import { createGeminiLiveConversationController } from '../../src/application/geminiLiveConversation';
import type {
  LiveConversationEvent,
  LiveConversationProvider,
  LiveConversationSession,
} from '../../src/domain/conversation/liveConversationProvider';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import { CEFRLevel, ConversationMode } from '../../types';

function createConversationRepository(): ConversationRepository {
  return {
    startSession: vi.fn().mockResolvedValue('live-session-1'),
    appendTranscript: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    loadRecentSessions: vi.fn().mockResolvedValue([]),
    loadLastFeedback: vi.fn().mockResolvedValue(null),
  };
}

function createLiveProvider() {
  const listeners = new Set<(event: LiveConversationEvent) => void>();
  const session: LiveConversationSession = {
    id: 'gemini-live-session',
    sendAudioPcm16: vi.fn(),
    sendAudioStreamEnd: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn(),
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const provider: LiveConversationProvider = {
    id: 'gemini-live',
    displayName: 'Gemini Live',
    startSession: vi.fn().mockResolvedValue(session),
  };

  return {
    provider,
    session,
    emit: (event: LiveConversationEvent) => listeners.forEach(listener => listener(event)),
  };
}

describe('Gemini Live conversation controller', () => {
  it('streams PCM audio into Gemini Live, stores transcripts, plays tutor audio, and ends locally', async () => {
    const live = createLiveProvider();
    const conversationRepository = createConversationRepository();
    const audioCapture = { stop: vi.fn() };
    const startAudioCapture = vi.fn(async ({ onPcmChunk }) => {
      onPcmChunk(new Uint8Array([1, 2, 3]));
      return audioCapture;
    });
    const playTutorAudio = vi.fn().mockResolvedValue(undefined);
    const controller = createGeminiLiveConversationController({
      liveProvider: live.provider,
      conversationRepository,
      learnerId: 'local-learner',
      level: CEFRLevel.B1,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      topic: 'Cafe',
      description: 'Order coffee.',
      startAudioCapture,
      playTutorAudio,
      now: vi
        .fn()
        .mockReturnValueOnce('2026-05-16T17:00:00.000Z')
        .mockReturnValueOnce('2026-05-16T17:00:01.000Z')
        .mockReturnValueOnce('2026-05-16T17:00:02.000Z')
        .mockReturnValue('2026-05-16T17:00:05.000Z'),
    });

    await controller.start();

    expect(conversationRepository.startSession).toHaveBeenCalledWith({
      learnerId: 'local-learner',
      mode: ConversationMode.FREE_CONVERSATION,
      startedAt: '2026-05-16T17:00:00.000Z',
    });
    expect(live.provider.startSession).toHaveBeenCalledWith({
      level: CEFRLevel.B1,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      topic: 'Cafe',
      description: 'Order coffee.',
    });
    expect(startAudioCapture).toHaveBeenCalled();
    expect(live.session.sendAudioPcm16).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(controller.getState().status).toBe('listening');

    // Gemini streams transcription as deltas; a turn is finalized/persisted at
    // a turn boundary (speaker switch or turn-complete), not per delta.
    live.emit({ type: 'input-transcript', text: 'Ich moechte ' });
    live.emit({ type: 'input-transcript', text: 'Kaffee.' });
    live.emit({ type: 'output-transcript', text: 'Gern. ' });
    live.emit({ type: 'output-transcript', text: 'Ich moechte einen Kaffee.' });
    live.emit({
      type: 'audio',
      audio: new Uint8Array([4, 5, 6]).buffer,
      mimeType: 'audio/pcm;rate=24000',
      sampleRate: 24000,
    });
    live.emit({ type: 'turn-complete' });

    expect(conversationRepository.appendTranscript).toHaveBeenCalledWith(
      'live-session-1',
      expect.objectContaining({
        speaker: 'learner',
        text: 'Ich moechte Kaffee.',
        provider: 'gemini-live',
      })
    );
    expect(conversationRepository.appendTranscript).toHaveBeenCalledWith(
      'live-session-1',
      expect.objectContaining({
        speaker: 'tutor',
        text: 'Gern. Ich moechte einen Kaffee.',
        provider: 'gemini-live',
      })
    );
    expect(playTutorAudio).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'audio/pcm;rate=24000',
      24000
    );
    expect(controller.getState().turns.map(turn => turn.text)).toEqual([
      'Ich moechte Kaffee.',
      'Gern. Ich moechte einen Kaffee.',
    ]);

    await controller.end();

    expect(live.session.sendAudioStreamEnd).toHaveBeenCalled();
    expect(audioCapture.stop).toHaveBeenCalled();
    expect(live.session.close).toHaveBeenCalled();
    expect(conversationRepository.endSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'live-session-1',
        learnerId: 'local-learner',
        durationSeconds: 5,
        transcript: expect.arrayContaining([
          expect.objectContaining({ text: 'Ich moechte Kaffee.' }),
          expect.objectContaining({ text: 'Gern. Ich moechte einen Kaffee.' }),
        ]),
      })
    );
  });

  it('accumulates streaming transcript deltas into one turn and resets tutor audio on interrupt', async () => {
    const live = createLiveProvider();
    const conversationRepository = createConversationRepository();
    const resetTutorAudio = vi.fn();
    const controller = createGeminiLiveConversationController({
      liveProvider: live.provider,
      conversationRepository,
      learnerId: 'local-learner',
      level: CEFRLevel.B1,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      startAudioCapture: vi.fn(async () => ({ stop: vi.fn() })),
      playTutorAudio: vi.fn().mockResolvedValue(undefined),
      resetTutorAudio,
      now: () => '2026-05-16T17:00:00.000Z',
    });

    await controller.start();

    live.emit({ type: 'output-transcript', text: 'Hallo. ' });
    live.emit({ type: 'output-transcript', text: 'Wie ' });
    live.emit({ type: 'output-transcript', text: 'geht es dir?' });

    // Mid-stream there is exactly one growing tutor turn, not one per delta.
    expect(controller.getState().turns).toHaveLength(1);
    expect(controller.getState().turns[0]).toMatchObject({
      speaker: 'tutor',
      text: 'Hallo. Wie geht es dir?',
    });
    expect(conversationRepository.appendTranscript).not.toHaveBeenCalled();

    live.emit({ type: 'turn-complete' });

    expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(1);
    expect(conversationRepository.appendTranscript).toHaveBeenCalledWith(
      'live-session-1',
      expect.objectContaining({ speaker: 'tutor', text: 'Hallo. Wie geht es dir?' })
    );

    controller.interrupt();
    expect(resetTutorAudio).toHaveBeenCalled();
  });

  it('starts microphone capture before async Gemini setup and only sends chunks after the live session is ready', async () => {
    let resolveLiveSession: (session: LiveConversationSession) => void = () => undefined;
    const session: LiveConversationSession = {
      id: 'gemini-live-session',
      sendAudioPcm16: vi.fn(),
      sendAudioStreamEnd: vi.fn(),
      interrupt: vi.fn(),
      close: vi.fn(),
      onEvent: vi.fn(() => () => undefined),
    };
    const provider: LiveConversationProvider = {
      id: 'gemini-live',
      displayName: 'Gemini Live',
      startSession: vi.fn(
        () =>
          new Promise(resolve => {
            resolveLiveSession = resolve;
          })
      ),
    };
    const conversationRepository = createConversationRepository();
    let pushPcmChunk: (chunk: Uint8Array) => void = () => undefined;
    const startAudioCapture = vi.fn(async ({ onPcmChunk }) => {
      pushPcmChunk = onPcmChunk;
      onPcmChunk(new Uint8Array([9, 9, 9]));
      return { stop: vi.fn() };
    });
    const controller = createGeminiLiveConversationController({
      liveProvider: provider,
      conversationRepository,
      learnerId: 'local-learner',
      level: CEFRLevel.B1,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      startAudioCapture,
      playTutorAudio: vi.fn().mockResolvedValue(undefined),
    });

    const startPromise = controller.start();

    await vi.waitFor(() => {
      expect(startAudioCapture).toHaveBeenCalled();
    });
    expect(provider.startSession).toHaveBeenCalled();
    expect(session.sendAudioPcm16).not.toHaveBeenCalled();

    resolveLiveSession(session);
    await startPromise;
    pushPcmChunk(new Uint8Array([1, 2, 3]));

    expect(session.sendAudioPcm16).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
  });
});
