import { describe, expect, it, vi } from 'vitest';
import { createHandsFreeConversationController } from '../../src/application/handsFreeConversation';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import type { StreamingAiProvider } from '../../src/domain/ai/streamingAiProvider';
import type {
  StreamingSpeechAudioEvent,
  StreamingSpeechProvider,
  StreamingTranscriptEvent,
} from '../../src/domain/speech/streamingSpeechProvider';
import { CEFRLevel, ConversationMode } from '../../types';

function createConversationRepository(): ConversationRepository {
  return {
    startSession: vi.fn().mockResolvedValue('session-1'),
    appendTranscript: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    loadRecentSessions: vi.fn().mockResolvedValue([]),
    loadLastFeedback: vi.fn().mockResolvedValue(null),
  };
}

function createStreamingSpeechProvider() {
  const sttListeners = new Set<(event: StreamingTranscriptEvent) => void>();
  const ttsListeners = new Set<(event: StreamingSpeechAudioEvent) => void>();
  const sttSession = {
    id: 'stt-1',
    sendAudio: vi.fn(),
    finalize: vi.fn(),
    close: vi.fn(),
    onEvent: (listener: (event: StreamingTranscriptEvent) => void) => {
      sttListeners.add(listener);
      return () => sttListeners.delete(listener);
    },
    emit: (event: StreamingTranscriptEvent) => {
      sttListeners.forEach(listener => listener(event));
    },
  };
  const ttsSession = {
    id: 'tts-1',
    sendText: vi.fn(),
    flush: vi.fn(() => {
      ttsListeners.forEach(listener =>
        listener({ type: 'audio', audio: new Uint8Array([1, 2, 3]).buffer, mimeType: 'audio/mpeg' })
      );
      ttsListeners.forEach(listener => listener({ type: 'flushed' }));
    }),
    clear: vi.fn(),
    close: vi.fn(),
    onEvent: (listener: (event: StreamingSpeechAudioEvent) => void) => {
      ttsListeners.add(listener);
      return () => ttsListeners.delete(listener);
    },
  };
  const provider: StreamingSpeechProvider = {
    id: 'deepgram',
    displayName: 'Deepgram',
    startTranscription: vi.fn().mockResolvedValue(sttSession),
    startSynthesis: vi.fn().mockResolvedValue(ttsSession),
  };

  return { provider, sttSession, ttsSession };
}

function createStreamingAiProvider(response = ['Fast richtig. ', 'Was trinkst du gern?']): StreamingAiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    async *streamText() {
      for (const text of response) {
        yield { text };
      }
    },
  };
}

function createControllerInput(overrides: Partial<Parameters<typeof createHandsFreeConversationController>[0]> = {}) {
  const audioStream = { stop: vi.fn() };
  const startAudioStream = vi.fn(async ({ onAudioChunk }) => {
    onAudioChunk(new Uint8Array([4, 5, 6]));
    return audioStream;
  });
  const speech = createStreamingSpeechProvider();
  const conversationRepository = createConversationRepository();
  const playTutorAudio = vi.fn().mockResolvedValue(undefined);

  return {
    input: {
      speechProvider: speech.provider,
      aiProvider: createStreamingAiProvider(),
      conversationRepository,
      learnerId: 'local-learner',
      level: CEFRLevel.A2,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      startAudioStream,
      playTutorAudio,
      now: () => '2026-05-16T12:00:00.000Z',
      ...overrides,
    },
    speech,
    conversationRepository,
    startAudioStream,
    audioStream,
    playTutorAudio,
  };
}

describe('createHandsFreeConversationController', () => {
  it('streams mic chunks into Deepgram and returns to listening after a tutor reply', async () => {
    const { input, speech, conversationRepository, startAudioStream, audioStream, playTutorAudio } =
      createControllerInput();
    const controller = createHandsFreeConversationController(input);
    const states: string[] = [];
    controller.onStateChange(state => states.push(state.status));

    await controller.start();

    expect(startAudioStream).toHaveBeenCalledTimes(1);
    expect(speech.sttSession.sendAudio).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));

    speech.sttSession.emit({
      type: 'final',
      turn: {
        speaker: 'learner',
        text: 'Ich mochte einen Kaffee.',
        occurredAt: '2026-05-16T12:00:00.000Z',
        provider: 'deepgram',
      },
    });

    await controller.waitForIdle();

    expect(states).toEqual(expect.arrayContaining(['connecting', 'listening', 'thinking', 'speaking']));
    expect(controller.getState().status).toBe('listening');
    expect(controller.getState().turns.map(turn => turn.text)).toEqual([
      'Ich mochte einen Kaffee.',
      'Fast richtig. Was trinkst du gern?',
    ]);
    expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(2);
    expect(audioStream.stop).toHaveBeenCalled();
    expect(startAudioStream).toHaveBeenCalledTimes(2);
    expect(speech.ttsSession.sendText).toHaveBeenCalledWith('Fast richtig. Was trinkst du gern?');
    expect(speech.ttsSession.flush).toHaveBeenCalled();
    expect(playTutorAudio).toHaveBeenCalledWith(expect.any(Blob), 'audio/mpeg');
  });

  it('preserves the learner turn when the tutor stream fails', async () => {
    const speech = createStreamingSpeechProvider();
    const conversationRepository = createConversationRepository();
    const controller = createHandsFreeConversationController({
      speechProvider: speech.provider,
      aiProvider: {
        id: 'openrouter',
        displayName: 'OpenRouter',
        async *streamText() {
          throw new Error('OpenRouter unavailable');
        },
      },
      conversationRepository,
      learnerId: 'local-learner',
      level: CEFRLevel.A2,
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      startAudioStream: vi.fn(async () => ({ stop: vi.fn() })),
      playTutorAudio: vi.fn(),
      now: () => '2026-05-16T12:00:00.000Z',
    });
    const errorReached = waitForStatus(controller, 'error');

    await controller.start();
    speech.sttSession.emit({
      type: 'final',
      turn: {
        speaker: 'learner',
        text: 'Ich gehe morgen ins Kino.',
        occurredAt: '2026-05-16T12:00:00.000Z',
        provider: 'deepgram',
      },
    });
    await errorReached;

    expect(controller.getState().turns.map(turn => turn.text)).toEqual(['Ich gehe morgen ins Kino.']);
    expect(controller.getState().errorMessage).toBe('OpenRouter unavailable');
    expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(1);
  });
});

function waitForStatus(
  controller: ReturnType<typeof createHandsFreeConversationController>,
  status: string
): Promise<void> {
  if (controller.getState().status === status) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const unsubscribe = controller.onStateChange(state => {
      if (state.status === status) {
        unsubscribe();
        resolve();
      }
    });
  });
}
