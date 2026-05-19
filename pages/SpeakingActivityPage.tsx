import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createGeminiLiveConversationController,
  type GeminiLiveConversationController,
  type GeminiLiveConversationState,
  type PlayGeminiLiveAudio,
  type StartGeminiLiveAudioCapture,
} from '../src/application/geminiLiveConversation';
import type {
  ConversationRepository,
} from '../src/domain/conversation/conversationRepository';
import type { LiveConversationProvider } from '../src/domain/conversation/liveConversationProvider';
import type { TranscriptTurn } from '../src/domain/speech/transcriptTypes';
import {
  browserConversationRepository,
} from '../src/infrastructure/browser/conversationStorage';
import {
  startBrowserPcmAudioCapture,
} from '../src/infrastructure/browser/audioRecorder';
import { playGeminiPcmAudio, resetGeminiPcmAudioStream } from '../src/infrastructure/browser/geminiAudioPlayback';
import { MOTHER_LANGUAGE_OPTIONS } from '../src/domain/profile/profileRepository';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { CEFRLevel, ConversationMode } from '../types';

interface SpeakingActivityPageProps {
  aiProvider?: unknown;
  speechProvider?: unknown;
  streamingAiProvider?: unknown;
  streamingSpeechProvider?: unknown;
  liveConversationProvider?: LiveConversationProvider;
  conversationRepository?: ConversationRepository;
  startGeminiLiveAudioCapture?: StartGeminiLiveAudioCapture;
  playGeminiLiveAudio?: PlayGeminiLiveAudio;
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
    detail: 'Everyday turns with natural follow-up questions.',
    icon: 'fa-comments',
  },
  {
    mode: ConversationMode.SPEAKING_ACTIVITY,
    label: 'Roleplay',
    detail: 'Practice one real situation or learning-plan task.',
    icon: 'fa-user-group',
  },
  {
    mode: ConversationMode.GRAMMAR_DRILL,
    label: 'Grammar repair',
    detail: 'One useful correction per tutor turn.',
    icon: 'fa-wrench',
  },
  {
    mode: ConversationMode.VOCABULARY_BUILDER,
    label: 'Vocabulary',
    detail: 'Activate new words in complete spoken answers.',
    icon: 'fa-layer-group',
  },
  {
    mode: ConversationMode.READING_PRACTICE,
    label: 'Read aloud',
    detail: 'Read, answer, and refine pronunciation rhythm.',
    icon: 'fa-book-open',
  },
];

