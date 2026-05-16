import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { generateLocalConversationFeedback } from '../src/application/conversationFeedback';
import {
  createHandsFreeConversationController,
  type HandsFreeConversationController,
  type HandsFreeConversationState,
  type PlayTutorAudio,
  type StartConversationAudioStream,
} from '../src/application/handsFreeConversation';
import { runTurnBasedConversationTurn } from '../src/application/turnBasedConversation';
import type { AiProvider } from '../src/domain/ai/aiProvider';
import type { StreamingAiProvider } from '../src/domain/ai/streamingAiProvider';
import type {
  ConversationFeedbackRecord,
  ConversationRepository,
} from '../src/domain/conversation/conversationRepository';
import type { SpeechProvider } from '../src/domain/speech/speechProvider';
import type { StreamingSpeechProvider } from '../src/domain/speech/streamingSpeechProvider';
import type { TranscriptTurn } from '../src/domain/speech/transcriptTypes';
import {
  browserConversationRepository,
} from '../src/infrastructure/browser/conversationStorage';
import {
  startBrowserAudioRecording,
  startBrowserStreamingAudioCapture,
  type ActiveAudioRecording,
} from '../src/infrastructure/browser/audioRecorder';
import { MOTHER_LANGUAGE_OPTIONS } from '../src/domain/profile/profileRepository';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { CEFRLevel, ConversationMode } from '../types';

type ConversationStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'recording'
  | 'processing'
  | 'ending'
  | 'ended'
  | 'error';

type ConversationAudioRecorder = () => Promise<ActiveAudioRecording>;

interface SpeakingActivityPageProps {
  aiProvider?: AiProvider;
  speechProvider?: SpeechProvider;
  streamingAiProvider?: StreamingAiProvider;
  streamingSpeechProvider?: StreamingSpeechProvider;
  conversationRepository?: ConversationRepository;
  audioRecorder?: ConversationAudioRecorder;
  startLiveAudioStream?: StartConversationAudioStream;
  playLiveTutorAudio?: PlayTutorAudio;
}

interface ConversationModeOption {
  mode: ConversationMode;
  label: string;
  detail: string;
  icon: string;
}

const LOCAL_LEARNER_ID = 'local-learner';

const MODE_OPTIONS: ConversationModeOption[] = [
  {
    mode: ConversationMode.FREE_CONVERSATION,
    label: 'Free talk',
    detail: 'Short everyday turns with a natural follow-up.',
    icon: 'fa-comments',
  },
  {
    mode: ConversationMode.SPEAKING_ACTIVITY,
    label: 'Roleplay',
    detail: 'Practice a task, scene, or plan item.',
    icon: 'fa-user-group',
  },
  {
    mode: ConversationMode.GRAMMAR_DRILL,
    label: 'Grammar repair',
    detail: 'The tutor focuses each reply on one useful correction.',
    icon: 'fa-wrench',
  },
  {
    mode: ConversationMode.VOCABULARY_BUILDER,
    label: 'Vocabulary activation',
    detail: 'Use new words in complete spoken answers.',
    icon: 'fa-layer-group',
  },
  {
    mode: ConversationMode.READING_PRACTICE,
    label: 'Reading aloud',
    detail: 'Read a phrase, then answer a follow-up question.',
    icon: 'fa-book-open',
  },
];

