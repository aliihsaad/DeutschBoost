import type { AiMessage } from '../domain/ai/aiProvider';
import type { StreamingAiProvider } from '../domain/ai/streamingAiProvider';
import type { ConversationRepository } from '../domain/conversation/conversationRepository';
import type { StreamingSpeechProvider } from '../domain/speech/streamingSpeechProvider';
import { createTranscriptTurn, type TranscriptTurn } from '../domain/speech/transcriptTypes';
import type { CEFRLevel, ConversationMode } from '../../types';

const STREAMING_TTS_SAMPLE_RATE = 24000;

export type HandsFreeConversationStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'ending'
  | 'ended'
  | 'error';

export interface HandsFreeConversationState {
  status: HandsFreeConversationStatus;
  turns: TranscriptTurn[];
  interimTranscript: string;
  currentTutorText: string;
  errorMessage: string | null;
}

export interface ActiveConversationAudioStream {
  stop(): void | Promise<void>;
}

export interface StartConversationAudioStreamInput {
  onAudioChunk(chunk: Blob | ArrayBuffer | Uint8Array): void;
  onError(error: Error): void;
}

export type StartConversationAudioStream = (
  input: StartConversationAudioStreamInput
) => Promise<ActiveConversationAudioStream>;

export type PlayTutorAudio = (audio: Blob, mimeType: string) => Promise<void>;

export interface HandsFreeConversationController {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  interrupt(): void;
  end(): Promise<void>;
  getState(): HandsFreeConversationState;
  onStateChange(listener: (state: HandsFreeConversationState) => void): () => void;
  waitForIdle(): Promise<void>;
}

interface HandsFreeConversationInput {
  speechProvider: StreamingSpeechProvider;
  aiProvider: StreamingAiProvider;
  conversationRepository: ConversationRepository;
  learnerId: string;
  level: CEFRLevel;
  motherLanguage: string;
  mode: ConversationMode;
  startAudioStream: StartConversationAudioStream;
  playTutorAudio: PlayTutorAudio;
  topic?: string;
  description?: string;
  now?: () => string;
}