const SpeakingActivityPage: React.FC<SpeakingActivityPageProps> = ({
  liveConversationProvider,
  conversationRepository = browserConversationRepository,
  startGeminiLiveAudioCapture = startBrowserPcmAudioCapture,
  playGeminiLiveAudio = playGeminiPcmAudio,
}) => {
  const [searchParams] = useSearchParams();
  const activityTopic = searchParams.get('topic')?.trim() ?? '';
  const activityDescription = searchParams.get('description')?.trim() ?? '';
  const isPlanActivity = activityTopic.length > 0 || activityDescription.length > 0;
  const routeLevel = searchParams.get('level') as CEFRLevel | null;
  const initialMode = isPlanActivity ? ConversationMode.SPEAKING_ACTIVITY : ConversationMode.FREE_CONVERSATION;

  const [selectedMode, setSelectedMode] = useState<ConversationMode>(initialMode);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [geminiLiveState, setGeminiLiveState] = useState<GeminiLiveConversationState>(() => createIdleGeminiLiveState());
  const [profileContext, setProfileContext] = useState({
    level: CEFRLevel.A2,
    motherLanguage: 'English',
    firstName: 'Learner',
  });
  const geminiLiveControllerRef = useRef<GeminiLiveConversationController | null>(null);
  const geminiLiveUnsubscribeRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const geminiLiveReady = Boolean(liveConversationProvider);
  const geminiLiveSessionActive = !['idle', 'ended', 'error'].includes(geminiLiveState.status);
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
      geminiLiveUnsubscribeRef.current?.();
      void geminiLiveControllerRef.current?.end();
    };
  }, []);

  async function handleStartGeminiLive() {
    if (!liveConversationProvider) {
      setMessage('Connect Gemini Live before starting realtime conversation.');
      return;
    }

    setMessage(null);
    setTurns([]);

    geminiLiveUnsubscribeRef.current?.();
    const controller = createGeminiLiveConversationController({
      liveProvider: liveConversationProvider,
      conversationRepository,
      learnerId,
      level,
      motherLanguage,
      mode: selectedMode,
      topic: activityTopic || selectedModeOption.label,
      description: activityDescription || selectedModeOption.detail,
      startAudioCapture: startGeminiLiveAudioCapture,
      playTutorAudio: playGeminiLiveAudio,
      resetTutorAudio: resetGeminiPcmAudioStream,
    });
    geminiLiveControllerRef.current = controller;
    geminiLiveUnsubscribeRef.current = controller.onStateChange(nextState => {
      setGeminiLiveState(nextState);
      setTurns(nextState.turns);
      if (nextState.errorMessage) {
        setMessage(nextState.errorMessage);
      }
    });

    await controller.start();
  }

  async function handleEndGeminiLive() {
    await geminiLiveControllerRef.current?.end();
    setMessage('Gemini Live session saved locally.');
  }

  return (
    <main className="db-dashboard db-conversation db-live-conversation" aria-label="Gemini Live conversation">
      <header className="db-dashboard-header">
        <div>
          <h1>Live German Conversation</h1>
          <p>Gemini Live voice practice with local transcripts.</p>
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
            <h2 id="conversation-session-heading">Gemini Live Room</h2>
            <span>{formatGeminiLiveStatus(geminiLiveState.status)}</span>
          </div>

          {!geminiLiveReady ? <ProviderSetupState /> : null}

          <div className="db-live-room-stage" aria-label="Live conversation state">
            <div className={`db-live-signal db-live-signal-${geminiLiveState.status}`} aria-hidden="true">
              <i className={geminiLiveState.status === 'speaking' ? 'fa-solid fa-wave-square' : 'fa-solid fa-microphone-lines'} />
            </div>
            <div>
              <span className="db-section-label">{isPlanActivity ? 'Plan task' : 'Focus'}</span>
              <h3>{activityTopic || selectedModeOption.label}</h3>
              <p>{activityDescription || selectedModeOption.detail}</p>
            </div>
          </div>

          <div className="db-mode-list" aria-label="Conversation mode">
            {MODE_OPTIONS.map(option => (
              <button
                key={option.mode}
                type="button"
                className={`db-mode-option ${selectedMode === option.mode ? 'is-selected' : ''}`}
                onClick={() => setSelectedMode(option.mode)}
                disabled={geminiLiveSessionActive}
              >
                <i className={`fa-solid ${option.icon}`} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="db-conversation-live-controls" aria-label="Gemini Live controls">
            {geminiLiveState.status === 'idle' ||
            geminiLiveState.status === 'ended' ||
            geminiLiveState.status === 'error' ? (
              <button
                type="button"
                className="db-primary-button"
                onClick={() => void handleStartGeminiLive()}
                disabled={!geminiLiveReady}
              >
                Start live conversation
              </button>
            ) : null}
            {geminiLiveSessionActive ? (
              <>
                <button
                  type="button"
                  className="db-secondary-button"
                  onClick={() => geminiLiveControllerRef.current?.interrupt()}
                >
                  Interrupt
                </button>
                <button
                  type="button"
                  className="db-secondary-button"
                  onClick={() => void handleEndGeminiLive()}
                >
                  End conversation
                </button>
              </>
            ) : null}
            <span className="db-live-status">{formatGeminiLiveStatus(geminiLiveState.status)}</span>
          </div>

          {geminiLiveState.latestLearnerText ? (
            <p className="db-interim-transcript">{geminiLiveState.latestLearnerText}</p>
          ) : null}
          {geminiLiveState.latestTutorText ? (
            <p className="db-streaming-tutor-text">{geminiLiveState.latestTutorText}</p>
          ) : null}

          {message ? (
            <p className={`db-conversation-message db-conversation-message-${geminiLiveState.status}`}>
              {message}
            </p>
          ) : null}

          <div className="db-transcript-panel" ref={transcriptRef} aria-label="Conversation transcript">
            {turns.length === 0 ? (
              <div className="db-transcript-empty">
                <i className="fa-solid fa-microphone-lines" aria-hidden="true" />
                <strong>
                  {geminiLiveReady
                    ? 'Start Gemini Live and speak German naturally.'
                    : 'Connect Gemini Live to start the voice room.'}
                </strong>
                <span>The tutor replies with native Gemini audio and keeps the transcript local.</span>
              </div>
            ) : (
              turns.map((turn, index) => (
                <TranscriptBubble
                  key={`${turn.occurredAt}-${index}`}
                  turn={turn}
                />
              ))
            )}
          </div>
        </section>

        <aside className="db-panel db-conversation-side-panel" aria-label="Session context">
          <span className="db-section-label">Local session</span>
          <h2>Voice path</h2>
          <dl>
            <div>
              <dt>Input</dt>
              <dd>Microphone stream</dd>
            </div>
            <div>
              <dt>Tutor</dt>
              <dd>Gemini Live audio</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>Local transcript</dd>
            </div>
          </dl>
          <p className="db-local-save">
            <i className="fa-solid fa-lock" aria-hidden="true" />
            Transcript data stays in local app storage.
          </p>
        </aside>
      </div>
    </main>
  );
};

const ProviderSetupState: React.FC = () => (
  <div className="db-provider-required" role="status">
    <div>
      <strong>Connect Gemini Live</strong>
      <span>Enable Gemini Live and save a Gemini API key in local settings.</span>
    </div>
    <Link className="db-secondary-button" to="/settings">
      Open settings
    </Link>
  </div>
);

const TranscriptBubble: React.FC<{
  turn: TranscriptTurn;
}> = ({ turn }) => {
  const isLearner = turn.speaker === 'learner';

  return (
    <article className={`db-transcript-turn ${isLearner ? 'db-transcript-learner' : 'db-transcript-tutor'}`}>
      <div>
        <span>{isLearner ? 'You' : 'Gemini'}</span>
        {typeof turn.confidence === 'number' ? <em>{Math.round(turn.confidence * 100)}%</em> : null}
      </div>
      <p>{turn.text}</p>
    </article>
  );
};

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

export default SpeakingActivityPage;
