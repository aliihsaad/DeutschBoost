import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SpeakingActivityPage from '../../pages/SpeakingActivityPage';
import type { AiProvider } from '../../src/domain/ai/aiProvider';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';
import { ConversationMode } from '../../types';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    userData: { full_name: 'Local Learner' },
    userProfile: {
      current_level: 'A2',
      mother_language: 'English',
    },
  }),
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
  it('shows a setup state without free-text inputs when providers are missing', () => {
    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage />
      </MemoryRouter>
    );

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
});