export function createHandsFreeConversationController(
  input: HandsFreeConversationInput
): HandsFreeConversationController {
  const now = input.now ?? (() => new Date().toISOString());
  const listeners = new Set<(state: HandsFreeConversationState) => void>();
  const idleWaiters: Array<() => void> = [];
  let state: HandsFreeConversationState = {
    status: 'idle',
    turns: [],
    interimTranscript: '',
    currentTutorText: '',
    errorMessage: null,
  };
  let sessionId: string | null = null;
  let startedAt: string | null = null;
  let sttSession: Awaited<ReturnType<StreamingSpeechProvider['startTranscription']>> | null = null;
  let ttsSession: Awaited<ReturnType<StreamingSpeechProvider['startSynthesis']>> | null = null;
  let audioStream: ActiveConversationAudioStream | null = null;

  const setState = (patch: Partial<HandsFreeConversationState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener(state));

    if (state.status === 'listening') {
      idleWaiters.splice(0).forEach(resolve => resolve());
    }
  };

  const stopAudioStream = async () => {
    const stream = audioStream;
    audioStream = null;

    if (stream) {
      await stream.stop();
    }
  };

  const startAudioInput = async () => {
    if (!sttSession) {
      return;
    }

    await stopAudioStream();
    setState({ status: 'listening', errorMessage: null });
    audioStream = await input.startAudioStream({
      onAudioChunk(chunk) {
        if (state.status === 'listening') {
          sttSession?.sendAudio(chunk);
        }
      },
      onError(error) {
        setState({ status: 'error', errorMessage: error.message });
      },
    });
  };

  const handleFinalLearnerTurn = async (learnerTurn: TranscriptTurn) => {
    if (state.status !== 'listening') {
      return;
    }

    const turnsWithLearner = [...state.turns, learnerTurn];
    setState({
      status: 'thinking',
      turns: turnsWithLearner,
      interimTranscript: '',
      currentTutorText: '',
      errorMessage: null,
    });
    await stopAudioStream();

    if (sessionId) {
      await input.conversationRepository.appendTranscript(sessionId, learnerTurn);
    }

    let tutorText = '';
    for await (const chunk of input.aiProvider.streamText({
      feature: 'conversation-live-tutor',
      messages: buildTutorMessages({
        history: turnsWithLearner,
        level: input.level,
        motherLanguage: input.motherLanguage,
        mode: input.mode,
        topic: input.topic,
        description: input.description,
      }),
      options: { temperature: 0.45, maxTokens: 260 },
    })) {
      tutorText += chunk.text;
      setState({ currentTutorText: tutorText });
    }

    const tutorTurn = createTranscriptTurn({
      speaker: 'tutor',
      text: tutorText,
      occurredAt: now(),
      provider: input.aiProvider.id,
    });
    const fullTranscript = [...turnsWithLearner, tutorTurn];

    setState({
      status: 'speaking',
      turns: fullTranscript,
      currentTutorText: tutorTurn.text,
    });

    if (sessionId) {
      await input.conversationRepository.appendTranscript(sessionId, tutorTurn);
    }

    await speakTutorTurn(tutorTurn.text);
    setState({ currentTutorText: '' });
    await startAudioInput();
  };

  const speakTutorTurn = async (text: string) => {
    ttsSession = await input.speechProvider.startSynthesis({
      ttsModel: 'aura-2-viktoria-de',
      encoding: 'linear16',
      sampleRate: STREAMING_TTS_SAMPLE_RATE,
    });

    const chunks: ArrayBuffer[] = [];
    const flushed = new Promise<void>((resolve, reject) => {
      const unsubscribe = ttsSession?.onEvent(event => {
        if (event.type === 'audio' && event.audio) {
          chunks.push(event.audio);
        }

        if (event.type === 'flushed' || event.type === 'closed') {
          unsubscribe?.();
          resolve();
        }

        if (event.type === 'error') {
          unsubscribe?.();
          reject(event.error ?? new Error('Deepgram TTS playback failed'));
        }
      });
    });

    ttsSession.sendText(text);
    ttsSession.flush();
    await flushed;

    if (chunks.length > 0) {
      await input.playTutorAudio(createWavBlobFromLinear16(chunks, STREAMING_TTS_SAMPLE_RATE), 'audio/wav');
    }
  };

  const setError = (error: unknown) => {
    setState({
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Conversation action failed',
    });
  };

  return {
    async start() {
      try {
        setState({
          status: 'connecting',
          turns: [],
          interimTranscript: '',
          currentTutorText: '',
          errorMessage: null,
        });
        startedAt = now();
        sessionId = await input.conversationRepository.startSession({
          learnerId: input.learnerId,
          mode: input.mode,
          startedAt,
        });
        sttSession = await input.speechProvider.startTranscription({
          language: 'de',
          model: 'nova-3',
          endpointingMs: 450,
          interimResults: true,
          punctuate: true,
          smartFormat: true,
        });
        sttSession.onEvent(event => {
          if (event.type === 'interim') {
            setState({ interimTranscript: event.piece?.text ?? '' });
          }

          if (event.type === 'error') {
            setState({ status: 'error', errorMessage: event.error?.message ?? 'Deepgram STT failed' });
          }

          if (event.type === 'final' && event.turn) {
            void handleFinalLearnerTurn(event.turn).catch(setError);
          }
        });
        await startAudioInput();
      } catch (error) {
        setError(error);
      }
    },
    async pause() {
      await stopAudioStream();
      setState({ status: 'paused' });
    },
    async resume() {
      if (state.status !== 'paused') {
        return;
      }

      await startAudioInput();
    },
    interrupt() {
      ttsSession?.clear();
      void startAudioInput().catch(setError);
    },
    async end() {
      setState({ status: 'ending' });
      await stopAudioStream();
      sttSession?.close();
      ttsSession?.close();

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
    waitForIdle() {
      if (state.status === 'listening') {
        return Promise.resolve();
      }

      return new Promise(resolve => {
        idleWaiters.push(resolve);
      });
    },
  };
}

function createWavBlobFromLinear16(chunks: ArrayBuffer[], sampleRate: number): Blob {
  const pcm = concatenateAudioChunks(chunks);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const bytesPerSample = 2;
  const channelCount = 1;
  const byteRate = sampleRate * channelCount * bytesPerSample;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.byteLength, true);

  return new Blob([header, pcm], { type: 'audio/wav' });
}

function concatenateAudioChunks(chunks: ArrayBuffer[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach(chunk => {
    output.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  });

  return output;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function buildTutorMessages(input: {
  history: TranscriptTurn[];
  level: CEFRLevel;
  motherLanguage: string;
  mode: ConversationMode;
  topic?: string;
  description?: string;
}): AiMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are Alex, a German conversation tutor inside DeutschBoost.',
        `The learner is CEFR ${input.level}.`,
        `The learner native language is ${input.motherLanguage}.`,
        'Answer mostly in German, correct one useful mistake, then ask one natural follow-up question.',
        'Keep the reply short enough to speak aloud.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Mode: ${input.mode}`,
        input.topic ? `Topic: ${input.topic}` : '',
        input.description ? `Task: ${input.description}` : '',
        'Recent transcript:',
        input.history
          .slice(-10)
          .map(turn => `${turn.speaker === 'learner' ? 'Learner' : 'Tutor'}: ${turn.text}`)
          .join('\n'),
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}
