import {
  type StreamingSpeechAudioEvent,
  type StreamingSpeechProvider,
  type StreamingSpeechToTextOptions,
  type StreamingSpeechToTextSession,
  type StreamingTextToSpeechOptions,
  type StreamingTextToSpeechSession,
  type StreamingTranscriptEvent,
} from './streamingSpeechProvider';
import { createTranscriptTurn } from './transcriptTypes';

type WebSocketLike = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string | ArrayBuffer | Blob }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  readonly readyState?: number;
  send(data: unknown): void;
  close(): void;
};

export type DeepgramStreamingWebSocketCtor = new (
  url: string,
  protocols?: string | string[]
) => WebSocketLike;

interface DeepgramStreamingProviderOptions {
  tokenProvider: () => Promise<string>;
  apiKey?: string;
  shouldFallbackToApiKey?: (error: unknown) => boolean;
  WebSocketCtor?: DeepgramStreamingWebSocketCtor;
  listenUrl?: string;
  speakUrl?: string;
  now?: () => string;
}

interface DeepgramResultsMessage {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
    }>;
  };
  metadata?: Record<string, unknown>;
}

interface DeepgramSpeakMessage {
  type?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_LISTEN_URL = 'wss://api.deepgram.com/v1/listen';
const DEFAULT_SPEAK_URL = 'wss://api.deepgram.com/v1/speak';
const OPEN_WEBSOCKET_STATE = 1;

export function createDeepgramStreamingSpeechProvider(
  options: DeepgramStreamingProviderOptions
): StreamingSpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    async startTranscription(sttOptions) {
      const token = await resolveSocketToken(options);
      const socket = createSocket(
        options.WebSocketCtor,
        buildListenUrl(options.listenUrl ?? DEFAULT_LISTEN_URL, sttOptions),
        token
      );
      return openTranscriptionSession(socket, options.now ?? (() => new Date().toISOString()));
    },
    async startSynthesis(ttsOptions) {
      const token = await resolveSocketToken(options);
      const socket = createSocket(
        options.WebSocketCtor,
        buildSpeakUrl(options.speakUrl ?? DEFAULT_SPEAK_URL, ttsOptions),
        token
      );
      return openSynthesisSession(socket, ttsOptions);
    },
  };
}

async function resolveSocketToken(options: DeepgramStreamingProviderOptions): Promise<string> {
  try {
    return await options.tokenProvider();
  } catch (error) {
    const fallbackKey = options.apiKey?.trim();

    if (fallbackKey && options.shouldFallbackToApiKey?.(error)) {
      return fallbackKey;
    }

    throw error;
  }
}

function createSocket(
  WebSocketClass: DeepgramStreamingWebSocketCtor | undefined,
  url: string,
  token: string
): WebSocketLike {
  const SocketCtor = WebSocketClass ?? globalThis.WebSocket;

  if (!SocketCtor) {
    throw new Error('WebSocket is not available in this environment');
  }

  return new SocketCtor(url, ['token', token]);
}

function buildListenUrl(baseUrl: string, options: StreamingSpeechToTextOptions): string {
  const url = new URL(baseUrl);
  url.searchParams.set('model', options.model);
  url.searchParams.set('language', options.language);
  url.searchParams.set('endpointing', String(options.endpointingMs));
  url.searchParams.set('interim_results', String(options.interimResults));
  url.searchParams.set('punctuate', String(options.punctuate));
  url.searchParams.set('smart_format', String(options.smartFormat));
  return url.toString();
}

function buildSpeakUrl(baseUrl: string, options: StreamingTextToSpeechOptions): string {
  const url = new URL(baseUrl);
  url.searchParams.set('model', options.ttsModel);
  url.searchParams.set('encoding', options.encoding);

  if (options.sampleRate) {
    url.searchParams.set('sample_rate', String(options.sampleRate));
  }

  if (options.speed) {
    url.searchParams.set('speed', String(options.speed));
  }

  return url.toString();
}

