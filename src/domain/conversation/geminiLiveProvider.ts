import type {
  LiveConversationEvent,
  LiveConversationProvider,
  LiveConversationSession,
  LiveConversationStartInput,
} from './liveConversationProvider';

type WebSocketLike = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string | ArrayBuffer | Blob }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event?: { code?: number; reason?: string }) => void) | null;
  readonly readyState?: number;
  binaryType?: string;
  send(data: unknown): void;
  close(): void;
};

export type GeminiLiveWebSocketCtor = new (
  url: string,
  protocols?: string | string[]
) => WebSocketLike;

interface GeminiLiveConversationProviderOptions {
  apiKey: string;
  model: string;
  voiceName: string;
  WebSocketCtor?: GeminiLiveWebSocketCtor;
  endpoint?: string;
  openTimeoutMs?: number;
}

interface GeminiLiveServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: {
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  error?: {
    message?: string;
  };
}

const DEFAULT_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const OPEN_WEBSOCKET_STATE = 1;
const GEMINI_OUTPUT_SAMPLE_RATE = 24000;
const DEFAULT_OPEN_TIMEOUT_MS = 15000;

export function createGeminiLiveConversationProvider(
  options: GeminiLiveConversationProviderOptions
): LiveConversationProvider {
  return {
    id: 'gemini-live',
    displayName: 'Gemini Live',
    startSession(input) {
      return openGeminiLiveSession(options, input);
    },
  };
}

