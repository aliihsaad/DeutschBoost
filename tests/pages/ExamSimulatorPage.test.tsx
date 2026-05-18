import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamSimulatorPage } from '../../pages/ExamSimulatorPage';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import type { ExamAttemptRepository } from '../../src/domain/exam/examAttemptRepository';
import type { ExamAttempt } from '../../src/domain/exam/examTypes';
import type {
  LiveConversationEvent,
  LiveConversationProvider,
  LiveConversationSession,
} from '../../src/domain/conversation/liveConversationProvider';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';
import { ConversationMode } from '../../types';
import { CEFRLevel } from '../../types';

const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
}));

vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

describe('ExamSimulatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({
      currentLevel: CEFRLevel.B1,
    });
  });

  it('runs a full timed Goethe-style exam, shows the result, and saves history', async () => {
    const repository = createMemoryExamRepository();
    const speechProvider = createSpeechProvider();
    const playExamAudio = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          examRepository={repository}
          speechProvider={speechProvider}
          playExamAudio={playExamAudio}
          now={vi
            .fn()
            .mockReturnValueOnce('2026-05-18T10:00:00.000Z')
            .mockReturnValue('2026-05-18T10:30:00.000Z')}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Goethe Exam Simulator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /B1/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/local fallback ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByRole('heading', { name: /Hoeren - Listening/i })).toBeInTheDocument();
    const templateProfile = screen.getByLabelText('Exam template profile');
    expect(within(templateProfile).getByText('Goethe-Zertifikat B1 public model-test profile')).toBeInTheDocument();
    expect(within(templateProfile).getByText('Announcements and short messages')).toBeInTheDocument();
    expect(screen.getByText(/40:00/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 1' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(1));
    answerQuestion(0, 'Richtig');
    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 2' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(2));
    answerQuestion(1, 'Falsch');
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    expect(await screen.findByRole('heading', { name: /Lesen - Reading/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Im Raum 204'));
    fireEvent.click(screen.getByLabelText('Um 10 Uhr'));
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    expect(await screen.findByRole('heading', { name: /Schreiben - Writing/i })).toBeInTheDocument();
    screen.getAllByPlaceholderText('Write your exam answer here...').forEach(textarea => {
      fireEvent.change(textarea, {
        target: { value: germanExamAnswer(95) },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    expect(await screen.findByRole('heading', { name: /Sprechen - Speaking/i })).toBeInTheDocument();
    screen.getAllByPlaceholderText('Write your spoken answer or transcript here...').forEach(textarea => {
      fireEvent.change(textarea, {
        target: { value: germanExamAnswer(75) },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit exam and show result/i }));

    expect(await screen.findByText('Exam result')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Passed|Needs more work/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Detailed exam score sheet')).toBeInTheDocument();
    expect(await screen.findByLabelText('Exam history')).toHaveTextContent('B1 simulated exam');
    expect(repository.savedAttempts).toHaveLength(1);
    expect(repository.savedAttempts[0].result.moduleResults).toHaveLength(4);
  }, 10000);

  it('plays Hoeren questions through Deepgram TTS before answers can be selected', async () => {
    const speechProvider = createSpeechProvider();
    const playExamAudio = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          examRepository={createMemoryExamRepository()}
          speechProvider={speechProvider}
          playExamAudio={playExamAudio}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByRole('heading', { name: /Hoeren - Listening/i })).toBeInTheDocument();
    expect(screen.queryByText(/Audio Teil 1\.1/i)).not.toBeInTheDocument();
    expect(within(getQuestion(0)).getByLabelText('Richtig')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 1' }));

    await waitFor(() => {
      expect(speechProvider.synthesize).toHaveBeenCalledWith({
        feature: 'goethe-exam-listening',
        text: expect.stringContaining('Sprachschule Berger'),
        options: { language: 'de' },
      });
      expect(playExamAudio).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'audio/mpeg');
    });
    expect(screen.queryByText(/Guten Tag, hier ist die Sprachschule Berger/i)).not.toBeInTheDocument();
    expect(speechProvider.synthesize).toHaveBeenCalledWith({
      feature: 'goethe-exam-listening',
      text: expect.stringContaining('Sprachschule Berger'),
      options: { language: 'de' },
    });
    expect(within(getQuestion(0)).getByLabelText('Richtig')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play listening audio for question 1' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 1' }));

    expect(speechProvider.synthesize).toHaveBeenCalledTimes(1);
  });

  it('uses the configured AI provider to generate original exam content', async () => {
    const aiProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({
        title: 'Generated B1 Exam',
        modules: [],
      }),
    };

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          aiProvider={aiProvider}
          examRepository={createMemoryExamRepository()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText(/AI generation enabled/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByRole('heading', { name: /Hoeren - Listening/i })).toBeInTheDocument();
    expect(aiProvider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'goethe-exam-simulator-generation',
      })
    );
  });

  it('shows an active progress indicator while AI exam generation is still running', async () => {
    let resolveGeneration: (value: unknown) => void = () => {};
    const aiProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn(
        () =>
          new Promise(resolve => {
            resolveGeneration = resolve;
          })
      ),
    };

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          aiProvider={aiProvider}
          examRepository={createMemoryExamRepository()}
          now={() => '2026-05-18T12:00:00.000Z'}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByRole('progressbar', { name: /Generating exam/i })).toBeInTheDocument();
    expect(screen.getByText(/Creating listening, reading, writing, and speaking tasks/i)).toBeInTheDocument();

    resolveGeneration({ title: 'Generated B1 Exam', modules: [] });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar', { name: /Generating exam/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('heading', { name: /Hoeren - Listening/i })).toBeInTheDocument();
  });

  it('uses Gemini Live as an oral examiner and saves the learner speaking transcript', async () => {
    const repository = createMemoryExamRepository();
    const speechProvider = createSpeechProvider();
    const liveConversation = createLiveConversationProvider();
    const conversationRepository = createConversationRepository();
    const startGeminiLiveAudioCapture = vi.fn(async ({ onPcmChunk }) => {
      onPcmChunk(new Uint8Array([9, 8, 7]));
      return { stop: vi.fn() };
    });
    const playGeminiLiveAudio = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          examRepository={repository}
          speechProvider={speechProvider}
          playExamAudio={vi.fn().mockResolvedValue(undefined)}
          liveConversationProvider={liveConversation.provider}
          conversationRepository={conversationRepository}
          startGeminiLiveAudioCapture={startGeminiLiveAudioCapture}
          playGeminiLiveAudio={playGeminiLiveAudio}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Generate and start exam/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Play listening audio for question 1' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(1));
    answerQuestion(0, 'Richtig');
    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 2' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(2));
    answerQuestion(1, 'Falsch');
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    fireEvent.click(await screen.findByLabelText('Im Raum 204'));
    fireEvent.click(screen.getByLabelText('Um 10 Uhr'));
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    (await screen.findAllByPlaceholderText('Write your exam answer here...')).forEach(textarea => {
      fireEvent.change(textarea, {
        target: { value: germanExamAnswer(90) },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    expect(await screen.findByRole('heading', { name: /Sprechen - Speaking/i })).toBeInTheDocument();
    expect(screen.getByText('Gemini Live oral examiner')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start oral exam' }));

    const oralControls = screen.getByLabelText('Gemini Live oral exam controls');
    expect((await within(oralControls).findAllByText('Listening')).length).toBeGreaterThan(0);
    expect(liveConversation.provider.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: ConversationMode.SPEAKING_ACTIVITY,
        topic: 'Goethe B1 speaking exam',
        instructionOverride: expect.stringContaining('Goethe oral examiner'),
      })
    );
    expect(liveConversation.session.sendAudioPcm16).toHaveBeenCalledWith(new Uint8Array([9, 8, 7]));

    await act(async () => {
      liveConversation.emit({ type: 'output-transcript', text: 'Bitte planen Sie zusammen einen Ausflug.' });
      liveConversation.emit({ type: 'input-transcript', text: 'Ich moechte einen Ausflug nach Berlin planen.' });
    });

    expect(await screen.findByText('Bitte planen Sie zusammen einen Ausflug.')).toBeInTheDocument();
    expect((await screen.findAllByText('Ich moechte einen Ausflug nach Berlin planen.')).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText('Write your spoken answer or transcript here...')[0]).toHaveValue(
      'Ich moechte einen Ausflug nach Berlin planen.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'End oral exam' }));
    await waitFor(() => {
      expect(conversationRepository.endSession).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit exam and show result/i }));

    await screen.findByText('Exam result');
    expect(repository.savedAttempts[0].answers.productive['B1-speaking-1']).toContain(
      'Ich moechte einen Ausflug nach Berlin planen.'
    );
  }, 10000);

  it('renders saved exam history with scores', async () => {
    const repository = createMemoryExamRepository([
      createAttempt({ percentage: 72, passed: true }),
      createAttempt({ id: 'attempt-old', percentage: 48, passed: false }),
    ]);

    render(
      <MemoryRouter>
        <ExamSimulatorPage examRepository={repository} />
      </MemoryRouter>
    );

    const history = await screen.findByLabelText('Exam history');
    expect(within(history).getByText('72%')).toBeInTheDocument();
    expect(within(history).getByText('48%')).toBeInTheDocument();
    expect(within(history).getByText('Passed')).toBeInTheDocument();
    expect(within(history).getByText('Needs work')).toBeInTheDocument();
  });
});

function getQuestion(index: number): HTMLElement {
  return screen.getAllByRole('group')[index] as HTMLElement;
}

function answerQuestion(index: number, label: string): void {
  fireEvent.click(within(getQuestion(index)).getByLabelText(label));
}

function createConversationRepository(): ConversationRepository {
  return {
    startSession: vi.fn().mockResolvedValue('exam-speaking-session'),
    appendTranscript: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    loadRecentSessions: vi.fn().mockResolvedValue([]),
    loadLastFeedback: vi.fn().mockResolvedValue(null),
  };
}

function createLiveConversationProvider() {
  const listeners = new Set<(event: LiveConversationEvent) => void>();
  const session: LiveConversationSession = {
    id: 'gemini-live-exam-session',
    sendAudioPcm16: vi.fn(),
    sendAudioStreamEnd: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn(),
    onEvent: (listener: (event: LiveConversationEvent) => void) => {
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

function createSpeechProvider(): SpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    transcribe: vi.fn(),
    synthesize: vi.fn().mockResolvedValue({
      audio: new ArrayBuffer(3),
      mimeType: 'audio/mpeg',
    }),
  };
}

function createMemoryExamRepository(initialAttempts: ExamAttempt[] = []): ExamAttemptRepository & { savedAttempts: ExamAttempt[] } {
  const attempts = [...initialAttempts];

  return {
    savedAttempts: attempts,
    async listAttempts(learnerId: string) {
      return attempts.filter(attempt => attempt.learnerId === learnerId);
    },
    async saveAttempt(attempt: ExamAttempt) {
      attempts.unshift(attempt);
    },
  };
}

function createAttempt(input: { id?: string; percentage: number; passed: boolean }): ExamAttempt {
  return {
    id: input.id ?? 'attempt-new',
    learnerId: 'local-learner',
    examId: 'exam-1',
    title: 'B1 simulated exam',
    level: CEFRLevel.B1,
    startedAt: '2026-05-18T09:00:00.000Z',
    completedAt: input.id === 'attempt-old' ? '2026-05-17T09:30:00.000Z' : '2026-05-18T09:30:00.000Z',
    durationSeconds: 1800,
    answers: { objective: {}, productive: {} },
    result: {
      totalEarnedPoints: input.percentage,
      totalPossiblePoints: 100,
      percentage: input.percentage,
      passed: input.passed,
      summary: input.passed ? 'Passed' : 'Needs work',
      moduleResults: [],
    },
  };
}

function germanExamAnswer(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, index) =>
    index % 12 === 0 ? 'Ich' : 'moechte'
  ).join(' ') + '.';
}
