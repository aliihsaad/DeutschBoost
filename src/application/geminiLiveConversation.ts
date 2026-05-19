import type {
  LiveConversationEvent,
  LiveConversationProvider,
  LiveConversationSession,
} from '../domain/conversation/liveConversationProvider';
import type { ConversationRepository } from '../domain/conversation/conversationRepository';
import {
  createTranscriptTurn,
  normalizeTranscriptText,
  type TranscriptSpeaker,
  type TranscriptTurn,
} from '../domain/speech/transcriptTypes';
import type { CEFRLevel, ConversationMode } from '../../types';

export type GeminiLiveConversationStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'ending'
  | 'ended'
  | 'error';

export interface GeminiLiveConversationState {
  status: GeminiLiveConversationStatus;
  turns: TranscriptTurn[];
  latestLearnerText: string;
  latestTutorText: string;
  errorMessage: string | null;
}

export interface ActiveGeminiLiveAudioCapture {
  stop(): void | Promise<void>;
}

export interface StartGeminiLiveAudioCaptureInput {
  onPcmChunk(chunk: Uint8Array): void;
  onError(error: Error): void;
}

export type StartGeminiLiveAudioCapture = (
  input: StartGeminiLiveAudioCaptureInput
) => Promise<ActiveGeminiLiveAudioCapture>;

export type PlayGeminiLiveAudio = (
  audio: ArrayBuffer,
  mimeType: string,
  sampleRate: number
) => Promise<void>;

const MAX_PENDING_PCM_CHUNKS = 96;

export interface GeminiLiveConversationController {
  start(): Promise<void>;
  interrupt(): void;
  end(): Promise<void>;
  getState(): GeminiLiveConversationState;
  onStateChange(listener: (state: GeminiLiveConversationState) => void): () => void;
}

interface GeminiLiveConversationInput {
  liveProvider: LiveConversationProvider;
  conversationRepository: ConversationRepository;
  learnerId: string;
  level: CEFRLevel;
  motherLanguage: string;
  mode: ConversationMode;
  startAudioCapture: StartGeminiLiveAudioCapture;
  playTutorAudio: PlayGeminiLiveAudio;
  resetTutorAudio?: () => void;
  topic?: string;
  description?: string;
  liveInstruction?: string;
  now?: () => string;
}

