import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpeakingActivityPage from '../../pages/SpeakingActivityPage';
import type { AiProvider } from '../../src/domain/ai/aiProvider';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';
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
});