const SpeakingActivityPage: React.FC<SpeakingActivityPageProps> = ({
  aiProvider,
  speechProvider,
  streamingAiProvider,
  streamingSpeechProvider,
  conversationRepository = browserConversationRepository,
  audioRecorder = startBrowserAudioRecording,
  startLiveAudioStream = startBrowserStreamingAudioCapture,
  playLiveTutorAudio = playAudioBlob,
}) => {
  const [searchParams] = useSearchParams();
  const activityTopic = searchParams.get('topic')?.trim() ?? '';
  const activityDescription = searchParams.get('description')?.trim() ?? '';
  const isPlanActivity = activityTopic.length > 0 || activityDescription.length > 0;
  const routeLevel = searchParams.get('level') as CEFRLevel | null;
  const initialMode = isPlanActivity ? ConversationMode.SPEAKING_ACTIVITY : ConversationMode.FREE_CONVERSATION;

  const [selectedMode, setSelectedMode] = useState<ConversationMode>(initialMode);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ConversationFeedbackRecord | null>(null);
  const [liveState, setLiveState] = useState<HandsFreeConversationState>({
    status: 'idle',
    turns: [],
    interimTranscript: '',
    currentTutorText: '',
    errorMessage: null,
  });
  const [profileContext, setProfileContext] = useState({
    level: CEFRLevel.A2,
    motherLanguage: 'English',
    firstName: 'Learner',
  });
  const activeRecordingRef = useRef<ActiveAudioRecording | null>(null);
  const liveControllerRef = useRef<HandsFreeConversationController | null>(null);
  const liveUnsubscribeRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const providersReady = Boolean(aiProvider && speechProvider);
  const streamingReady = Boolean(streamingAiProvider && streamingSpeechProvider);
  const liveSessionActive = !['idle', 'ended', 'error'].includes(liveState.status);
  const learnerId = LOCAL_LEARNER_ID;
  const level = routeLevel ?? profileContext.level;
  const motherLanguage = profileContext.motherLanguage;
  const firstName = profileContext.firstName;

  const selectedModeOption = useMemo(
    () => MODE_OPTIONS.find(option => option.mode === selectedMode) ?? MODE_OPTIONS[0],
    [selectedMode]
  );

  useEffect(() => {
    if (isPlanActivity) {
      setSelectedMode(ConversationMode.SPEAKING_ACTIVITY);
    }
  }, [isPlanActivity]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalProfile() {
      try {
        const profile = await browserProfileRepository.loadProfile();
        const motherLanguageOption = MOTHER_LANGUAGE_OPTIONS.find(
          option => option.value === profile.motherLanguage
        );

        if (!cancelled) {
          setProfileContext({
            level: profile.currentLevel,
            motherLanguage: motherLanguageOption?.label ?? 'English',
            firstName: 'Learner',
          });
        }
      } catch (error) {
        console.error('Error loading local conversation profile:', error);
      }
    }

    loadLocalProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (transcriptRef.current && typeof transcriptRef.current.scrollTo === 'function') {
      transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight });
    }
  }, [turns]);

  useEffect(() => {
    return () => {
      activeRecordingRef.current?.cancel();
      releasePlaybackUrl(lastAudioUrl);
    };
  }, [lastAudioUrl]);

  useEffect(() => {
    return () => {
      liveUnsubscribeRef.current?.();
      void liveControllerRef.current?.end();
    };
  }, []);

  async function handleStartLivePractice() {
    if (!providersReady || !streamingAiProvider || !streamingSpeechProvider) {
      setMessage('Connect OpenRouter and Deepgram before starting live practice.');
      return;
    }

    setMessage(null);
    setTurns([]);
    setFeedback(null);
    setLastAudioUrl(current => {
      releasePlaybackUrl(current);
      return null;
    });

    liveUnsubscribeRef.current?.();
    const controller = createHandsFreeConversationController({
      speechProvider: streamingSpeechProvider,
      aiProvider: streamingAiProvider,
      conversationRepository,
      learnerId,
      level,
      motherLanguage,
      mode: selectedMode,
      topic: activityTopic || selectedModeOption.label,
      description: activityDescription || selectedModeOption.detail,
      startAudioStream: startLiveAudioStream,
      playTutorAudio: playLiveTutorAudio,
    });
    liveControllerRef.current = controller;
    liveUnsubscribeRef.current = controller.onStateChange(nextState => {
      setLiveState(nextState);
      setTurns(nextState.turns);
      if (nextState.errorMessage) {
        setMessage(nextState.errorMessage);
      }
    });

    await controller.start();
  }

  async function handleEndLivePractice() {
    await liveControllerRef.current?.end();
    setMessage('Session saved locally.');
  }

  async function handleStartSession() {
    if (!providersReady) {
      setMessage('Connect OpenRouter and Deepgram before starting a voice session.');
      return;
    }

    setStatus('starting');
    setMessage(null);
    setTurns([]);
    setFeedback(null);
    setLastAudioUrl(current => {
      releasePlaybackUrl(current);
      return null;
    });

    try {
      const startedAt = new Date().toISOString();
      const id = await conversationRepository.startSession({
        learnerId,
        mode: selectedMode,
        startedAt,
      });
      setSessionId(id);
      setSessionStartedAt(startedAt);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
    }
  }

  async function handleStartRecording() {
    if (!providersReady || status !== 'ready' || liveSessionActive) {
      return;
    }

    setStatus('recording');
    setMessage(null);

    try {
      activeRecordingRef.current = await audioRecorder();
    } catch (error) {
      activeRecordingRef.current = null;
      setStatus('ready');
      setMessage(getErrorMessage(error));
    }
  }

  async function handleStopAndSend() {
    if (!activeRecordingRef.current || !aiProvider || !speechProvider) {
      return;
    }

    setStatus('processing');
    setMessage(null);

    try {
      const sample = await activeRecordingRef.current.stop();
      activeRecordingRef.current = null;
      setLastAudioUrl(current => {
        releasePlaybackUrl(current);
        return sample.playbackUrl ?? null;
      });

      const result = await runTurnBasedConversationTurn({
        speechProvider,
        aiProvider,
        audio: sample.audio,
        mimeType: sample.mimeType,
        history: turns,
        level,
        motherLanguage,
        mode: selectedMode,
        topic: activityTopic || selectedModeOption.label,
        description: activityDescription || selectedModeOption.detail,
      });

      setTurns(result.transcript);

      if (sessionId) {
        await conversationRepository.appendTranscript(sessionId, result.learnerTurn);
        await conversationRepository.appendTranscript(sessionId, result.tutorTurn);
      }

      setStatus('ready');
    } catch (error) {
      activeRecordingRef.current = null;
      setStatus('ready');
      setMessage(getErrorMessage(error));
    }
  }

  async function handleEndSession() {
    if (!sessionId || !sessionStartedAt) {
      setStatus('ended');
      return;
    }

    setStatus('ending');
    setMessage(null);

    try {
      const endedAt = new Date().toISOString();
      const sessionFeedback =
        aiProvider && turns.length > 0
          ? await generateLocalConversationFeedback({
              aiProvider,
              turns,
              level,
              motherLanguage,
            })
          : undefined;

      await conversationRepository.endSession({
        id: sessionId,
        learnerId,
        mode: selectedMode,
        startedAt: sessionStartedAt,
        endedAt,
        durationSeconds: Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(sessionStartedAt)) / 1000)),
        transcript: turns,
        feedback: sessionFeedback,
      });
      setFeedback(sessionFeedback ?? null);
      setStatus('ended');
      setMessage('Session saved locally.');
    } catch (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
    }
  }

  async function handlePlayTutorTurn(text: string) {
    if (!speechProvider) {
      setMessage('Connect Deepgram in Settings to play tutor replies.');
      return;
    }

    try {
      const result = await speechProvider.synthesize({
        feature: 'conversation-tutor-reply',
        text,
        options: { language: 'de' },
      });
      const playbackUrl = URL.createObjectURL(new Blob([result.audio], { type: result.mimeType }));

      try {
        await playAudioUrl(playbackUrl);
      } finally {
        releaseObjectUrl(playbackUrl);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <main className="db-dashboard db-conversation" aria-label="Conversation tutor">
      <header className="db-dashboard-header">
        <div>
          <h1>Conversation Tutor</h1>
          <p>Turn-based German speaking with local transcripts and optional AI providers.</p>
        </div>
        <div className="db-level-meter" aria-label="Conversation level">
          <div>
            <strong>{level}</strong>
            <span>{firstName}</span>
          </div>
          <div className="db-ring">{turns.length}</div>
        </div>
      </header>

      <div className="db-conversation-grid">
        <section className="db-panel db-conversation-session-panel" aria-labelledby="conversation-session-heading">
          <div className="db-panel-heading">
            <h2 id="conversation-session-heading">Voice Session</h2>
            <span>{liveState.status !== 'idle' ? formatLiveStatus(liveState.status) : formatStatus(status)}</span>
          </div>

          {!providersReady ? <ProviderSetupState /> : null}

          <div className="db-conversation-task">
            <span className="db-section-label">{isPlanActivity ? 'Plan task' : 'Tutor mode'}</span>
            <h3>{activityTopic || selectedModeOption.label}</h3>
            <p>{activityDescription || selectedModeOption.detail}</p>
          </div>

          <div className="db-mode-list" aria-label="Conversation mode">
            {MODE_OPTIONS.map(option => (
              <button
                key={option.mode}
                type="button"
                className={`db-mode-option ${selectedMode === option.mode ? 'is-selected' : ''}`}
                onClick={() => setSelectedMode(option.mode)}
                disabled={status !== 'idle' && status !== 'ended'}
              >
                <i className={`fa-solid ${option.icon}`} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="db-conversation-live-controls" aria-label="Live practice controls">
            {liveState.status === 'idle' || liveState.status === 'ended' || liveState.status === 'error' ? (
              <button
                type="button"
                className="db-primary-button"
                onClick={() => void handleStartLivePractice()}
                disabled={!providersReady || !streamingReady}
              >
                Start live practice
              </button>
            ) : null}
            {liveSessionActive ? (
              <>
                {liveState.status === 'paused' ? (
                  <button
                    type="button"
                    className="db-secondary-button"
                    onClick={() => void liveControllerRef.current?.resume()}
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    className="db-secondary-button"
                    onClick={() => void liveControllerRef.current?.pause()}
                  >
                    Pause
                  </button>
                )}
                <button
                  type="button"
                  className="db-secondary-button"
                  onClick={() => liveControllerRef.current?.interrupt()}
                >
                  Interrupt
                </button>
                <button
                  type="button"
                  className="db-secondary-button"
                  onClick={() => void handleEndLivePractice()}
                >
                  End session
                </button>
              </>
            ) : null}
            <span className="db-live-status">{formatLiveStatus(liveState.status)}</span>
          </div>

          {liveState.interimTranscript ? (
            <p className="db-interim-transcript">{liveState.interimTranscript}</p>
          ) : null}
          {liveState.currentTutorText && liveState.status !== 'listening' ? (
            <p className="db-streaming-tutor-text">{liveState.currentTutorText}</p>
          ) : null}

          <div className="db-conversation-actions">
            {status === 'idle' || status === 'ended' || status === 'error' ? (
              <button
                type="button"
                className="db-primary-button"
                onClick={handleStartSession}
                disabled={!providersReady || status === 'starting' || liveSessionActive}
              >
                Start session
              </button>
            ) : null}
            {status === 'ready' ? (
              <>
                <button type="button" className="db-primary-button" onClick={handleStartRecording}>
                  Record answer
                </button>
                <button type="button" className="db-secondary-button" onClick={handleEndSession}>
                  End session
                </button>
              </>
            ) : null}
            {status === 'recording' ? (
              <button type="button" className="db-primary-button db-danger-button" onClick={handleStopAndSend}>
                Stop and send
              </button>
            ) : null}
            {status === 'starting' || status === 'processing' || status === 'ending' ? (
              <button type="button" className="db-primary-button" disabled>
                {status === 'processing' ? 'Transcribing...' : 'Working...'}
              </button>
            ) : null}
          </div>

          {lastAudioUrl ? (
            <audio
              className="db-conversation-audio"
              controls
              src={lastAudioUrl}
              aria-label="Last recorded learner audio"
            />
          ) : null}

          {message ? <p className={`db-conversation-message db-conversation-message-${status}`}>{message}</p> : null}

          <div className="db-transcript-panel" ref={transcriptRef} aria-label="Conversation transcript">
            {turns.length === 0 ? (
              <div className="db-transcript-empty">
                <i className="fa-solid fa-microphone-lines" aria-hidden="true" />
                <strong>{streamingReady ? 'Start live practice and speak German.' : 'Start, record one German answer, then send it.'}</strong>
                <span>The tutor will correct one useful point and ask the next question.</span>
              </div>
            ) : (
              turns.map((turn, index) => (
                <TranscriptBubble
                  key={`${turn.occurredAt}-${index}`}
                  turn={turn}
                  onPlayTutorTurn={handlePlayTutorTurn}
                />
              ))
            )}
          </div>
        </section>

        <aside className="db-panel db-conversation-side-panel" aria-label="Session context">
          <span className="db-section-label">Local session</span>
          <h2>Practice shape</h2>
          <dl>
            <div>
              <dt>Input</dt>
              <dd>Deepgram turn transcript</dd>
            </div>
            <div>
              <dt>Tutor</dt>
              <dd>OpenRouter text response</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>Local conversation history</dd>
            </div>
          </dl>
          <p className="db-local-save">
            <i className="fa-solid fa-lock" aria-hidden="true" />
            Transcript data stays in local app storage.
          </p>
          {feedback ? (
            <div className="db-feedback-summary" aria-label="Latest session feedback">
              <strong>{feedback.overallScore}%</strong>
              <span>{feedback.areasForImprovement[0] ?? feedback.encouragement}</span>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
};

const ProviderSetupState: React.FC = () => (
  <div className="db-provider-required" role="status">
    <div>
      <strong>Connect OpenRouter and Deepgram</strong>
      <span>Voice conversation needs both providers enabled in local settings.</span>
    </div>
    <Link className="db-secondary-button" to="/settings">
      Open settings
    </Link>
  </div>
);

const TranscriptBubble: React.FC<{
  turn: TranscriptTurn;
  onPlayTutorTurn: (text: string) => void | Promise<void>;
}> = ({ turn, onPlayTutorTurn }) => {
  const isLearner = turn.speaker === 'learner';

  return (
    <article className={`db-transcript-turn ${isLearner ? 'db-transcript-learner' : 'db-transcript-tutor'}`}>
      <div>
        <span>{isLearner ? 'You' : 'Alex'}</span>
        {typeof turn.confidence === 'number' ? <em>{Math.round(turn.confidence * 100)}%</em> : null}
      </div>
      <p>{turn.text}</p>
      {!isLearner ? (
        <button type="button" className="db-icon-button" onClick={() => void onPlayTutorTurn(turn.text)} aria-label="Play tutor reply">
          <i className="fa-solid fa-volume-high" aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
};

function formatStatus(status: ConversationStatus): string {
  const labels: Record<ConversationStatus, string> = {
    idle: 'Ready to start',
    starting: 'Starting',
    ready: 'Ready',
    recording: 'Recording',
    processing: 'Transcribing',
    ending: 'Saving',
    ended: 'Saved',
    error: 'Needs attention',
  };

  return labels[status];
}

function formatLiveStatus(status: HandsFreeConversationState['status']): string {
  const labels: Record<HandsFreeConversationState['status'], string> = {
    idle: 'Ready',
    connecting: 'Connecting',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    paused: 'Paused',
    ending: 'Saving',
    ended: 'Saved',
    error: 'Needs attention',
  };

  return labels[status];
}

function releasePlaybackUrl(url: string | null | undefined): void {
  if (url && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
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

async function playAudioBlob(audio: Blob, mimeType: string): Promise<void> {
  const playbackUrl = URL.createObjectURL(audio.type ? audio : new Blob([audio], { type: mimeType }));

  try {
    await playAudioUrl(playbackUrl);
  } finally {
    releaseObjectUrl(playbackUrl);
  }
}

function releaseObjectUrl(url: string): void {
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Conversation action failed';
}

export default SpeakingActivityPage;
