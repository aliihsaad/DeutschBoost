import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpeakingActivityPage from '../../pages/SpeakingActivityPage';
import type { AiProvider } from '../../src/domain/ai/aiProvider';
import type { StreamingAiProvider } from '../../src/domain/ai/streamingAiProvider';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';
import type {
  StreamingSpeechAudioEvent,
  StreamingSpeechProvider,
  StreamingTranscriptEvent,
} from '../../src/domain/speech/streamingSpeechProvider';
import { ConversationMode } from '../../types';

const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
}));

vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

function createAiProvider(): AiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    generateJson: vi.fn(),
    generateText: vi.fn().mockResolvedValue(
      'Fast richtig: Ich mochte einen Kaffee. Trinkst du Kaffee gern mit Milch?'
    ),
  };
}

function createSpeechProvider(): SpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    transcribe: vi.fn().mockResolvedValue({
      rawText: 'Ich mochte ein Kaffee.',
      transcript: {
        speaker: 'learner',
        text: 'Ich mochte ein Kaffee.',
        occurredAt: '2026-05-15T15:00:00.000Z',
        provider: 'deepgram',
        confidence: 0.92,
      },
    }),
    synthesize: vi.fn().mockResolvedValue({
      audio: new ArrayBuffer(3),
      mimeType: 'audio/mpeg',
    }),
  };
}

function createConversationRepository(): ConversationRepository {
  return {
    startSession: vi.fn().mockResolvedValue('local-session-1'),
    appendTranscript: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    loadRecentSessions: vi.fn().mockResolvedValue([]),
    loadLastFeedback: vi.fn().mockResolvedValue(null),
  };
}

function createStreamingAiProvider(): StreamingAiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    async *streamText() {
      yield { text: 'Sehr gut. ' };
      yield { text: 'Was machst du morgen?' };
    },
  };
}

function createStreamingSpeechProvider() {
  const sttListeners = new Set<(event: StreamingTranscriptEvent) => void>();
  const ttsListeners = new Set<(event: StreamingSpeechAudioEvent) => void>();
  const provider: StreamingSpeechProvider = {
    id: 'deepgram',
    displayName: 'Deepgram',
    startTranscription: vi.fn().mockResolvedValue({
      id: 'stt-1',
      sendAudio: vi.fn(),
      finalize: vi.fn(),
      close: vi.fn(),
      onEvent: (listener: (event: StreamingTranscriptEvent) => void) => {
        sttListeners.add(listener);
        return () => sttListeners.delete(listener);
      },
    }),
    startSynthesis: vi.fn().mockResolvedValue({
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
    }),
  };

  return {
    provider,
    emitTranscript: (event: StreamingTranscriptEvent) => sttListeners.forEach(listener => listener(event)),
  };
}