function openGeminiLiveSession(
  options: GeminiLiveConversationProviderOptions,
  input: LiveConversationStartInput
): Promise<LiveConversationSession> {
  const socket = createSocket(options);
  const listeners = new Set<(event: LiveConversationEvent) => void>();
  const sessionId = `gemini-live-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  let setupComplete = false;
  let startFailed = false;

  const emit = (event: LiveConversationEvent) => {
    listeners.forEach(listener => listener(event));
  };

  const session: LiveConversationSession = {
    id: sessionId,
    sendAudioPcm16(chunk) {
      sendJsonIfOpen(socket, {
        realtimeInput: {
          audio: {
            data: bytesToBase64(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)),
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      });
    },
    sendAudioStreamEnd() {
      sendJsonIfOpen(socket, {
        realtimeInput: {
          audioStreamEnd: true,
        },
      });
    },
    interrupt() {
      sendJsonIfOpen(socket, {
        realtimeInput: {
          audioStreamEnd: true,
        },
      });
      emit({ type: 'interrupted' });
    },
    close() {
      socket.close();
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return new Promise((resolve, reject) => {
    let openTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearOpenTimeout = () => {
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
    };

    const completeStart = () => {
      if (setupComplete || startFailed) {
        return;
      }

      setupComplete = true;
      clearOpenTimeout();
      resolve(session);
    };

    const failStart = (error: Error) => {
      if (setupComplete) {
        emit({ type: 'error', error });
        return;
      }

      if (startFailed) {
        return;
      }

      startFailed = true;
      clearOpenTimeout();
      reject(error);
    };

    openTimeout = setTimeout(() => {
      failStart(new Error('Gemini Live connection timed out. Check your Gemini API key, network, and selected Live model.'));
      socket.close();
    }, Math.max(1, options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS));

    socket.onopen = () => {
      try {
        socket.send(JSON.stringify(buildSetupMessage(options, input)));
      } catch (error) {
        failStart(error instanceof Error ? error : new Error('Gemini Live setup message failed'));
      }
    };

    const handleServerText = (raw: string) => {
      try {
        const message = JSON.parse(raw) as GeminiLiveServerMessage;

        if (message.error) {
          const error = new Error(message.error.message ?? 'Gemini Live returned an error');
          failStart(error);
          return;
        }

        if (message.setupComplete) {
          completeStart();
          return;
        }

        if (message.serverContent) {
          emitServerContent(message.serverContent, emit);
        }
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error('Gemini Live message parse failed');
        failStart(normalizedError);
      }
    };

    // Gemini Live delivers JSON over binary WebSocket frames. In a browser/Tauri
    // renderer these arrive as Blob (default binaryType) or ArrayBuffer, not text,
    // so they must be decoded before parsing. A serialized queue keeps the async
    // Blob path in original message order.
    let decodeChain: Promise<void> = Promise.resolve();

    // Structural checks (not instanceof) so this works across realms/webviews
    // where Gemini's binary frame may not share the module's ArrayBuffer/Blob.
    socket.onmessage = event => {
      const data = event.data as unknown;

      if (typeof data === 'string') {
        handleServerText(data);
        return;
      }

      const blobLike = data as { text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> };
      if (data && (typeof blobLike.text === 'function' || typeof blobLike.arrayBuffer === 'function')) {
        decodeChain = decodeChain
          .then(() =>
            typeof blobLike.text === 'function'
              ? blobLike.text()
              : blobLike.arrayBuffer!().then(buffer => new TextDecoder().decode(buffer))
          )
          .then(handleServerText)
          .catch(error => {
            failStart(error instanceof Error ? error : new Error('Gemini Live message decode failed'));
          });
        return;
      }

      if (data) {
        handleServerText(new TextDecoder().decode(data as BufferSource));
      }
    };

    socket.onerror = () => {
      failStart(new Error('Gemini Live socket failed'));
    };

    socket.onclose = event => {
      if (!setupComplete) {
        failStart(new Error(`Gemini Live socket closed before the session opened${formatCloseDetail(event)}`));
        return;
      }

      emit({ type: 'closed' });
    };
  });
}

function formatCloseDetail(event?: { code?: number; reason?: string }): string {
  if (!event?.code) {
    return '';
  }

  return ` (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`;
}

function createSocket(options: GeminiLiveConversationProviderOptions): WebSocketLike {
  const SocketCtor = options.WebSocketCtor ?? globalThis.WebSocket;

  if (!SocketCtor) {
    throw new Error('WebSocket is not available in this environment');
  }

  const url = new URL(options.endpoint ?? DEFAULT_ENDPOINT);
  url.searchParams.set('key', options.apiKey);
  const socket = new SocketCtor(url.toString());

  // Prefer ArrayBuffer frames so Gemini's binary JSON decodes synchronously and
  // in order. Falls back to the Blob path in onmessage if unsupported.
  try {
    socket.binaryType = 'arraybuffer';
  } catch {
    // Some WebSocket-like implementations expose binaryType as read-only.
  }

  return socket;
}

function buildSetupMessage(
  options: GeminiLiveConversationProviderOptions,
  input: LiveConversationStartInput
) {
  return {
    setup: {
      model: formatModelName(options.model),
      generationConfig: {
        responseModalities: ['AUDIO'],
        temperature: 0.55,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: options.voiceName,
            },
          },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: buildGermanTutorInstruction(input),
          },
        ],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

function formatModelName(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`;
}

function buildGermanTutorInstruction(input: LiveConversationStartInput): string {
  if (input.instructionOverride?.trim()) {
    return input.instructionOverride.trim();
  }

  return [
    'You are a helpful German conversation tutor inside DeutschBoost.',
    `The learner is CEFR ${input.level}.`,
    `The learner native language is ${input.motherLanguage}.`,
    `Mode: ${input.mode}.`,
    input.topic ? `Topic: ${input.topic}.` : '',
    input.description ? `Task: ${input.description}.` : '',
    'Speak mostly German at the learner level.',
    'Keep turns short, natural, and useful for speaking practice.',
    'Correct one important mistake gently, then ask one follow-up question.',
  ]
    .filter(Boolean)
    .join('\n');
}

function emitServerContent(
  content: NonNullable<GeminiLiveServerMessage['serverContent']>,
  emit: (event: LiveConversationEvent) => void
): void {
  // Gemini streams transcription in small deltas; keep the original spacing so
  // the controller can concatenate fragments into a readable sentence.
  const inputText = content.inputTranscription?.text;
  if (inputText && inputText.trim()) {
    emit({ type: 'input-transcript', text: inputText });
  }

  const outputText = content.outputTranscription?.text;
  if (outputText && outputText.trim()) {
    emit({ type: 'output-transcript', text: outputText });
  }

  content.modelTurn?.parts?.forEach(part => {
    const data = part.inlineData?.data;
    if (!data) {
      return;
    }

    emit({
      type: 'audio',
      audio: base64ToArrayBuffer(data),
      mimeType: part.inlineData?.mimeType ?? `audio/pcm;rate=${GEMINI_OUTPUT_SAMPLE_RATE}`,
      sampleRate: GEMINI_OUTPUT_SAMPLE_RATE,
    });
  });

  if (content.interrupted) {
    emit({ type: 'interrupted' });
  }

  if (content.turnComplete) {
    emit({ type: 'turn-complete' });
  }
}

function sendJsonIfOpen(socket: WebSocketLike, payload: unknown): void {
  if (typeof socket.readyState === 'number' && socket.readyState !== OPEN_WEBSOCKET_STATE) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(value, 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
