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
import { PageHeader, Card, Button, Badge, OptionCard, cn } from '../components/ui';

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
    <main aria-label="Gemini Live conversation">
      <PageHeader
        title="Live German Conversation"
        subtitle="Gemini Live voice practice with local transcripts."
        actions={
          <div
            className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2"
            aria-label="Conversation level"
          >
            <div className="flex flex-col leading-tight">
              <strong className="text-[14px] font-bold text-text">{level}</strong>
              <span className="text-[12px] text-text-muted">{firstName}</span>
            </div>
            <Badge tone="brand">{turns.length} turns</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-labelledby="conversation-session-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="conversation-session-heading" className="text-[16px] font-semibold text-text">
              Gemini Live Room
            </h2>
            <Badge tone={geminiLiveState.status === 'error' ? 'danger' : geminiLiveState.status === 'speaking' ? 'brand' : 'info'}>
              {formatGeminiLiveStatus(geminiLiveState.status)}
            </Badge>
          </div>

          {!geminiLiveReady ? <ProviderSetupState /> : null}

          <div
            className="mb-4 flex items-center gap-3 rounded-control bg-surface-soft p-4"
            aria-label="Live conversation state"
          >
            <div
              className={cn(
                'grid h-12 w-12 flex-none place-items-center rounded-pill text-[18px]',
                geminiLiveState.status === 'speaking'
                  ? 'bg-brand-soft text-brand-strong'
                  : geminiLiveState.status === 'error'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-info-soft text-info'
              )}
              aria-hidden="true"
            >
              <i
                className={
                  geminiLiveState.status === 'speaking'
                    ? 'fa-solid fa-wave-square'
                    : 'fa-solid fa-microphone-lines'
                }
              />
            </div>
            <div className="min-w-0">
              <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
                {isPlanActivity ? 'Plan task' : 'Focus'}
              </span>
              <h3 className="text-[15px] font-semibold text-text">
                {activityTopic || selectedModeOption.label}
              </h3>
              <p className="text-[13px] text-text-muted">
                {activityDescription || selectedModeOption.detail}
              </p>
            </div>
          </div>

          <div
            className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
            aria-label="Conversation mode"
          >
            {MODE_OPTIONS.map(option => (
              <OptionCard
                key={option.mode}
                label={option.label}
                icon={<i className={`fa-solid ${option.icon}`} aria-hidden="true" />}
                selected={selectedMode === option.mode}
                disabled={geminiLiveSessionActive}
                onSelect={() => setSelectedMode(option.mode)}
              />
            ))}
          </div>

          <div
            className="mb-4 flex flex-wrap items-center gap-2"
            aria-label="Gemini Live controls"
          >
            {geminiLiveState.status === 'idle' ||
            geminiLiveState.status === 'ended' ||
            geminiLiveState.status === 'error' ? (
              <Button onClick={() => void handleStartGeminiLive()} disabled={!geminiLiveReady}>
                Start live conversation
              </Button>
            ) : null}
            {geminiLiveSessionActive ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => geminiLiveControllerRef.current?.interrupt()}
                >
                  Interrupt
                </Button>
                <Button variant="secondary" onClick={() => void handleEndGeminiLive()}>
                  End conversation
                </Button>
              </>
            ) : null}
            <span className="text-[13px] text-text-muted">
              {formatGeminiLiveStatus(geminiLiveState.status)}
            </span>
          </div>

          {geminiLiveState.latestLearnerText ? (
            <p className="mb-2 rounded-control bg-surface-soft px-3 py-2 text-[13px] italic text-text-muted">
              {geminiLiveState.latestLearnerText}
            </p>
          ) : null}
          {geminiLiveState.latestTutorText ? (
            <p className="mb-2 rounded-control bg-brand-soft px-3 py-2 text-[13px] text-text">
              {geminiLiveState.latestTutorText}
            </p>
          ) : null}

          {message ? (
            <p
              className={cn(
                'mb-3 rounded-control px-3 py-2 text-[13px]',
                geminiLiveState.status === 'error'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-info-soft text-info'
              )}
            >
              {message}
            </p>
          ) : null}

          <div
            className="flex max-h-96 flex-col gap-2 overflow-auto rounded-control border border-border bg-surface-soft p-3"
            ref={transcriptRef}
            aria-label="Conversation transcript"
          >
            {turns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <i className="fa-solid fa-microphone-lines text-[24px] text-text-muted" aria-hidden="true" />
                <strong className="text-[14px] font-semibold text-text">
                  {geminiLiveReady
                    ? 'Start Gemini Live and speak German naturally.'
                    : 'Connect Gemini Live to start the voice room.'}
                </strong>
                <span className="text-[12px] text-text-muted">
                  The tutor replies with native Gemini audio and keeps the transcript local.
                </span>
              </div>
            ) : (
              turns.map((turn, index) => (
                <TranscriptBubble key={`${turn.occurredAt}-${index}`} turn={turn} />
              ))
            )}
          </div>
        </Card>

        <Card aria-label="Session context">
          <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
            Local session
          </span>
          <h2 className="mt-1 mb-3 text-[16px] font-semibold text-text">Voice path</h2>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-text-muted">Input</dt>
              <dd className="text-text">Microphone stream</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Tutor</dt>
              <dd className="text-text">Gemini Live audio</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Storage</dt>
              <dd className="text-text">Local transcript</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-success">
            <i className="fa-solid fa-lock" aria-hidden="true" />
            Transcript data stays in local app storage.
          </p>
        </Card>
      </div>
    </main>
  );
};

const ProviderSetupState: React.FC = () => (
  <div
    className="mb-4 flex items-center justify-between gap-3 rounded-control border border-border bg-surface-soft p-4"
    role="status"
  >
    <div className="flex flex-col">
      <strong className="text-[14px] font-semibold text-text">Connect Gemini Live</strong>
      <span className="text-[12px] text-text-muted">
        Enable Gemini Live and save a Gemini API key in local settings.
      </span>
    </div>
    <Link
      to="/settings"
      className="rounded-control border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-text transition-colors hover:border-brand"
    >
      Open settings
    </Link>
  </div>
);

const TranscriptBubble: React.FC<{
  turn: TranscriptTurn;
}> = ({ turn }) => {
  const isLearner = turn.speaker === 'learner';

  return (
    <article
      className={cn(
        'rounded-control px-3 py-2',
        isLearner ? 'bg-surface' : 'bg-brand-soft'
      )}
    >
      <div className="mb-0.5 flex items-center gap-2 text-[12px] font-semibold text-text-muted">
        <span>{isLearner ? 'You' : 'Gemini'}</span>
        {typeof turn.confidence === 'number' ? (
          <em className="not-italic">{Math.round(turn.confidence * 100)}%</em>
        ) : null}
      </div>
      <p className="text-[14px] text-text">{turn.text}</p>
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
