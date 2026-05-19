import React, { useEffect, useRef, useState } from 'react';
import type { AiProvider } from '../src/domain/ai/aiProvider';
import {
  createGeminiLiveConversationController,
  type GeminiLiveConversationController,
  type GeminiLiveConversationState,
  type PlayGeminiLiveAudio,
  type StartGeminiLiveAudioCapture,
} from '../src/application/geminiLiveConversation';
import type { ConversationRepository } from '../src/domain/conversation/conversationRepository';
import type { LiveConversationProvider } from '../src/domain/conversation/liveConversationProvider';
import type { SpeechProvider } from '../src/domain/speech/speechProvider';
import {
  generateGoetheExam,
  scoreGoetheExam,
} from '../src/domain/exam/examGenerator';
import type {
  ExamAnswerSet,
  ExamAttempt,
  ExamModule,
  ExamObjectiveQuestion,
  ExamProductiveTask,
  GoetheExam,
} from '../src/domain/exam/examTypes';
import type { ExamAttemptRepository } from '../src/domain/exam/examAttemptRepository';
import { browserConversationRepository } from '../src/infrastructure/browser/conversationStorage';
import { browserExamAttemptRepository } from '../src/infrastructure/browser/examAttemptStorage';
import { startBrowserPcmAudioCapture } from '../src/infrastructure/browser/audioRecorder';
import { playGeminiPcmAudio, resetGeminiPcmAudioStream } from '../src/infrastructure/browser/geminiAudioPlayback';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { CEFRLevel, ConversationMode } from '../types';
import { PageHeader, Card, Button, Badge, Notice, cn } from '../components/ui';

type ExamStatus = 'setup' | 'generating' | 'running' | 'results' | 'error';

interface ExamSimulatorPageProps {
  aiProvider?: AiProvider;
  speechProvider?: SpeechProvider;
  liveConversationProvider?: LiveConversationProvider;
  conversationRepository?: ConversationRepository;
  startGeminiLiveAudioCapture?: StartGeminiLiveAudioCapture;
  playGeminiLiveAudio?: PlayGeminiLiveAudio;
  playExamAudio?: (audio: ArrayBuffer, mimeType: string) => Promise<void>;
  examRepository?: ExamAttemptRepository;
  now?: () => string;
}

const LOCAL_LEARNER_ID = 'local-learner';
const LEVELS: CEFRLevel[] = [
  CEFRLevel.A1,
  CEFRLevel.A2,
  CEFRLevel.B1,
  CEFRLevel.B2,
  CEFRLevel.C1,
  CEFRLevel.C2,
];

const createEmptyAnswers = (): ExamAnswerSet => ({
  objective: {},
  productive: {},
});