describe('SpeakingActivityPage local conversation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({
      currentLevel: 'A2',
      motherLanguage: 'english',
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:tutor-reply-audio'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      'Audio',
      class {
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor(readonly src: string) {}

        play() {
          this.onended?.();
          return Promise.resolve();
        }
      }
    );
  });

  it('shows a setup state without free-text inputs when providers are missing', async () => {
    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: 'Conversation Tutor' })).toBeInTheDocument();
    expect(screen.getByText('Connect OpenRouter and Deepgram')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('records a learner turn, transcribes it, gets a tutor response, and stores both turns locally', async () => {
    const aiProvider = createAiProvider();
    const speechProvider = createSpeechProvider();
    const conversationRepository = createConversationRepository();
    const stopRecording = vi.fn().mockResolvedValue({
      audio: new Blob(['voice'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      playbackUrl: 'blob:conversation-turn',
    });
    const audioRecorder = vi.fn().mockResolvedValue({
      stop: stopRecording,
      cancel: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage
          aiProvider={aiProvider}
          speechProvider={speechProvider}
          conversationRepository={conversationRepository}
          audioRecorder={audioRecorder}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    await waitFor(() => {
      expect(conversationRepository.startSession).toHaveBeenCalledWith({
        learnerId: 'local-learner',
        mode: ConversationMode.FREE_CONVERSATION,
        startedAt: expect.any(String),
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Record answer' }));

    await waitFor(() => {
      expect(audioRecorder).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop and send' }));

    expect(await screen.findByText('Ich mochte ein Kaffee.')).toBeInTheDocument();
    expect(
      await screen.findByText('Fast richtig: Ich mochte einen Kaffee. Trinkst du Kaffee gern mit Milch?')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Last recorded learner audio')).toHaveAttribute(
      'src',
      'blob:conversation-turn'
    );
    expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(2);
    expect(speechProvider.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.any(Blob),
        mimeType: 'audio/webm',
      })
    );
    expect(aiProvider.generateText).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'End session' }));

    await waitFor(() => {
      expect(conversationRepository.endSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-session-1',
          feedback: expect.objectContaining({
            overallScore: 0,
            areasForImprovement: expect.arrayContaining([
              expect.stringContaining('at least two spoken turns'),
            ]),
          }),
        })
      );
    });
  });

  it('plays tutor replies through the configured speech provider', async () => {
    const aiProvider = createAiProvider();
    const speechProvider = createSpeechProvider();
    const conversationRepository = createConversationRepository();
    const stopRecording = vi.fn().mockResolvedValue({
      audio: new Blob(['voice'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      playbackUrl: 'blob:conversation-turn',
    });
    const audioRecorder = vi.fn().mockResolvedValue({
      stop: stopRecording,
      cancel: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage
          aiProvider={aiProvider}
          speechProvider={speechProvider}
          conversationRepository={conversationRepository}
          audioRecorder={audioRecorder}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    await screen.findByRole('button', { name: 'Record answer' });
    fireEvent.click(screen.getByRole('button', { name: 'Record answer' }));
    await waitFor(() => {
      expect(audioRecorder).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop and send' }));
    await screen.findByText('Fast richtig: Ich mochte einen Kaffee. Trinkst du Kaffee gern mit Milch?');

    fireEvent.click(screen.getByRole('button', { name: 'Play tutor reply' }));

    await waitFor(() => {
      expect(speechProvider.synthesize).toHaveBeenCalledWith({
        feature: 'conversation-tutor-reply',
        text: 'Fast richtig: Ich mochte einen Kaffee. Trinkst du Kaffee gern mit Milch?',
        options: { language: 'de' },
      });
    });
  });

  it('runs a hands-free live practice turn when streaming providers are available', async () => {
    const aiProvider = createAiProvider();
    const speechProvider = createSpeechProvider();
    const streamingAiProvider = createStreamingAiProvider();
    const streamingSpeech = createStreamingSpeechProvider();
    const conversationRepository = createConversationRepository();
    const startLiveAudioStream = vi.fn(async ({ onAudioChunk }) => {
      onAudioChunk(new Uint8Array([4, 5, 6]));
      return { stop: vi.fn() };
    });
    const playLiveTutorAudio = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage
          aiProvider={aiProvider}
          speechProvider={speechProvider}
          streamingAiProvider={streamingAiProvider}
          streamingSpeechProvider={streamingSpeech.provider}
          conversationRepository={conversationRepository}
          startLiveAudioStream={startLiveAudioStream}
          playLiveTutorAudio={playLiveTutorAudio}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start live practice' }));

    expect(
      await within(screen.getByLabelText('Live practice controls')).findByText('Listening')
    ).toBeInTheDocument();
    expect(startLiveAudioStream).toHaveBeenCalled();

    await act(async () => {
      streamingSpeech.emitTranscript({
        type: 'final',
        turn: {
          speaker: 'learner',
          text: 'Ich gehe morgen ins Kino.',
          occurredAt: '2026-05-16T12:00:00.000Z',
          provider: 'deepgram',
        },
      });
    });

    expect(await screen.findByText('Ich gehe morgen ins Kino.')).toBeInTheDocument();
    expect(await screen.findByText('Sehr gut. Was machst du morgen?')).toBeInTheDocument();
    expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(2);
    expect(streamingSpeech.provider.startSynthesis).toHaveBeenCalled();
    expect(playLiveTutorAudio).toHaveBeenCalledWith(expect.any(Blob), 'audio/mpeg');
  });
});