export function createGeminiLiveConversationController(
  input: GeminiLiveConversationInput
): GeminiLiveConversationController {
  const now = input.now ?? (() => new Date().toISOString());
  const listeners = new Set<(state: GeminiLiveConversationState) => void>();
  let state: GeminiLiveConversationState = createIdleState();
  let sessionId: string | null = null;
  let startedAt: string | null = null;
  let liveSession: LiveConversationSession | null = null;
  let audioCapture: ActiveGeminiLiveAudioCapture | null = null;
  let unsubscribeLiveEvents: (() => void) | null = null;
  let pendingPcmChunks: Uint8Array[] = [];

  const setState = (patch: Partial<GeminiLiveConversationState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener(state));
  };

  // Gemini streams transcription as many small deltas. Accumulate consecutive
  // same-speaker deltas into a single in-progress turn so the transcript reads
  // as sentences (not one word per line), and only persist a turn once it is
  // finalized at a turn boundary.
  let streamingSpeaker: TranscriptSpeaker | null = null;
  let streamingRaw = '';

  const buildStreamingTurn = (): TranscriptTurn =>
    createTranscriptTurn({
      speaker: streamingSpeaker as TranscriptSpeaker,
      text: streamingRaw,
      occurredAt: now(),
      provider: input.liveProvider.id,
    });

  const finalizeStreamingTurn = () => {
    if (!streamingSpeaker || !streamingRaw.trim()) {
      streamingSpeaker = null;
      streamingRaw = '';
      return;
    }

    const finalTurn = buildStreamingTurn();
    setState({ turns: [...state.turns.slice(0, -1), finalTurn] });
    if (sessionId) {
      void input.conversationRepository.appendTranscript(sessionId, finalTurn);
    }
    streamingSpeaker = null;
    streamingRaw = '';
  };

  const ingestTranscriptDelta = (speaker: TranscriptSpeaker, rawDelta: string) => {
    if (!rawDelta.trim()) {
      return;
    }

    if (streamingSpeaker !== speaker) {
      finalizeStreamingTurn();
      streamingSpeaker = speaker;
      streamingRaw = rawDelta;
      setState({ turns: [...state.turns, buildStreamingTurn()] });
    } else {
      streamingRaw += rawDelta;
      setState({ turns: [...state.turns.slice(0, -1), buildStreamingTurn()] });
    }
  };

  const handleEvent = (event: LiveConversationEvent) => {
    if (event.type === 'input-transcript') {
      ingestTranscriptDelta('learner', event.text);
      if (streamingSpeaker === 'learner') {
        setState({ latestLearnerText: normalizeTranscriptText(streamingRaw), status: 'listening' });
      }
      return;
    }

    if (event.type === 'output-transcript') {
      ingestTranscriptDelta('tutor', event.text);
      if (streamingSpeaker === 'tutor') {
        setState({ latestTutorText: normalizeTranscriptText(streamingRaw), status: 'speaking' });
      }
      return;
    }

    if (event.type === 'audio') {
      setState({ status: 'speaking' });
      void input.playTutorAudio(event.audio, event.mimeType, event.sampleRate)
        .then(() => {
          if (state.status === 'speaking') {
            setState({ status: 'listening' });
          }
        })
        .catch(error => {
          setState({
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Gemini Live audio playback failed',
          });
        });
      return;
    }

    if (event.type === 'interrupted' || event.type === 'turn-complete') {
      if (event.type === 'interrupted') {
        input.resetTutorAudio?.();
      }
      finalizeStreamingTurn();
      setState({ status: 'listening' });
      return;
    }

    if (event.type === 'error') {
      finalizeStreamingTurn();
      setState({ status: 'error', errorMessage: event.error.message });
      return;
    }

    if (event.type === 'closed' && state.status !== 'ending' && state.status !== 'ended') {
      finalizeStreamingTurn();
      setState({ status: 'ended' });
    }
  };

  const stopAudio = async () => {
    const capture = audioCapture;
    audioCapture = null;
    if (capture) {
      await capture.stop();
    }
  };

  const queueOrSendPcmChunk = (chunk: Uint8Array) => {
    if (liveSession) {
      liveSession.sendAudioPcm16(chunk);
      return;
    }

    pendingPcmChunks.push(chunk);
    if (pendingPcmChunks.length > MAX_PENDING_PCM_CHUNKS) {
      pendingPcmChunks = pendingPcmChunks.slice(-MAX_PENDING_PCM_CHUNKS);
    }
  };

  const flushPendingPcmChunks = () => {
    if (!liveSession || pendingPcmChunks.length === 0) {
      return;
    }

    const chunks = pendingPcmChunks;
    pendingPcmChunks = [];
    chunks.forEach(chunk => liveSession?.sendAudioPcm16(chunk));
  };

  return {
    async start() {
      streamingSpeaker = null;
      streamingRaw = '';
      input.resetTutorAudio?.();
      setState({
        status: 'connecting',
        turns: [],
        latestLearnerText: '',
        latestTutorText: '',
        errorMessage: null,
      });

      try {
        startedAt = now();
        sessionId = await input.conversationRepository.startSession({
          learnerId: input.learnerId,
          mode: input.mode,
          startedAt,
        });
        const liveSessionPromise = input.liveProvider.startSession({
          level: input.level,
          motherLanguage: input.motherLanguage,
          mode: input.mode,
          topic: input.topic,
          description: input.description,
          instructionOverride: input.liveInstruction,
        });
        const audioCapturePromise = input.startAudioCapture({
          onPcmChunk(chunk) {
            queueOrSendPcmChunk(chunk);
          },
          onError(error) {
            setState({ status: 'error', errorMessage: error.message });
          },
        });

        const [nextLiveSession, nextAudioCapture] = await Promise.all([
          liveSessionPromise,
          audioCapturePromise,
        ]);

        liveSession = nextLiveSession;
        audioCapture = nextAudioCapture;
        unsubscribeLiveEvents = liveSession.onEvent(handleEvent);
        flushPendingPcmChunks();
        setState({ status: 'listening' });
      } catch (error) {
        await stopAudio();
        liveSession?.close();
        pendingPcmChunks = [];
        setState({
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Gemini Live conversation failed to start',
        });
      }
    },
    interrupt() {
      input.resetTutorAudio?.();
      finalizeStreamingTurn();
      liveSession?.interrupt();
      setState({ status: 'listening' });
    },
    async end() {
      setState({ status: 'ending' });
      input.resetTutorAudio?.();
      finalizeStreamingTurn();
      liveSession?.sendAudioStreamEnd();
      await stopAudio();
      pendingPcmChunks = [];
      unsubscribeLiveEvents?.();
      unsubscribeLiveEvents = null;
      liveSession?.close();

      if (sessionId && startedAt) {
        const endedAt = now();
        await input.conversationRepository.endSession({
          id: sessionId,
          learnerId: input.learnerId,
          mode: input.mode,
          startedAt,
          endedAt,
          durationSeconds: Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)),
          transcript: state.turns,
        });
      }

      setState({ status: 'ended' });
    },
    getState() {
      return state;
    },
    onStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createIdleState(): GeminiLiveConversationState {
  return {
    status: 'idle',
    turns: [],
    latestLearnerText: '',
    latestTutorText: '',
    errorMessage: null,
  };
}