export const ExamSimulatorPage: React.FC<ExamSimulatorPageProps> = ({
  aiProvider,
  speechProvider,
  liveConversationProvider,
  conversationRepository = browserConversationRepository,
  startGeminiLiveAudioCapture = startBrowserPcmAudioCapture,
  playGeminiLiveAudio = playGeminiPcmAudio,
  playExamAudio = playBrowserAudio,
  examRepository = browserExamAttemptRepository,
  now = () => new Date().toISOString(),
}) => {
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>(CEFRLevel.A1);
  const [status, setStatus] = useState<ExamStatus>('setup');
  const [exam, setExam] = useState<GoetheExam | null>(null);
  const [answers, setAnswers] = useState<ExamAnswerSet>(() => createEmptyAnswers());
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<ExamAttempt | null>(null);
  const [attemptHistory, setAttemptHistory] = useState<ExamAttempt[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oralState, setOralState] = useState<GeminiLiveConversationState>(() => createIdleGeminiLiveState());
  const [playedListeningQuestionIds, setPlayedListeningQuestionIds] = useState<Set<string>>(() => new Set());
  const [loadingListeningQuestionId, setLoadingListeningQuestionId] = useState<string | null>(null);
  const [listeningAudioError, setListeningAudioError] = useState<string | null>(null);
  const oralControllerRef = useRef<GeminiLiveConversationController | null>(null);
  const oralUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalProfile() {
      try {
        const profile = await browserProfileRepository.loadProfile();

        if (!cancelled) {
          setSelectedLevel(profile.currentLevel);
        }
      } catch (error) {
        console.error('Error loading local exam profile:', error);
      }
    }

    loadLocalProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const attempts = await examRepository.listAttempts(LOCAL_LEARNER_ID);

        if (!cancelled) {
          setAttemptHistory(attempts);
        }
      } catch (error) {
        console.error('Error loading local exam history:', error);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [examRepository]);

  useEffect(() => () => {
    oralUnsubscribeRef.current?.();
    void oralControllerRef.current?.end();
  }, []);

  const currentModule = exam?.modules[currentModuleIndex] ?? null;
  const moduleCount = exam?.modules.length ?? 0;
  const isLastModule = Boolean(exam && currentModuleIndex === exam.modules.length - 1);

  useEffect(() => {
    if (status !== 'running' || remainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds(value => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [status, remainingSeconds]);

  async function handleStartExam() {
    await stopOralExam();
    setStatus('generating');
    setErrorMessage(null);
    setLatestAttempt(null);
    setAnswers(createEmptyAnswers());
    setOralState(createIdleGeminiLiveState());
    setPlayedListeningQuestionIds(new Set());
    setLoadingListeningQuestionId(null);
    setListeningAudioError(null);

    try {
      const generatedExam = await generateGoetheExam({
        level: selectedLevel,
        aiProvider,
      });
      const firstModule = generatedExam.modules[0];

      setExam(generatedExam);
      setCurrentModuleIndex(0);
      setRemainingSeconds(firstModule?.durationMinutes ? firstModule.durationMinutes * 60 : 0);
      setStartedAt(now());
      setStatus('running');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not generate exam');
      setStatus('error');
    }
  }

  function handleObjectiveAnswer(question: ExamObjectiveQuestion, optionIndex: number) {
    setAnswers(current => ({
      ...current,
      objective: {
        ...current.objective,
        [question.id]: optionIndex,
      },
    }));
  }

  function handleProductiveAnswer(task: ExamProductiveTask, value: string) {
    setAnswers(current => ({
      ...current,
      productive: {
        ...current.productive,
        [task.id]: value,
      },
    }));
  }

  async function handlePlayListeningAudio(question: ExamObjectiveQuestion) {
    if (!speechProvider) {
      setListeningAudioError('Deepgram TTS is required for Hoeren audio. Configure Deepgram in Settings first.');
      return;
    }

    if (playedListeningQuestionIds.has(question.id)) {
      return;
    }

    setLoadingListeningQuestionId(question.id);
    setListeningAudioError(null);

    try {
      const audioText = getListeningAudioText(question);
      const result = await speechProvider.synthesize({
        feature: 'goethe-exam-listening',
        text: audioText,
        options: { language: 'de' },
      });

      await playExamAudio(result.audio, result.mimeType);
      setPlayedListeningQuestionIds(current => new Set(current).add(question.id));
    } catch (error) {
      setListeningAudioError(error instanceof Error ? error.message : 'Could not play Deepgram listening audio');
    } finally {
      setLoadingListeningQuestionId(null);
    }
  }

  async function handleStartOralExam(module: ExamModule) {
    if (!exam || !liveConversationProvider) {
      setErrorMessage('Enable Gemini Live in Settings to run the oral exam with a live examiner.');
      return;
    }

    await stopOralExam();

    const controller = createGeminiLiveConversationController({
      liveProvider: liveConversationProvider,
      conversationRepository,
      learnerId: LOCAL_LEARNER_ID,
      level: exam.level,
      motherLanguage: 'English',
      mode: ConversationMode.SPEAKING_ACTIVITY,
      topic: `Goethe ${exam.level} speaking exam`,
      description: module.instructions,
      liveInstruction: buildOralExamInstruction(exam, module),
      startAudioCapture: startGeminiLiveAudioCapture,
      playTutorAudio: playGeminiLiveAudio,
      resetTutorAudio: resetGeminiPcmAudioStream,
      now,
    });

    setErrorMessage(null);
    oralControllerRef.current = controller;
    oralUnsubscribeRef.current = controller.onStateChange(nextState => {
      setOralState(nextState);
      const spokenAnswer = nextState.turns
        .filter(turn => turn.speaker === 'learner')
        .map(turn => turn.text)
        .join('\n')
        .trim();
      const firstSpeakingTask = module.productiveTasks[0];

      if (firstSpeakingTask && spokenAnswer) {
        handleProductiveAnswer(firstSpeakingTask, spokenAnswer);
      }
      if (nextState.errorMessage) {
        setErrorMessage(nextState.errorMessage);
      }
    });

    await controller.start();
  }

  async function handleEndOralExam() {
    await stopOralExam();
  }

  async function stopOralExam() {
    const controller = oralControllerRef.current;
    oralControllerRef.current = null;
    oralUnsubscribeRef.current?.();
    oralUnsubscribeRef.current = null;

    if (controller) {
      await controller.end();
    }
  }

  function handleNextModule() {
    if (!exam || isLastModule) {
      return;
    }

    const nextIndex = currentModuleIndex + 1;
    const nextModule = exam.modules[nextIndex];
    if (currentModule?.id === 'speaking') {
      void stopOralExam();
    }
    setCurrentModuleIndex(nextIndex);
    setRemainingSeconds(nextModule.durationMinutes * 60);
  }

  async function handleSubmitExam() {
    if (!exam) {
      return;
    }

    await stopOralExam();
    const completedAt = now();
    const result = scoreGoetheExam(exam, answers);
    const attempt: ExamAttempt = {
      id: createExamAttemptId(),
      learnerId: LOCAL_LEARNER_ID,
      examId: exam.id,
      title: exam.title,
      level: exam.level,
      startedAt: startedAt ?? exam.generatedAt,
      completedAt,
      durationSeconds: Math.max(
        0,
        Math.round((Date.parse(completedAt) - Date.parse(startedAt ?? exam.generatedAt)) / 1000)
      ),
      answers,
      result,
    };

    await examRepository.saveAttempt(attempt);
    const attempts = await examRepository.listAttempts(LOCAL_LEARNER_ID);
    setLatestAttempt(attempt);
    setAttemptHistory(attempts);
    setStatus('results');
  }

  function resetExam() {
    void stopOralExam();
    setStatus('setup');
    setExam(null);
    setAnswers(createEmptyAnswers());
    setCurrentModuleIndex(0);
    setRemainingSeconds(0);
    setStartedAt(null);
    setLatestAttempt(null);
    setErrorMessage(null);
    setOralState(createIdleGeminiLiveState());
    setPlayedListeningQuestionIds(new Set());
    setLoadingListeningQuestionId(null);
    setListeningAudioError(null);
  }

  return (
    <main aria-label="Exam workspace">
      <PageHeader
        title="Goethe Exam Simulator"
        subtitle="Generate a timed exam, complete every module, and save the final result locally."
        actions={
          <div
            className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2"
            aria-label="Selected exam level"
          >
            <div className="flex flex-col leading-tight">
              <strong className="text-[14px] font-bold text-text">
                {exam?.level ?? selectedLevel}
              </strong>
              <span className="text-[12px] text-text-muted">
                {exam ? `${exam.totalMinutes} minutes total` : 'Real timed simulator'}
              </span>
            </div>
            <Badge tone="brand" aria-label="60 percent pass target">
              60%
            </Badge>
          </div>
        }
      />

      <Card className="mb-5" aria-labelledby="exam-level-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="exam-level-heading" className="text-[16px] font-semibold text-text">
            Exam level
          </h2>
          <span className="text-[12px] text-text-muted">Official-style 60% module target</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              aria-pressed={selectedLevel === level}
              disabled={status === 'running' || status === 'generating'}
              className={cn(
                'rounded-control border px-4 py-2 text-[14px] font-medium transition-colors disabled:opacity-50',
                selectedLevel === level
                  ? 'border-brand bg-brand text-text'
                  : 'border-border bg-surface text-text-muted hover:border-brand'
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-labelledby="exam-runner-heading">
          {status === 'setup' || status === 'error' ? (
            <ExamSetup
              aiReady={Boolean(aiProvider)}
              errorMessage={errorMessage}
              onStart={() => void handleStartExam()}
            />
          ) : null}

          {status === 'generating' ? (
            <div
              className="flex flex-col items-center gap-3 py-12 text-center"
              role="status"
              aria-live="polite"
            >
              <div
                className="h-10 w-10 animate-spin rounded-pill border-2 border-border border-t-brand"
                role="progressbar"
                aria-label="Generating exam"
              >
                <span />
              </div>
              <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
                Generating
              </span>
              <h2 id="exam-runner-heading" className="text-[18px] font-bold text-text">
                Creating your {selectedLevel} exam
              </h2>
              <p className="max-w-md text-[13px] text-text-muted">
                Creating listening, reading, writing, and speaking tasks from the public exam structure.
              </p>
              <div className="flex gap-2 text-[12px] text-text-muted" aria-hidden="true">
                <span>Structure</span>
                <span>Tasks</span>
                <span>Scoring</span>
                <span>Timer</span>
              </div>
            </div>
          ) : null}

          {status === 'running' && exam && currentModule ? (
            <ExamRunner
              exam={exam}
              module={currentModule}
              moduleIndex={currentModuleIndex}
              moduleCount={moduleCount}
              answers={answers}
              remainingSeconds={remainingSeconds}
              isLastModule={isLastModule}
              onObjectiveAnswer={handleObjectiveAnswer}
              onProductiveAnswer={handleProductiveAnswer}
              onPlayListeningAudio={handlePlayListeningAudio}
              playedListeningQuestionIds={playedListeningQuestionIds}
              loadingListeningQuestionId={loadingListeningQuestionId}
              listeningAudioReady={Boolean(speechProvider)}
              listeningAudioError={listeningAudioError}
              onNext={handleNextModule}
              onSubmit={() => void handleSubmitExam()}
              oralState={oralState}
              oralExamReady={Boolean(liveConversationProvider)}
              onStartOralExam={handleStartOralExam}
              onEndOralExam={handleEndOralExam}
            />
          ) : null}

          {status === 'results' && latestAttempt ? (
            <ExamResultView attempt={latestAttempt} onRestart={resetExam} />
          ) : null}
        </Card>

        <Card aria-label="Exam history">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-text">Exam history</h2>
            <Badge>{attemptHistory.length} attempts</Badge>
          </div>
          {attemptHistory.length === 0 ? (
            <p className="text-[13px] text-text-muted">
              Completed exam attempts and results will appear here.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {attemptHistory.map(attempt => (
                <article
                  key={attempt.id}
                  className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <strong className="block text-[13px] font-semibold text-text">
                      {attempt.level} simulated exam
                    </strong>
                    <span className="text-[12px] text-text-muted">
                      {formatDate(attempt.completedAt)}
                    </span>
                  </div>
                  <b
                    className={cn(
                      'text-[15px] font-bold',
                      attempt.result.passed ? 'text-success' : 'text-danger'
                    )}
                  >
                    {attempt.result.percentage}%
                  </b>
                  <small className="text-[12px] text-text-muted">
                    {attempt.result.passed ? 'Passed' : 'Needs work'}
                  </small>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};

const ExamSetup: React.FC<{
  aiReady: boolean;
  errorMessage: string | null;
  onStart: () => void;
}> = ({ aiReady, errorMessage, onStart }) => (
  <div className="flex flex-col items-start gap-4 py-6">
    <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
      Real test mode
    </span>
    <h2 id="exam-runner-heading" className="text-[20px] font-bold text-text">
      Generate a full timed exam
    </h2>
    <p className="text-[14px] text-text-muted">
      The simulator creates an original Goethe-style exam with Hoeren, Lesen, Schreiben, and Sprechen
      modules, then scores the attempt at the end.
    </p>
    <div className="w-full rounded-control bg-surface-soft p-4">
      <strong className="block text-[14px] font-semibold text-text">
        {aiReady ? 'AI generation enabled' : 'AI provider required'}
      </strong>
      <span className="text-[13px] text-text-muted">
        {aiReady
          ? 'OpenRouter generates fresh, original exam content per module. If a module cannot be generated you will see an error and can retry.'
          : 'Open Settings and enable an AI provider. The exam only runs with AI-generated content — no offline practice exam is shown.'}
      </span>
    </div>
    {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
    <Button onClick={onStart} icon={<i className="fa-solid fa-play" aria-hidden="true" />}>
      Generate and start exam
    </Button>
  </div>
);

const ExamRunner: React.FC<{
  exam: GoetheExam;
  module: ExamModule;
  moduleIndex: number;
  moduleCount: number;
  answers: ExamAnswerSet;
  remainingSeconds: number;
  isLastModule: boolean;
  onObjectiveAnswer: (question: ExamObjectiveQuestion, optionIndex: number) => void;
  onProductiveAnswer: (task: ExamProductiveTask, value: string) => void;
  onPlayListeningAudio: (question: ExamObjectiveQuestion) => void;
  playedListeningQuestionIds: Set<string>;
  loadingListeningQuestionId: string | null;
  listeningAudioReady: boolean;
  listeningAudioError: string | null;
  onNext: () => void;
  onSubmit: () => void;
  oralState: GeminiLiveConversationState;
  oralExamReady: boolean;
  onStartOralExam: (module: ExamModule) => void;
  onEndOralExam: () => void;
}> = ({
  exam,
  module,
  moduleIndex,
  moduleCount,
  answers,
  remainingSeconds,
  isLastModule,
  onObjectiveAnswer,
  onProductiveAnswer,
  onPlayListeningAudio,
  playedListeningQuestionIds,
  loadingListeningQuestionId,
  listeningAudioReady,
  listeningAudioError,
  onNext,
  onSubmit,
  oralState,
  oralExamReady,
  onStartOralExam,
  onEndOralExam,
}) => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between">
      <h2 id="exam-runner-heading" className="text-[18px] font-bold text-text">
        {module.germanLabel} - {module.englishLabel}
      </h2>
      <Badge>
        Module {moduleIndex + 1} / {moduleCount}
      </Badge>
    </div>

    <div className="flex flex-wrap items-center gap-4">
      <div
        className="rounded-control bg-text px-4 py-2 text-surface"
        aria-live="polite"
      >
        <strong className="text-[20px] font-bold">{formatTime(remainingSeconds)}</strong>
        <span className="ml-2 text-[12px] opacity-80">
          {remainingSeconds === 0 ? 'Time is up' : 'Time remaining'}
        </span>
      </div>
      <div>
        <span className="block text-[12px] font-medium uppercase tracking-wide text-text-muted">
          Pass target
        </span>
        <strong className="text-[14px] text-text">{exam.passThreshold}% per module</strong>
      </div>
    </div>

    <div
      className="flex flex-col gap-3 rounded-control border border-border bg-surface-soft p-4"
      aria-label="Exam template profile"
    >
      <div>
        <span className="block text-[12px] font-medium uppercase tracking-wide text-text-muted">
          Public template profile
        </span>
        <strong className="text-[14px] text-text">{exam.templateName}</strong>
        <small className="block text-[12px] text-text-muted">
          {module.germanLabel} follows {module.templateParts.length} real model-test parts.
        </small>
      </div>
      <ul className="flex flex-col gap-1 text-[13px] text-text">
        {module.templateParts.map(part => (
          <li key={part.id}>
            <b>{part.title}:</b> {part.taskFamily}
          </li>
        ))}
      </ul>
    </div>

    <p className="text-[14px] text-text-muted">{module.instructions}</p>

    {module.id === 'speaking' ? (
      <div
        className="flex flex-col gap-3 rounded-control border border-success-soft bg-success-soft/40 p-4"
        aria-label="Gemini Live oral exam controls"
      >
        <div>
          <span className="block text-[12px] font-medium uppercase tracking-wide text-text-muted">
            Gemini Live oral examiner
          </span>
          <strong className="text-[14px] text-text">
            {formatGeminiLiveStatus(oralState.status)}
          </strong>
          <small className="block text-[12px] text-text-muted">
            The live examiner runs the speaking tasks aloud. Learner transcript is saved into the exam
            attempt.
          </small>
        </div>
        <div className="flex items-center gap-2">
          {oralState.status === 'idle' ||
          oralState.status === 'ended' ||
          oralState.status === 'error' ? (
            <Button
              variant="secondary"
              onClick={() => onStartOralExam(module)}
              disabled={!oralExamReady}
            >
              Start oral exam
            </Button>
          ) : (
            <Button variant="secondary" onClick={onEndOralExam}>
              End oral exam
            </Button>
          )}
          <span className="text-[13px] text-text-muted">
            {oralExamReady ? formatGeminiLiveStatus(oralState.status) : 'Gemini Live required'}
          </span>
        </div>
        {oralState.latestTutorText ? (
          <p className="rounded-control bg-brand-soft px-3 py-2 text-[13px] text-text">
            {oralState.latestTutorText}
          </p>
        ) : null}
        {oralState.latestLearnerText ? (
          <p className="rounded-control bg-surface px-3 py-2 text-[13px] text-text">
            {oralState.latestLearnerText}
          </p>
        ) : null}
      </div>
    ) : null}

    <div className="flex flex-col gap-4">
      {module.objectiveQuestions.map((question, index) => (
        <fieldset
          key={question.id}
          className="rounded-control border border-border bg-surface p-4"
        >
          <legend className="px-1 text-[14px] font-semibold text-text">
            {index + 1}. {question.prompt}
          </legend>
          {module.id === 'listening' ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-control bg-info-soft p-3">
              <div>
                <span className="block text-[12px] font-medium uppercase tracking-wide text-text-muted">
                  Deepgram TTS audio
                </span>
                <strong className="text-[13px] text-text">
                  {playedListeningQuestionIds.has(question.id)
                    ? 'Audio played'
                    : 'Listen before answering'}
                </strong>
                <small className="block text-[12px] text-text-muted">
                  The transcript is hidden in Hoeren mode.
                </small>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPlayListeningAudio(question)}
                disabled={
                  !listeningAudioReady ||
                  loadingListeningQuestionId !== null ||
                  playedListeningQuestionIds.has(question.id)
                }
                aria-label={`Play listening audio for question ${index + 1}`}
                icon={
                  <i
                    className={`fa-solid ${
                      loadingListeningQuestionId === question.id
                        ? 'fa-spinner fa-spin'
                        : 'fa-circle-play'
                    }`}
                    aria-hidden="true"
                  />
                }
              >
                {loadingListeningQuestionId === question.id
                  ? 'Loading audio'
                  : playedListeningQuestionIds.has(question.id)
                    ? 'Audio played'
                    : 'Play audio'}
              </Button>
            </div>
          ) : question.passage ? (
            <p className="mb-3 rounded-control bg-surface-soft p-3 text-[14px] text-text">
              {question.passage}
            </p>
          ) : null}
          {module.id === 'listening' && listeningAudioError ? (
            <div className="mb-3">
              <Notice tone="error">{listeningAudioError}</Notice>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            {question.options.map((option, optionIndex) => (
              <label
                key={`${question.id}-${option}`}
                className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-[14px] text-text"
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answers.objective[question.id] === optionIndex}
                  disabled={
                    module.id === 'listening' && !playedListeningQuestionIds.has(question.id)
                  }
                  onChange={() => onObjectiveAnswer(question, optionIndex)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {module.productiveTasks.map(task => (
        <label key={task.id} className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-text">{task.prompt}</span>
          <textarea
            value={answers.productive[task.id] ?? ''}
            onChange={event => onProductiveAnswer(task, event.target.value)}
            rows={7}
            placeholder={
              module.id === 'speaking'
                ? 'Write your spoken answer or transcript here...'
                : 'Write your exam answer here...'
            }
            className="w-full rounded-control border border-border bg-surface p-3 text-[14px] text-text outline-none focus:border-brand"
          />
          <small className="text-[12px] text-text-muted">
            Minimum guide: {task.minWords ?? 60} words. Rubric: {task.rubric.join(', ')}.
          </small>
        </label>
      ))}
    </div>

    <div>
      {isLastModule ? (
        <Button onClick={onSubmit}>Submit exam and show result</Button>
      ) : (
        <Button onClick={onNext}>Next module</Button>
      )}
    </div>
  </div>
);

const ExamResultView: React.FC<{
  attempt: ExamAttempt;
  onRestart: () => void;
}> = ({ attempt, onRestart }) => (
  <div className="flex flex-col gap-5">
    <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
      Exam result
    </span>
    <h2 className="text-[22px] font-bold text-text">
      {attempt.result.passed ? 'Passed' : 'Needs more work'}
    </h2>
    <div className="rounded-card bg-text px-6 py-5 text-surface">
      <strong className="text-[40px] font-bold">{attempt.result.percentage}%</strong>
      <span className="ml-3 text-[14px] opacity-80">
        {attempt.result.totalEarnedPoints} / {attempt.result.totalPossiblePoints} points
      </span>
    </div>
    <p className="text-[14px] text-text-muted">{attempt.result.summary}</p>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {attempt.result.moduleResults.map(result => (
        <article key={result.moduleId} className="rounded-control border border-border bg-surface p-3">
          <span className="block text-[12px] text-text-muted">{result.germanLabel}</span>
          <strong className="text-[18px] font-bold text-text">{result.percentage}%</strong>
          <small className="block text-[11px] text-text-muted">
            {result.earnedPoints} / {result.possiblePoints} certificate points - {result.rating}
          </small>
        </article>
      ))}
    </div>

    <div className="flex flex-col gap-4" aria-label="Detailed exam score sheet">
      {attempt.result.moduleResults.map(moduleResult => (
        <section
          key={moduleResult.moduleId}
          className="rounded-control border border-border bg-surface p-4"
        >
          <header className="mb-3 flex items-center justify-between">
            <div>
              <span className="block text-[12px] font-medium uppercase tracking-wide text-text-muted">
                {moduleResult.germanLabel}
              </span>
              <h3 className="text-[15px] font-semibold text-text">{moduleResult.englishLabel}</h3>
            </div>
            <strong className="text-[15px] text-text">
              {moduleResult.earnedPoints} / {moduleResult.possiblePoints}
            </strong>
          </header>
          <div className="flex flex-col gap-3">
            {moduleResult.partResults.map(part => (
              <article key={part.partId} className="border-t border-border pt-2 text-[13px]">
                <div>
                  <b className="text-text">{part.title}</b>
                  <span className="ml-2 text-text-muted">
                    {formatPoints(part.earnedPoints)} / {formatPoints(part.possiblePoints)} raw points
                    {part.lostPoints > 0 ? ` - ${formatPoints(part.lostPoints)} deducted` : ''}
                  </span>
                </div>
                <small className="block text-[12px] text-text-muted">{part.scoringNote}</small>
                {part.criteria?.length ? (
                  <ul className="mt-1 list-inside list-disc text-[12px] text-text-muted">
                    {part.criteria.map(criterion => (
                      <li key={criterion.criterionId}>
                        {criterion.label}: band {criterion.band},{' '}
                        {formatPoints(criterion.earnedPoints)} / {formatPoints(criterion.possiblePoints)}
                        {criterion.lostPoints > 0
                          ? ` (${formatPoints(criterion.lostPoints)} deducted)`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>

    <Button variant="secondary" onClick={onRestart}>
      Start another exam
    </Button>
  </div>
);

function createIdleGeminiLiveState(): GeminiLiveConversationState {
  return {
    status: 'idle',
    turns: [],
    latestLearnerText: '',
    latestTutorText: '',
    errorMessage: null,
  };
}

function formatGeminiLiveStatus(status: GeminiLiveConversationState['status']): string {
  const labels: Record<GeminiLiveConversationState['status'], string> = {
    idle: 'Ready',
    connecting: 'Connecting',
    listening: 'Listening',
    speaking: 'Speaking',
    ending: 'Saving',
    ended: 'Saved',
    error: 'Needs attention',
  };

  return labels[status];
}

function buildOralExamInstruction(exam: GoetheExam, module: ExamModule): string {
  return [
    `You are a Goethe oral examiner in a ${exam.level} German speaking exam simulator.`,
    'Conduct only the speaking module. Do not switch to tutoring mode.',
    'Follow the public model-test task sequence below exactly, using original prompt wording and natural examiner follow-ups.',
    ...module.templateParts
      .filter(part => part.id !== 'pronunciation')
      .map(part => `${part.title}: ${part.taskFamily}. ${part.promptGuidance}`),
    'Speak German at the exam level. Keep examiner turns short and clear.',
    'Ask the learner to answer aloud. After each task, move to the next task.',
    'Do not reveal a score during the oral exam. The app will calculate the result after submission.',
  ].join('\n');
}

function getListeningAudioText(question: ExamObjectiveQuestion): string {
  const audioScript = question.passage?.trim();

  if (!audioScript) {
    throw new Error('This Hoeren question does not have a hidden audio script.');
  }

  return audioScript;
}

async function playBrowserAudio(audio: ArrayBuffer, mimeType: string): Promise<void> {
  const playbackUrl = URL.createObjectURL(new Blob([audio], { type: mimeType }));

  try {
    await playAudioUrl(playbackUrl);
  } finally {
    releaseObjectUrl(playbackUrl);
  }
}

function playAudioUrl(url: string): Promise<void> {
  const audio = new Audio(url);

  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    const playback = audio.play();

    if (playback) {
      playback.catch(reject);
    }
  });
}

function releaseObjectUrl(url: string): void {
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function createExamAttemptId(): string {
  return `exam-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
