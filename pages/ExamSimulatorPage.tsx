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
import { playGeminiPcmAudio } from '../src/infrastructure/browser/geminiAudioPlayback';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { CEFRLevel, ConversationMode } from '../types';

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

    const audioText = getListeningAudioText(question);
    setLoadingListeningQuestionId(question.id);
    setListeningAudioError(null);

    try {
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
    <main className="db-dashboard db-exam-workspace" aria-label="Exam workspace">
      <header className="db-dashboard-header">
        <div>
          <span className="db-dashboard-kicker">Pruefung</span>
          <h1>Goethe Exam Simulator</h1>
          <p>Generate a timed exam, complete every module, and save the final result locally.</p>
        </div>
        <div className="db-level-meter" aria-label="Selected exam level">
          <div>
            <strong>{exam?.level ?? selectedLevel}</strong>
            <span>{exam ? `${exam.totalMinutes} minutes total` : 'Real timed simulator'}</span>
          </div>
          <div className="db-ring" aria-label="60 percent pass target">60%</div>
        </div>
      </header>

      <section className="db-panel db-exam-levels" aria-labelledby="exam-level-heading">
        <div className="db-panel-heading">
          <h2 id="exam-level-heading">Exam level</h2>
          <span>Official-style 60% module target</span>
        </div>
        <div className="db-level-button-grid">
          {LEVELS.map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              aria-pressed={selectedLevel === level}
              className={selectedLevel === level ? 'is-selected' : ''}
              disabled={status === 'running' || status === 'generating'}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="db-dashboard-grid db-exam-grid">
        <section className="db-panel db-exam-runner-panel" aria-labelledby="exam-runner-heading">
          {status === 'setup' || status === 'error' ? (
            <ExamSetup
              aiReady={Boolean(aiProvider)}
              errorMessage={errorMessage}
              onStart={() => void handleStartExam()}
            />
          ) : null}

          {status === 'generating' ? (
            <div className="db-exam-empty-state" role="status">
              <span className="db-section-label">Generating</span>
              <h2 id="exam-runner-heading">Creating your {selectedLevel} exam</h2>
              <p>
                The app is building original Goethe-style tasks from the public exam structure.
              </p>
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
        </section>

        <aside className="db-panel db-exam-history-panel" aria-label="Exam history">
          <div className="db-panel-heading">
            <h2>Exam history</h2>
            <span>{attemptHistory.length} attempts</span>
          </div>
          {attemptHistory.length === 0 ? (
            <p className="db-muted-copy">Completed exam attempts and results will appear here.</p>
          ) : (
            <div className="db-exam-history-list">
              {attemptHistory.map(attempt => (
                <article key={attempt.id}>
                  <div>
                    <strong>{attempt.level} simulated exam</strong>
                    <span>{formatDate(attempt.completedAt)}</span>
                  </div>
                  <b className={attempt.result.passed ? 'is-pass' : 'is-fail'}>
                    {attempt.result.percentage}%
                  </b>
                  <small>{attempt.result.passed ? 'Passed' : 'Needs work'}</small>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
};

const ExamSetup: React.FC<{
  aiReady: boolean;
  errorMessage: string | null;
  onStart: () => void;
}> = ({ aiReady, errorMessage, onStart }) => (
  <div className="db-exam-empty-state">
    <span className="db-section-label">Real test mode</span>
    <h2 id="exam-runner-heading">Generate a full timed exam</h2>
    <p>
      The simulator creates an original Goethe-style exam with Hoeren, Lesen, Schreiben,
      and Sprechen modules, then scores the attempt at the end.
    </p>
    <div className="db-exam-source-box">
      <strong>{aiReady ? 'AI generation enabled' : 'Local fallback ready'}</strong>
      <span>
        {aiReady
          ? 'OpenRouter/Gemini will generate fresh exam tasks from the official-style structure.'
          : 'No AI provider is configured, so a local original model exam will be used.'}
      </span>
    </div>
    {errorMessage ? <p className="db-conversation-message db-conversation-message-error">{errorMessage}</p> : null}
    <button type="button" className="db-primary-button" onClick={onStart}>
      <i className="fa-solid fa-play" aria-hidden="true" />
      Generate and start exam
    </button>
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
  <>
    <div className="db-panel-heading">
      <h2 id="exam-runner-heading">
        {module.germanLabel} - {module.englishLabel}
      </h2>
      <span>
        Module {moduleIndex + 1} / {moduleCount}
      </span>
    </div>

    <div className="db-exam-runner-meta">
      <div className="db-exam-timer" aria-live="polite">
        <strong>{formatTime(remainingSeconds)}</strong>
        <span>{remainingSeconds === 0 ? 'Time is up' : 'Time remaining'}</span>
      </div>
      <div>
        <span className="db-section-label">Pass target</span>
        <strong>{exam.passThreshold}% per module</strong>
      </div>
    </div>

    <div className="db-exam-template-box" aria-label="Exam template profile">
      <div>
        <span className="db-section-label">Public template profile</span>
        <strong>{exam.templateName}</strong>
        <small>
          {module.germanLabel} follows {module.templateParts.length} real model-test parts.
        </small>
      </div>
      <ul>
        {module.templateParts.map(part => (
          <li key={part.id}>
            <b>{part.title}:</b> {part.taskFamily}
          </li>
        ))}
      </ul>
    </div>

    <p className="db-exam-instructions">{module.instructions}</p>

    {module.id === 'speaking' ? (
      <div className="db-exam-oral-box" aria-label="Gemini Live oral exam controls">
        <div>
          <span className="db-section-label">Gemini Live oral examiner</span>
          <strong>{formatGeminiLiveStatus(oralState.status)}</strong>
          <small>
            The live examiner runs the speaking tasks aloud. Learner transcript is saved into the exam attempt.
          </small>
        </div>
        <div className="db-exam-oral-actions">
          {oralState.status === 'idle' || oralState.status === 'ended' || oralState.status === 'error' ? (
            <button
              type="button"
              className="db-secondary-button"
              onClick={() => onStartOralExam(module)}
              disabled={!oralExamReady}
            >
              Start oral exam
            </button>
          ) : (
            <button
              type="button"
              className="db-secondary-button"
              onClick={onEndOralExam}
            >
              End oral exam
            </button>
          )}
          <span>{oralExamReady ? formatGeminiLiveStatus(oralState.status) : 'Gemini Live required'}</span>
        </div>
        {oralState.latestTutorText ? <p>{oralState.latestTutorText}</p> : null}
        {oralState.latestLearnerText ? <p>{oralState.latestLearnerText}</p> : null}
      </div>
    ) : null}

    <div className="db-exam-question-list">
      {module.objectiveQuestions.map((question, index) => (
        <fieldset key={question.id} className="db-exam-question">
          <legend>
            {index + 1}. {question.prompt}
          </legend>
          {module.id === 'listening' ? (
            <div className="db-exam-listening-audio">
              <div>
                <span className="db-section-label">Deepgram TTS audio</span>
                <strong>
                  {playedListeningQuestionIds.has(question.id) ? 'Audio played' : 'Listen before answering'}
                </strong>
                <small>The transcript is hidden in Hoeren mode.</small>
              </div>
              <button
                type="button"
                className="db-secondary-button"
                onClick={() => onPlayListeningAudio(question)}
                disabled={!listeningAudioReady || loadingListeningQuestionId !== null}
                aria-label={`Play listening audio for question ${index + 1}`}
              >
                <i
                  className={`fa-solid ${
                    loadingListeningQuestionId === question.id ? 'fa-spinner fa-spin' : 'fa-circle-play'
                  }`}
                  aria-hidden="true"
                />
                {loadingListeningQuestionId === question.id
                  ? 'Loading audio'
                  : playedListeningQuestionIds.has(question.id)
                    ? 'Play again'
                    : 'Play audio'}
              </button>
            </div>
          ) : question.passage ? <p>{question.passage}</p> : null}
          {module.id === 'listening' && listeningAudioError ? (
            <p className="db-conversation-message db-conversation-message-error">{listeningAudioError}</p>
          ) : null}
          <div className="db-exam-options">
            {question.options.map((option, optionIndex) => (
              <label key={`${question.id}-${option}`}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answers.objective[question.id] === optionIndex}
                  disabled={module.id === 'listening' && !playedListeningQuestionIds.has(question.id)}
                  onChange={() => onObjectiveAnswer(question, optionIndex)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {module.productiveTasks.map(task => (
        <label key={task.id} className="db-exam-productive-task">
          <span>{task.prompt}</span>
          <textarea
            value={answers.productive[task.id] ?? ''}
            onChange={event => onProductiveAnswer(task, event.target.value)}
            rows={7}
            placeholder={module.id === 'speaking' ? 'Write your spoken answer or transcript here...' : 'Write your exam answer here...'}
          />
          <small>
            Minimum guide: {task.minWords ?? 60} words. Rubric: {task.rubric.join(', ')}.
          </small>
        </label>
      ))}
    </div>

    <div className="db-exam-actions">
      {isLastModule ? (
        <button type="button" className="db-primary-button" onClick={onSubmit}>
          Submit exam and show result
        </button>
      ) : (
        <button type="button" className="db-primary-button" onClick={onNext}>
          Next module
        </button>
      )}
    </div>
  </>
);

const ExamResultView: React.FC<{
  attempt: ExamAttempt;
  onRestart: () => void;
}> = ({ attempt, onRestart }) => (
  <div className="db-exam-result-view">
    <span className="db-section-label">Exam result</span>
    <h2>{attempt.result.passed ? 'Passed' : 'Needs more work'}</h2>
    <div className="db-exam-score-hero">
      <strong>{attempt.result.percentage}%</strong>
      <span>
        {attempt.result.totalEarnedPoints} / {attempt.result.totalPossiblePoints} points
      </span>
    </div>
    <p>{attempt.result.summary}</p>

    <div className="db-exam-result-grid">
      {attempt.result.moduleResults.map(result => (
        <article key={result.moduleId}>
          <span>{result.germanLabel}</span>
          <strong>{result.percentage}%</strong>
          <small>{result.earnedPoints} / {result.possiblePoints} certificate points - {result.rating}</small>
        </article>
      ))}
    </div>

    <div className="db-exam-score-sheet" aria-label="Detailed exam score sheet">
      {attempt.result.moduleResults.map(moduleResult => (
        <section key={moduleResult.moduleId}>
          <header>
            <div>
              <span className="db-section-label">{moduleResult.germanLabel}</span>
              <h3>{moduleResult.englishLabel}</h3>
            </div>
            <strong>
              {moduleResult.earnedPoints} / {moduleResult.possiblePoints}
            </strong>
          </header>
          <div className="db-exam-part-score-list">
            {moduleResult.partResults.map(part => (
              <article key={part.partId}>
                <div>
                  <b>{part.title}</b>
                  <span>
                    {formatPoints(part.earnedPoints)} / {formatPoints(part.possiblePoints)} raw points
                    {part.lostPoints > 0 ? ` - ${formatPoints(part.lostPoints)} deducted` : ''}
                  </span>
                </div>
                <small>{part.scoringNote}</small>
                {part.criteria?.length ? (
                  <ul>
                    {part.criteria.map(criterion => (
                      <li key={criterion.criterionId}>
                        {criterion.label}: band {criterion.band}, {formatPoints(criterion.earnedPoints)} / {formatPoints(criterion.possiblePoints)}
                        {criterion.lostPoints > 0 ? ` (${formatPoints(criterion.lostPoints)} deducted)` : ''}
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

    <button type="button" className="db-secondary-button" onClick={onRestart}>
      Start another exam
    </button>
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
  return (question.passage ?? question.prompt).trim();
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