function openTranscriptionSession(
  socket: WebSocketLike,
  now: () => string
): Promise<StreamingSpeechToTextSession> {
  const listeners = new Set<(event: StreamingTranscriptEvent) => void>();
  const finalizedPieces: string[] = [];
  const id = `deepgram-stt-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

  const emit = (event: StreamingTranscriptEvent) => {
    listeners.forEach(listener => listener(event));
  };

  socket.onmessage = event => {
    if (typeof event.data !== 'string') {
      return;
    }

    const message = JSON.parse(event.data) as DeepgramResultsMessage;

    if (message.type === 'SpeechStarted') {
      emit({ type: 'speech-started' });
      return;
    }

    if (message.type === 'UtteranceEnd') {
      emit({ type: 'utterance-end' });
      return;
    }

    if (message.type !== 'Results') {
      return;
    }

    const alternative = message.channel?.alternatives?.[0];
    const text = alternative?.transcript?.trim() ?? '';

    if (!text) {
      return;
    }

    if (!message.is_final) {
      emit({
        type: 'interim',
        piece: {
          text,
          isFinal: false,
          speechFinal: false,
          confidence: alternative?.confidence,
          providerMetadata: message.metadata,
        },
      });
      return;
    }

    finalizedPieces.push(text);

    if (message.speech_final) {
      const finalText = finalizedPieces.join(' ').replace(/\s+/g, ' ').trim();
      finalizedPieces.length = 0;
      emit({
        type: 'final',
        piece: {
          text: finalText,
          isFinal: true,
          speechFinal: true,
          confidence: alternative?.confidence,
          providerMetadata: message.metadata,
        },
        turn: createTranscriptTurn({
          speaker: 'learner',
          text: finalText,
          occurredAt: now(),
          confidence: alternative?.confidence,
          provider: 'deepgram',
        }),
      });
    }
  };

  socket.onerror = () => {
    emit({ type: 'error', error: new Error('Deepgram transcription socket failed') });
  };
  socket.onclose = () => {
    emit({ type: 'closed' });
  };

  return new Promise(resolve => {
    socket.onopen = () => {
      resolve({
        id,
        sendAudio: chunk => sendIfOpen(socket, chunk),
        finalize: () => sendIfOpen(socket, JSON.stringify({ type: 'Finalize' })),
        close: () => socket.close(),
        onEvent(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      });
    };
  });
}

function openSynthesisSession(
  socket: WebSocketLike,
  options: StreamingTextToSpeechOptions
): Promise<StreamingTextToSpeechSession> {
  const listeners = new Set<(event: StreamingSpeechAudioEvent) => void>();
  const id = `deepgram-tts-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  const mimeType = getStreamingAudioMimeType(options);

  const emit = (event: StreamingSpeechAudioEvent) => {
    listeners.forEach(listener => listener(event));
  };

  socket.onmessage = event => {
    if (typeof event.data === 'string') {
      const message = JSON.parse(event.data) as DeepgramSpeakMessage;

      if (message.type === 'Flushed') {
        emit({ type: 'flushed', providerMetadata: message.metadata });
      } else if (message.type === 'Cleared') {
        emit({ type: 'cleared', providerMetadata: message.metadata });
      } else if (message.type === 'Warning') {
        emit({ type: 'warning', warning: message.message, providerMetadata: message.metadata });
      }

      return;
    }

    if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then(audio => {
        emit({ type: 'audio', audio, mimeType: event.data instanceof Blob ? event.data.type || mimeType : mimeType });
      });
      return;
    }

    emit({ type: 'audio', audio: event.data, mimeType });
  };

  socket.onerror = () => {
    emit({ type: 'error', error: new Error('Deepgram synthesis socket failed') });
  };
  socket.onclose = () => {
    emit({ type: 'closed' });
  };

  return new Promise(resolve => {
    socket.onopen = () => {
      resolve({
        id,
        sendText: text => sendIfOpen(socket, JSON.stringify({ type: 'Speak', text })),
        flush: () => sendIfOpen(socket, JSON.stringify({ type: 'Flush' })),
        clear: () => sendIfOpen(socket, JSON.stringify({ type: 'Clear' })),
        close: () => socket.close(),
        onEvent(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      });
    };
  });
}

function sendIfOpen(socket: WebSocketLike, data: unknown): void {
  if (typeof socket.readyState === 'number' && socket.readyState !== OPEN_WEBSOCKET_STATE) {
    return;
  }

  socket.send(data);
}

function getStreamingAudioMimeType(options: StreamingTextToSpeechOptions): string {
  if (options.encoding === 'linear16') {
    return `audio/l16;rate=${options.sampleRate ?? 24000}`;
  }

  return 'audio/mpeg';
}
