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
import { createExamBlueprint } from '../../src/domain/exam/examTemplates';

// Deterministic, schema-valid content for one module, built from the blueprint
// so counts match validateObjectiveModule's expectations. Tokens are stable so
// tests can assert against them without depending on the deleted skeleton.
function validExamModuleResponse(level: CEFRLevel, moduleId: string) {
  const module = createExamBlueprint({ level }).modules.find(m => m.id === moduleId)!;
  if (moduleId === 'listening' || moduleId === 'reading') {
    return {
      objectiveQuestions: module.templateParts.flatMap(part =>
        Array.from({ length: Math.max(1, part.questionCount ?? part.maxPoints ?? 1) }, (_, i) => ({
          id: `${moduleId}-${part.id}-${i}`,
          partId: part.id,
          passage: `Durchsage ${moduleId} ${part.id} Nr ${i}: Der Termin ist am ${i + 1}. Mai um ${9 + i} Uhr im Raum ${part.id}.`,
          prompt: `${part.id} Frage ${i}: Wann ist der Termin in ${part.id} Nr ${i}?`,
          options: [`am ${i + 1}. Mai ${part.id}${i}`, `niemals ${part.id}${i}`, `gestern ${part.id}${i}`],
          correctOptionIndex: 0,
          points: 1,
          explanation: 'Steht im Text.',
        }))
      ),
    };
  }
  return {
    productiveTasks: module.templateParts.map((part, i) => ({
      id: `${moduleId}-${i + 1}`,
      partId: part.id,
      moduleId: moduleId === 'speaking' ? 'speaking' : 'writing',
      prompt: `${moduleId} ${part.id}: Bearbeiten Sie Aufgabe ${i + 1} klar und vollstaendig.`,
      points: part.maxPoints ?? 20,
      rubric: ['Inhalt', 'Sprache'],
    })),
  };
}

function moduleIdFromMessages(messages: { content: string }[]): string {
  return (
    ['listening', 'reading', 'writing', 'speaking'].find(id =>
      messages.some(m => m.content.includes(`module only: "${id}"`))
    ) ?? 'reading'
  );
}

function mockExamAiProvider(level: CEFRLevel = CEFRLevel.B1) {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    generateText: vi.fn(),
    generateJson: vi.fn(async (request: { messages: { content: string }[] }) =>
      validExamModuleResponse(level, moduleIdFromMessages(request.messages))
    ),
  };
}

function answerFirstOption(index: number): void {
  const radios = within(getQuestion(index)).getAllByRole('radio');
  fireEvent.click(radios[0] as HTMLElement);
}

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
          aiProvider={mockExamAiProvider()}
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
    expect(screen.getByText(/AI generation enabled/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByRole('heading', { name: /Hoeren - Listening/i })).toBeInTheDocument();
    const templateProfile = screen.getByLabelText('Exam template profile');
    expect(within(templateProfile).getByText('Goethe-Zertifikat B1 public model-test profile')).toBeInTheDocument();
    expect(within(templateProfile).getByText('Announcements and short messages')).toBeInTheDocument();
    expect(screen.getByText(/40:00/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 1' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(1));
    answerFirstOption(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 2' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(2));
    answerFirstOption(1);
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    expect(await screen.findByRole('heading', { name: /Lesen - Reading/i })).toBeInTheDocument();
    answerFirstOption(0);
    answerFirstOption(1);
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
  }, 30000);

  it('plays Hoeren questions through Deepgram TTS before answers can be selected', async () => {
    const speechProvider = createSpeechProvider();
    const playExamAudio = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          aiProvider={mockExamAiProvider()}
          examRepository={createMemoryExamRepository()}
          speechProvider={speechProvider}
          playExamAudio={playExamAudio}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByRole('heading', { name: /Hoeren - Listening/i })).toBeInTheDocument();
    // The hidden audio script must never be shown to the learner.
    expect(screen.queryByText(/Durchsage listening teil-1 Nr 0/i)).not.toBeInTheDocument();
    expect(within(getQuestion(0)).getAllByRole('radio')[0]).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 1' }));

    await waitFor(() => {
      expect(speechProvider.synthesize).toHaveBeenCalledWith({
        feature: 'goethe-exam-listening',
        text: expect.stringContaining('Durchsage listening teil-1 Nr 0'),
        options: { language: 'de' },
      });
      expect(playExamAudio).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'audio/mpeg');
    });
    expect(screen.queryByText(/Durchsage listening teil-1 Nr 0/i)).not.toBeInTheDocument();
    expect(within(getQuestion(0)).getAllByRole('radio')[0]).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play listening audio for question 1' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 1' }));

    expect(speechProvider.synthesize).toHaveBeenCalledTimes(1);
  });

  it('generates original exam content per module via the AI provider', async () => {
    const aiProvider = mockExamAiProvider();

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
    for (const moduleId of ['listening', 'reading', 'writing', 'speaking']) {
      expect(aiProvider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: `goethe-exam-${moduleId}` })
      );
    }
  });

  it('shows an active progress indicator while AI exam generation is still running', async () => {
    const pending: Array<{ moduleId: string; resolve: (value: unknown) => void }> = [];
    const aiProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn(
        (request: { messages: { content: string }[] }) =>
          new Promise(resolve => {
            pending.push({ moduleId: moduleIdFromMessages(request.messages), resolve });
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

    await waitFor(() => expect(pending.length).toBe(4));
    await act(async () => {
      pending.forEach(({ moduleId, resolve }) =>
        resolve(validExamModuleResponse(CEFRLevel.B1, moduleId))
      );
    });

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
          aiProvider={mockExamAiProvider()}
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
    answerFirstOption(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play listening audio for question 2' }));
    await waitFor(() => expect(speechProvider.synthesize).toHaveBeenCalledTimes(2));
    answerFirstOption(1);
    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));

    expect(await screen.findByRole('heading', { name: /Lesen - Reading/i })).toBeInTheDocument();
    answerFirstOption(0);
    answerFirstOption(1);
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
    expect(repository.savedAttempts[0].answers.productive['speaking-1']).toContain(
      'Ich moechte einen Ausflug nach Berlin planen.'
    );
  }, 30000);

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

  it('shows an error and a retry button instead of a fake exam when generation fails', async () => {
    const failingProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({ objectiveQuestions: [], productiveTasks: [] }),
    };

    render(
      <MemoryRouter>
        <ExamSimulatorPage
          aiProvider={failingProvider}
          examRepository={createMemoryExamRepository()}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Generate and start exam/i }));

    expect(await screen.findByText(/Exam generation failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate and start exam/i })).toBeInTheDocument();
    expect(screen.queryByText(/Option [abc] aus dem Text/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Hoeren - Listening/i })).not.toBeInTheDocument();
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
