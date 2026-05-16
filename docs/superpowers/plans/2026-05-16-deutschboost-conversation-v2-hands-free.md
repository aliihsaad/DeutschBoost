# DeutschBoost Conversation v2 Hands-Free Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default manual record/stop/send conversation loop with a hands-free turn-taking mode that uses Deepgram streaming STT, OpenRouter streaming tutor replies, and Deepgram TTS playback, while keeping manual turn mode as fallback.

**Architecture:** Add streaming contracts beside the existing REST-style `SpeechProvider` and `AiProvider` contracts. A new hands-free conversation controller owns the session state machine and coordinates streaming STT events, OpenRouter text deltas, Deepgram TTS playback, local transcript writes, and recoverable fallback states.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Deepgram WebSocket STT/TTS, Deepgram auth grant, OpenRouter streaming chat completions, existing Tauri/Stronghold provider settings, existing local conversation repository.

---

## File Map

- Create: `src/domain/speech/streamingSpeechProvider.ts`
  - Provider-neutral streaming STT/TTS interfaces, event types, connection options, and session handles.
- Create: `src/domain/speech/deepgramStreamingProvider.ts`
  - Deepgram streaming STT/TTS implementation using short-lived token auth and injectable WebSocket/audio primitives.
- Create: `tests/domain/speech/deepgramStreamingProvider.test.ts`
  - Unit coverage for URL construction, transcript buffering, finalization, TTS commands, and error events.
- Modify: `src/domain/speech/deepgramProvider.ts`
  - Reuse `testDeepgramApiKey`/auth token endpoint behavior where possible; do not change existing REST STT/TTS behavior.
- Modify: `src/infrastructure/native/deepgramFetch.ts`
  - Route Deepgram temporary-token requests to the official `/v1/auth/grant` path while keeping the old local `/auth/token` alias compatible.
- Modify: `src-tauri/src/lib.rs`
  - Update the native Deepgram auth command to call `POST https://api.deepgram.com/v1/auth/grant`.
- Modify: `tests/infrastructure/native/deepgramFetch.test.ts`
  - Prove the renderer bridge invokes the native grant command and returns an access token response.
- Create: `src/domain/ai/streamingAiProvider.ts`
  - Provider-neutral text streaming interface.
- Create: `src/domain/ai/openRouterStreamingProvider.ts`
  - OpenRouter SSE streaming adapter and parser.
- Create: `tests/domain/ai/openRouterStreamingProvider.test.ts`
  - Unit coverage for SSE comments, deltas, cancellation, and errors.
- Create: `src/application/handsFreeConversation.ts`
  - Conversation v2 state machine and orchestration.
- Create: `tests/application/handsFreeConversation.test.ts`
  - State transition, transcript preservation, pause/resume, interrupt, and fallback coverage.
- Modify: `pages/SpeakingActivityPage.tsx`
  - Add live practice UI and wire it to the hands-free controller while preserving current manual mode.
- Modify: `tests/pages/SpeakingActivityPage.test.tsx`
  - Add component coverage for live practice flow, fallback, and controls.
- Modify: `src/application/providerRuntime.ts`
  - Expose optional streaming speech and streaming AI providers from existing settings.
- Modify: `MainApp.tsx`
  - Pass streaming providers to `/conversation`.
- Modify: `tests/MainApp.providerRuntime.test.tsx`
  - Prove streaming providers are created and routed when OpenRouter/Deepgram are enabled.
- Modify: `docs/release/native-release-readiness.md`
  - Add Conversation v2 packaged-smoke requirements before the next release.

## Task 1: Add Streaming Speech Contracts

**Files:**
- Create: `src/domain/speech/streamingSpeechProvider.ts`

- [ ] **Step 1: Create provider-neutral streaming contracts**

Add this file:

```ts
import type { TranscriptTurn } from './transcriptTypes';

export type StreamingSpeechState =
  | 'connecting'
  | 'open'
  | 'listening'
  | 'speaking'
  | 'closed'
  | 'error';

export interface StreamingTranscriptPiece {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
  confidence?: number;
  startedAtSeconds?: number;
  durationSeconds?: number;
  providerMetadata?: Record<string, unknown>;
}

export interface StreamingTranscriptEvent {
  type: 'interim' | 'final' | 'speech-started' | 'utterance-end' | 'error' | 'closed';
  piece?: StreamingTranscriptPiece;
  turn?: TranscriptTurn;
  error?: Error;
}

export interface StreamingSpeechToTextOptions {
  language: string;
  model: string;
  endpointingMs: number;
  interimResults: boolean;
  punctuate: boolean;
  smartFormat: boolean;
}

export interface StreamingSpeechToTextSession {
  readonly id: string;
  sendAudio(chunk: Blob | ArrayBuffer | Uint8Array): void;
  finalize(): void;
  close(): void;
  onEvent(listener: (event: StreamingTranscriptEvent) => void): () => void;
}

export interface StreamingTextToSpeechOptions {
  ttsModel: string;
  encoding: 'mp3' | 'linear16';
  sampleRate?: number;
  speed?: number;
}

export interface StreamingSpeechAudioEvent {
  type: 'audio' | 'flushed' | 'cleared' | 'warning' | 'closed' | 'error';
  audio?: ArrayBuffer;
  mimeType?: string;
  warning?: string;
  error?: Error;
  providerMetadata?: Record<string, unknown>;
}

export interface StreamingTextToSpeechSession {
  readonly id: string;
  sendText(text: string): void;
  flush(): void;
  clear(): void;
  close(): void;
  onEvent(listener: (event: StreamingSpeechAudioEvent) => void): () => void;
}

export interface StreamingSpeechProvider {
  id: string;
  displayName: string;
  startTranscription(options: StreamingSpeechToTextOptions): Promise<StreamingSpeechToTextSession>;
  startSynthesis(options: StreamingTextToSpeechOptions): Promise<StreamingTextToSpeechSession>;
}
```

- [ ] **Step 2: Type-check the new contract**

Run:

```powershell
npm run build
```

Expected: PASS. This task creates types only and should not affect runtime.

- [ ] **Step 3: Commit the contract slice**

Run:

```powershell
git add src/domain/speech/streamingSpeechProvider.ts
git commit -m "feat: add streaming speech contracts"
```

## Task 2: Align Deepgram Temporary Token Bridge

**Files:**
- Modify: `src/infrastructure/native/deepgramFetch.ts`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/infrastructure/native/deepgramFetch.test.ts`

- [ ] **Step 1: Write failing token grant bridge test**

Add to `tests/infrastructure/native/deepgramFetch.test.ts`:

```ts
it('routes Deepgram auth grant requests through the native bridge', async () => {
  const invoke = vi.fn().mockResolvedValue({
    status: 200,
    body: JSON.stringify({ access_token: 'temporary-token', expires_in: 30 }),
    content_type: 'application/json',
  });
  const fetchFn = createTauriDeepgramFetch(invoke);

  const response = await fetchFn('/api/deepgram/v1/auth/grant', {
    method: 'POST',
    headers: {
      Authorization: 'Token deepgram-key',
      'Content-Type': 'application/json',
    },
  });

  expect(invoke).toHaveBeenCalledWith('deepgram_auth_token', { apiKey: 'deepgram-key' });
  await expect(response.json()).resolves.toEqual({
    access_token: 'temporary-token',
    expires_in: 30,
  });
});
```

- [ ] **Step 2: Run the failing bridge test**

Run:

```powershell
npm run test:run -- tests/infrastructure/native/deepgramFetch.test.ts
```

Expected: FAIL until `/v1/auth/grant` is routed by the bridge.

- [ ] **Step 3: Route the official grant path in TypeScript**

In `src/infrastructure/native/deepgramFetch.ts`, update auth route handling:

```ts
if (request.path === '/v1/auth/grant' || request.path === '/v1/auth/token') {
  return proxyResponseToFetchResponse(
    await invoke<DeepgramProxyResponse>('deepgram_auth_token', { apiKey })
  );
}
```

Keep `/v1/auth/token` as a local compatibility alias so existing settings tests do not break while the app moves to the official grant path.

- [ ] **Step 4: Call Deepgram's official grant endpoint in Rust**

In `src-tauri/src/lib.rs`, change `deepgram_auth_token`:

```rust
#[tauri::command]
async fn deepgram_auth_token(api_key: String) -> Result<DeepgramProxyResponse, String> {
    let response = reqwest::Client::new()
        .post("https://api.deepgram.com/v1/auth/grant")
        .header("Accept", "application/json")
        .header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|error| format!("Deepgram auth request failed: {error}"))?;

    response_to_proxy_response(response).await
}
```

- [ ] **Step 5: Run token bridge tests and Rust format**

Run:

```powershell
npm run test:run -- tests/infrastructure/native/deepgramFetch.test.ts
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; cargo fmt --check
```

Expected: PASS.

- [ ] **Step 6: Commit token grant bridge**

Run:

```powershell
git add src/infrastructure/native/deepgramFetch.ts tests/infrastructure/native/deepgramFetch.test.ts src-tauri/src/lib.rs
git commit -m "fix: use Deepgram auth grant for streaming tokens"
```

## Task 3: Implement Deepgram Streaming Speech Provider

**Files:**
- Create: `src/domain/speech/deepgramStreamingProvider.ts`
- Test: `tests/domain/speech/deepgramStreamingProvider.test.ts`

- [ ] **Step 1: Write failing Deepgram streaming tests**

Create `tests/domain/speech/deepgramStreamingProvider.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeepgramStreamingSpeechProvider } from '../../src/domain/speech/deepgramStreamingProvider';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];

  constructor(readonly url: string, readonly protocols?: string | string[]) {
    MockWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.onclose?.();
  }
}

describe('createDeepgramStreamingSpeechProvider', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it('opens Deepgram listen with German endpointing and interim results', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });

    const sessionPromise = provider.startTranscription({
      language: 'de',
      model: 'nova-3',
      endpointingMs: 450,
      interimResults: true,
      punctuate: true,
      smartFormat: true,
    });
    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    await sessionPromise;

    expect(socket.url).toContain('wss://api.deepgram.com/v1/listen?');
    expect(socket.url).toContain('model=nova-3');
    expect(socket.url).toContain('language=de');
    expect(socket.url).toContain('endpointing=450');
    expect(socket.url).toContain('interim_results=true');
    expect(socket.url).toContain('punctuate=true');
    expect(socket.url).toContain('smart_format=true');
    expect(socket.protocols).toEqual(['token', 'temporary-token']);
  });

  it('buffers finalized pieces until speech_final creates one learner turn', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });
    const sessionPromise = provider.startTranscription({
      language: 'de',
      model: 'nova-3',
      endpointingMs: 450,
      interimResults: true,
      punctuate: true,
      smartFormat: true,
    });
    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    const session = await sessionPromise;
    const events: unknown[] = [];
    session.onEvent(event => events.push(event));

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'Results',
        is_final: true,
        speech_final: false,
        channel: { alternatives: [{ transcript: 'Ich mochte', confidence: 0.91 }] },
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: 'Results',
        is_final: true,
        speech_final: true,
        channel: { alternatives: [{ transcript: 'einen Kaffee.', confidence: 0.93 }] },
      }),
    });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'final',
        turn: expect.objectContaining({
          speaker: 'learner',
          text: 'Ich mochte einen Kaffee.',
          provider: 'deepgram',
        }),
      })
    );
  });

  it('sends TTS text and flush commands over Deepgram speak WebSocket', async () => {
    const provider = createDeepgramStreamingSpeechProvider({
      tokenProvider: vi.fn().mockResolvedValue('temporary-token'),
      WebSocketCtor: MockWebSocket,
      now: () => '2026-05-16T12:00:00.000Z',
    });

    const sessionPromise = provider.startSynthesis({
      ttsModel: 'aura-2-viktoria-de',
      encoding: 'mp3',
      speed: 1,
    });
    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    const session = await sessionPromise;

    session.sendText('Hallo, wie geht es dir?');
    session.flush();

    expect(socket.url).toContain('wss://api.deepgram.com/v1/speak?');
    expect(socket.url).toContain('model=aura-2-viktoria-de');
    expect(socket.url).toContain('encoding=mp3');
    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'Speak', text: 'Hallo, wie geht es dir?' }),
      JSON.stringify({ type: 'Flush' }),
    ]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test:run -- tests/domain/speech/deepgramStreamingProvider.test.ts
```

Expected: FAIL because `deepgramStreamingProvider.ts` does not exist.

- [ ] **Step 3: Implement the provider**

Create `src/domain/speech/deepgramStreamingProvider.ts`:

```ts
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
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  send(data: unknown): void;
  close(): void;
};

type WebSocketCtor = new (url: string, protocols?: string | string[]) => WebSocketLike;

interface DeepgramStreamingProviderOptions {
  tokenProvider: () => Promise<string>;
  WebSocketCtor?: WebSocketCtor;
  listenUrl?: string;
  speakUrl?: string;
  now?: () => string;
}

const DEFAULT_LISTEN_URL = 'wss://api.deepgram.com/v1/listen';
const DEFAULT_SPEAK_URL = 'wss://api.deepgram.com/v1/speak';

export function createDeepgramStreamingSpeechProvider(
  options: DeepgramStreamingProviderOptions
): StreamingSpeechProvider {
  const WebSocketClass = options.WebSocketCtor ?? WebSocket;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    async startTranscription(sttOptions) {
      const token = await options.tokenProvider();
      const socket = new WebSocketClass(buildListenUrl(options.listenUrl ?? DEFAULT_LISTEN_URL, sttOptions), [
        'token',
        token,
      ]);
      return openTranscriptionSession(socket, now);
    },
    async startSynthesis(ttsOptions) {
      const token = await options.tokenProvider();
      const socket = new WebSocketClass(buildSpeakUrl(options.speakUrl ?? DEFAULT_SPEAK_URL, ttsOptions), [
        'token',
        token,
      ]);
      return openSynthesisSession(socket);
    },
  };
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
    const message = JSON.parse(event.data) as {
      type?: string;
      is_final?: boolean;
      speech_final?: boolean;
      channel?: { alternatives?: Array<{ transcript?: string; confidence?: number }> };
    };

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
        piece: { text, isFinal: false, speechFinal: false, confidence: alternative?.confidence },
      });
      return;
    }

    finalizedPieces.push(text);
    const rawText = finalizedPieces.join(' ').replace(/\s+/g, ' ').trim();

    if (message.speech_final) {
      finalizedPieces.length = 0;
      emit({
        type: 'final',
        piece: { text: rawText, isFinal: true, speechFinal: true, confidence: alternative?.confidence },
        turn: createTranscriptTurn({
          speaker: 'learner',
          text: rawText,
          occurredAt: now(),
          confidence: alternative?.confidence,
          provider: 'deepgram',
        }),
      });
    }
  };

  socket.onerror = () => emit({ type: 'error', error: new Error('Deepgram transcription socket failed') });
  socket.onclose = () => emit({ type: 'closed' });

  return new Promise(resolve => {
    socket.onopen = () => {
      resolve({
        id,
        sendAudio: chunk => socket.send(chunk),
        finalize: () => socket.send(JSON.stringify({ type: 'Finalize' })),
        close: () => socket.close(),
        onEvent(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
    };
  });
}

function openSynthesisSession(socket: WebSocketLike): Promise<StreamingTextToSpeechSession> {
  const listeners = new Set<(event: StreamingSpeechAudioEvent) => void>();
  const id = `deepgram-tts-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

  const emit = (event: StreamingSpeechAudioEvent) => {
    listeners.forEach(listener => listener(event));
  };

  socket.onmessage = event => {
    if (typeof event.data === 'string') {
      const message = JSON.parse(event.data) as { type?: string; message?: string };
      if (message.type === 'Flushed') {
        emit({ type: 'flushed' });
      } else if (message.type === 'Cleared') {
        emit({ type: 'cleared' });
      } else if (message.type === 'Warning') {
        emit({ type: 'warning', warning: message.message });
      }
      return;
    }

    emit({ type: 'audio', audio: event.data, mimeType: 'audio/mpeg' });
  };
  socket.onerror = () => emit({ type: 'error', error: new Error('Deepgram synthesis socket failed') });
  socket.onclose = () => emit({ type: 'closed' });

  return new Promise(resolve => {
    socket.onopen = () => {
      resolve({
        id,
        sendText: text => socket.send(JSON.stringify({ type: 'Speak', text })),
        flush: () => socket.send(JSON.stringify({ type: 'Flush' })),
        clear: () => socket.send(JSON.stringify({ type: 'Clear' })),
        close: () => socket.close(),
        onEvent(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
    };
  });
}
```

- [ ] **Step 4: Run the focused test**

Run:

```powershell
npm run test:run -- tests/domain/speech/deepgramStreamingProvider.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the Deepgram streaming provider**

Run:

```powershell
git add src/domain/speech/deepgramStreamingProvider.ts tests/domain/speech/deepgramStreamingProvider.test.ts
git commit -m "feat: add Deepgram streaming speech provider"
```

## Task 4: Add OpenRouter Streaming Text Provider

**Files:**
- Create: `src/domain/ai/streamingAiProvider.ts`
- Create: `src/domain/ai/openRouterStreamingProvider.ts`
- Test: `tests/domain/ai/openRouterStreamingProvider.test.ts`

- [ ] **Step 1: Write failing OpenRouter streaming tests**

Create `tests/domain/ai/openRouterStreamingProvider.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterStreamingProvider } from '../../src/domain/ai/openRouterStreamingProvider';

describe('createOpenRouterStreamingProvider', () => {
  it('streams text deltas and ignores SSE comments', async () => {
    const body = [
      ': OPENROUTER PROCESSING',
      '',
      'data: {"choices":[{"delta":{"content":"Hallo"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"!"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    );
    const provider = createOpenRouterStreamingProvider({
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
      fetchFn,
    });
    const chunks: string[] = [];

    for await (const chunk of provider.streamText({
      feature: 'conversation-live-tutor',
      messages: [{ role: 'user', content: 'Sag hallo.' }],
      options: { maxTokens: 80, temperature: 0.4 },
    })) {
      chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['Hallo', '!']);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openrouter-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'Sag hallo.' }],
          temperature: 0.4,
          max_tokens: 80,
          stream: true,
        }),
      })
    );
  });

  it('throws a retryable error for rate limits', async () => {
    const provider = createOpenRouterStreamingProvider({
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
      fetchFn: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Rate limited' } }), { status: 429 })
      ),
    });

    await expect(async () => {
      for await (const _ of provider.streamText({
        feature: 'conversation-live-tutor',
        messages: [{ role: 'user', content: 'Hallo' }],
      })) {
        // consume
      }
    }).rejects.toMatchObject({
      provider: 'openrouter',
      feature: 'conversation-live-tutor',
      retryable: true,
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test:run -- tests/domain/ai/openRouterStreamingProvider.test.ts
```

Expected: FAIL because the streaming provider files do not exist.

- [ ] **Step 3: Add streaming AI contract**

Create `src/domain/ai/streamingAiProvider.ts`:

```ts
import type { AiMessage, AiGenerationOptions } from './aiProvider';

export interface StreamingAiTextRequest {
  feature: string;
  messages: AiMessage[];
  options?: AiGenerationOptions;
  signal?: AbortSignal;
}

export interface StreamingAiTextChunk {
  text: string;
  providerMetadata?: Record<string, unknown>;
}

export interface StreamingAiProvider {
  id: string;
  displayName: string;
  streamText(request: StreamingAiTextRequest): AsyncIterable<StreamingAiTextChunk>;
}
```

- [ ] **Step 4: Implement OpenRouter streaming adapter**

Create `src/domain/ai/openRouterStreamingProvider.ts`:

```ts
import {
  AiProviderError,
  type AiMessage,
} from './aiProvider';
import type {
  StreamingAiProvider,
  StreamingAiTextChunk,
  StreamingAiTextRequest,
} from './streamingAiProvider';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface OpenRouterStreamingOptions {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  appTitle?: string;
  siteUrl?: string;
  fetchFn?: FetchLike;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export function createOpenRouterStreamingProvider(options: OpenRouterStreamingOptions): StreamingAiProvider {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    async *streamText(request: StreamingAiTextRequest): AsyncIterable<StreamingAiTextChunk> {
      if (!options.apiKey?.trim()) {
        throw new AiProviderError('OpenRouter API key is required', {
          provider: 'openrouter',
          feature: request.feature,
          retryable: false,
        });
      }

      const response = await fetchFn(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: request.signal,
        headers: createHeaders(options),
        body: JSON.stringify({
          model: request.options?.model ?? options.model,
          messages: messagesForRequest(request.messages),
          temperature: request.options?.temperature,
          max_tokens: request.options?.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new AiProviderError(`OpenRouter stream failed: ${await readErrorMessage(response)}`, {
          provider: 'openrouter',
          feature: request.feature,
          retryable: response.status === 429 || response.status >= 500,
        });
      }

      for await (const chunk of readOpenRouterSseChunks(response)) {
        yield { text: chunk };
      }
    },
  };
}

function createHeaders(options: OpenRouterStreamingOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options.siteUrl) {
    headers['HTTP-Referer'] = options.siteUrl;
  }
  if (options.appTitle) {
    headers['X-Title'] = options.appTitle;
  }
  return headers;
}

function messagesForRequest(messages: AiMessage[]): AiMessage[] {
  return messages.map(message => ({ role: message.role, content: message.content }));
}

async function* readOpenRouterSseChunks(response: Response): AsyncIterable<string> {
  if (!response.body) {
    yield* parseOpenRouterSseBlock(await response.text());
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      yield* parseOpenRouterSseBlock(block);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    yield* parseOpenRouterSseBlock(buffer);
  }
}

function* parseOpenRouterSseBlock(text: string): Iterable<string> {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) {
      continue;
    }
    if (!trimmed.startsWith('data:')) {
      continue;
    }
    const data = trimmed.slice('data:'.length).trim();
    if (data === '[DONE]') {
      break;
    }
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) {
    return `HTTP ${response.status}`;
  }
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    return typeof parsed.error === 'string'
      ? parsed.error
      : parsed.error?.message ?? parsed.message ?? raw;
  } catch {
    return raw;
  }
}
```

- [ ] **Step 5: Run focused OpenRouter tests**

Run:

```powershell
npm run test:run -- tests/domain/ai/openRouterStreamingProvider.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the OpenRouter streaming provider**

Run:

```powershell
git add src/domain/ai/streamingAiProvider.ts src/domain/ai/openRouterStreamingProvider.ts tests/domain/ai/openRouterStreamingProvider.test.ts
git commit -m "feat: add OpenRouter streaming text provider"
```

## Task 5: Build Hands-Free Conversation Controller

**Files:**
- Create: `src/application/handsFreeConversation.ts`
- Test: `tests/application/handsFreeConversation.test.ts`

- [ ] **Step 1: Write failing controller tests**

Create `tests/application/handsFreeConversation.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createHandsFreeConversationController } from '../../src/application/handsFreeConversation';
import type { StreamingSpeechProvider } from '../../src/domain/speech/streamingSpeechProvider';
import type { StreamingAiProvider } from '../../src/domain/ai/streamingAiProvider';
import { ConversationMode } from '../../types';

function createSpeechProvider(): StreamingSpeechProvider {
  const sttListeners = new Set<(event: any) => void>();
  const ttsListeners = new Set<(event: any) => void>();
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    startTranscription: vi.fn().mockResolvedValue({
      id: 'stt-1',
      sendAudio: vi.fn(),
      finalize: vi.fn(),
      close: vi.fn(),
      onEvent: listener => {
        sttListeners.add(listener);
        return () => sttListeners.delete(listener);
      },
      emit: event => sttListeners.forEach(listener => listener(event)),
    }),
    startSynthesis: vi.fn().mockResolvedValue({
      id: 'tts-1',
      sendText: vi.fn(),
      flush: vi.fn(),
      clear: vi.fn(),
      close: vi.fn(),
      onEvent: listener => {
        ttsListeners.add(listener);
        return () => ttsListeners.delete(listener);
      },
    }),
  } as unknown as StreamingSpeechProvider;
}

function createAiProvider(): StreamingAiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    async *streamText() {
      yield { text: 'Fast richtig. ' };
      yield { text: 'Was trinkst du gern?' };
    },
  };
}

describe('createHandsFreeConversationController', () => {
  it('turns a final learner transcript into a tutor reply and returns to listening', async () => {
    const speechProvider = createSpeechProvider();
    const aiProvider = createAiProvider();
    const appendTranscript = vi.fn().mockResolvedValue(undefined);
    const controller = createHandsFreeConversationController({
      speechProvider,
      aiProvider,
      conversationRepository: {
        startSession: vi.fn().mockResolvedValue('session-1'),
        appendTranscript,
        endSession: vi.fn().mockResolvedValue(undefined),
        loadRecentSessions: vi.fn(),
        loadLastFeedback: vi.fn(),
      },
      learnerId: 'local-learner',
      level: 'A2',
      motherLanguage: 'English',
      mode: ConversationMode.FREE_CONVERSATION,
      now: () => '2026-05-16T12:00:00.000Z',
    });
    const states: string[] = [];
    controller.onStateChange(state => states.push(state.status));

    await controller.start();
    const sttSession = await vi.mocked(speechProvider.startTranscription).mock.results[0].value;
    sttSession.emit({
      type: 'final',
      turn: {
        speaker: 'learner',
        text: 'Ich mochte einen Kaffee.',
        occurredAt: '2026-05-16T12:00:00.000Z',
        provider: 'deepgram',
      },
    });
    await controller.waitForIdle();

    expect(states).toEqual(expect.arrayContaining(['connecting', 'listening', 'thinking', 'speaking']));
    expect(controller.getState().status).toBe('listening');
    expect(controller.getState().turns.map(turn => turn.text)).toEqual([
      'Ich mochte einen Kaffee.',
      'Fast richtig. Was trinkst du gern?',
    ]);
    expect(appendTranscript).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the failing controller test**

Run:

```powershell
npm run test:run -- tests/application/handsFreeConversation.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the controller state and start flow**

Create `src/application/handsFreeConversation.ts`:

```ts
import type { StreamingAiProvider } from '../domain/ai/streamingAiProvider';
import type { ConversationRepository } from '../domain/conversation/conversationRepository';
import type { StreamingSpeechProvider } from '../domain/speech/streamingSpeechProvider';
import { createTranscriptTurn, type TranscriptTurn } from '../domain/speech/transcriptTypes';
import type { CEFRLevel, ConversationMode } from '../../types';
import type { AiMessage } from '../domain/ai/aiProvider';

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

export interface HandsFreeConversationController {
  start(): Promise<void>;
  pause(): void;
  resume(): void;
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
  topic?: string;
  description?: string;
  now?: () => string;
}

export function createHandsFreeConversationController(
  input: HandsFreeConversationInput
): HandsFreeConversationController {
  const now = input.now ?? (() => new Date().toISOString());
  const listeners = new Set<(state: HandsFreeConversationState) => void>();
  let state: HandsFreeConversationState = {
    status: 'idle',
    turns: [],
    interimTranscript: '',
    currentTutorText: '',
    errorMessage: null,
  };
  let sessionId: string | null = null;
  let startedAt: string | null = null;
  let idleWaiters: Array<() => void> = [];
  let sttSession: Awaited<ReturnType<StreamingSpeechProvider['startTranscription']>> | null = null;
  let ttsSession: Awaited<ReturnType<StreamingSpeechProvider['startSynthesis']>> | null = null;

  const setState = (patch: Partial<HandsFreeConversationState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener(state));
    if (state.status === 'listening') {
      idleWaiters.splice(0).forEach(resolve => resolve());
    }
  };

  const handleFinalLearnerTurn = async (learnerTurn: TranscriptTurn) => {
    const turnsWithLearner = [...state.turns, learnerTurn];
    setState({ status: 'thinking', turns: turnsWithLearner, interimTranscript: '', currentTutorText: '' });
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
      text: tutorText.trim(),
      occurredAt: now(),
      provider: input.aiProvider.id,
    });
    const fullTurns = [...turnsWithLearner, tutorTurn];
    setState({ status: 'speaking', turns: fullTurns, currentTutorText: tutorTurn.text });
    if (sessionId) {
      await input.conversationRepository.appendTranscript(sessionId, tutorTurn);
    }

    ttsSession = await input.speechProvider.startSynthesis({
      ttsModel: 'aura-2-viktoria-de',
      encoding: 'mp3',
      speed: 1,
    });
    ttsSession.sendText(tutorTurn.text);
    ttsSession.flush();
    setState({ status: 'listening', currentTutorText: '' });
  };

  return {
    async start() {
      setState({ status: 'connecting', errorMessage: null, turns: [] });
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
        if (event.type === 'final' && event.turn) {
          void handleFinalLearnerTurn(event.turn).catch(error => {
            setState({
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Conversation turn failed',
            });
          });
        }
      });
      setState({ status: 'listening' });
    },
    pause() {
      setState({ status: 'paused' });
    },
    resume() {
      setState({ status: 'listening' });
    },
    interrupt() {
      ttsSession?.clear();
      setState({ status: 'listening', currentTutorText: '' });
    },
    async end() {
      setState({ status: 'ending' });
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
      return () => listeners.delete(listener);
    },
    waitForIdle() {
      if (state.status === 'listening') {
        return Promise.resolve();
      }
      return new Promise(resolve => idleWaiters.push(resolve));
    },
  };
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
```

- [ ] **Step 4: Run controller tests**

Run:

```powershell
npm run test:run -- tests/application/handsFreeConversation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit controller slice**

Run:

```powershell
git add src/application/handsFreeConversation.ts tests/application/handsFreeConversation.test.ts
git commit -m "feat: add hands-free conversation controller"
```

## Task 6: Wire Streaming Providers Into Runtime

**Files:**
- Modify: `src/application/providerRuntime.ts`
- Modify: `MainApp.tsx`
- Modify: `tests/MainApp.providerRuntime.test.tsx`

- [ ] **Step 1: Write failing runtime test**

In `tests/MainApp.providerRuntime.test.tsx`, extend the existing `SpeakingActivityPage` mock to capture streaming props:

```ts
const speakingPageProps = vi.hoisted(() => ({
  latest: null as null | {
    aiProvider?: { id: string };
    speechProvider?: { id: string };
    streamingAiProvider?: { id: string };
    streamingSpeechProvider?: { id: string };
  },
}));

vi.mock('../pages/SpeakingActivityPage', () => ({
  default: (props: typeof speakingPageProps.latest) => {
    speakingPageProps.latest = props;
    return <main>Conversation</main>;
  },
}));
```

Add:

```ts
it('passes streaming providers into the conversation route when providers are configured', async () => {
  providerSettingsRepository.load.mockResolvedValue({
    ai: {
      enabled: true,
      provider: 'openrouter',
      apiKey: 'openrouter-key',
      model: 'openrouter/auto',
    },
    speech: {
      enabled: true,
      provider: 'deepgram',
      apiKey: 'deepgram-key',
      model: 'nova-3',
      ttsModel: 'aura-2-viktoria-de',
      language: 'de',
    },
  });

  const { default: MainApp } = await import('../MainApp');

  render(
    <MemoryRouter initialEntries={['/conversation']}>
      <MainApp />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(speakingPageProps.latest?.streamingAiProvider?.id).toBe('openrouter');
    expect(speakingPageProps.latest?.streamingSpeechProvider?.id).toBe('deepgram');
  });
});
```

- [ ] **Step 2: Run failing runtime test**

Run:

```powershell
npm run test:run -- tests/MainApp.providerRuntime.test.tsx
```

Expected: FAIL because streaming provider factories are not wired.

- [ ] **Step 3: Extend provider runtime result**

In `src/application/providerRuntime.ts`, add:

```ts
import type { StreamingAiProvider } from '../domain/ai/streamingAiProvider';
import { createOpenRouterStreamingProvider } from '../domain/ai/openRouterStreamingProvider';
import type { StreamingSpeechProvider } from '../domain/speech/streamingSpeechProvider';
import { createDeepgramStreamingSpeechProvider } from '../domain/speech/deepgramStreamingProvider';

export interface ProviderRuntime {
  aiProvider: AiProvider | null;
  speechProvider: SpeechProvider | null;
  streamingAiProvider: StreamingAiProvider | null;
  streamingSpeechProvider: StreamingSpeechProvider | null;
}
```

When settings are configured, create streaming providers:

```ts
streamingAiProvider: settings.ai.enabled && settings.ai.apiKey
  ? createOpenRouterStreamingProvider({
      apiKey: settings.ai.apiKey,
      model: settings.ai.model,
      appTitle: 'DeutschBoost',
      siteUrl: 'https://deutschboost.local',
    })
  : null,
streamingSpeechProvider: settings.speech.enabled && settings.speech.apiKey
  ? createDeepgramStreamingSpeechProvider({
      tokenProvider: async () => {
        const response = await (dependencies.fetchFn ?? fetch)('/api/deepgram/v1/auth/grant', {
          method: 'POST',
          headers: { Authorization: `Token ${settings.speech.apiKey}` },
        });
        const body = await response.json() as { access_token?: string };
        if (!body.access_token) {
          throw new Error('Deepgram temporary token response did not include an access token');
        }
        return body.access_token;
      },
    })
  : null,
```

Remove `const provider = ...` if the existing factory does not need side effects after implementation.

- [ ] **Step 4: Pass streaming providers into conversation page**

In `MainApp.tsx`, update the `/conversation` route:

```tsx
<SpeakingActivityPage
  aiProvider={providerRuntime.aiProvider ?? undefined}
  speechProvider={providerRuntime.speechProvider ?? undefined}
  streamingAiProvider={providerRuntime.streamingAiProvider ?? undefined}
  streamingSpeechProvider={providerRuntime.streamingSpeechProvider ?? undefined}
/>
```

- [ ] **Step 5: Run runtime tests**

Run:

```powershell
npm run test:run -- tests/MainApp.providerRuntime.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit runtime wiring**

Run:

```powershell
git add src/application/providerRuntime.ts MainApp.tsx tests/MainApp.providerRuntime.test.tsx
git commit -m "feat: wire streaming providers into conversation"
```

## Task 7: Add Hands-Free Conversation UI

**Files:**
- Modify: `pages/SpeakingActivityPage.tsx`
- Modify: `tests/pages/SpeakingActivityPage.test.tsx`

- [ ] **Step 1: Write failing component test**

Add to `tests/pages/SpeakingActivityPage.test.tsx`:

```ts
it('runs a hands-free live practice turn when streaming providers are available', async () => {
  const aiProvider = createAiProvider();
  const speechProvider = createSpeechProvider();
  const streamingAiProvider = {
    id: 'openrouter',
    displayName: 'OpenRouter',
    async *streamText() {
      yield { text: 'Sehr gut. ' };
      yield { text: 'Was machst du morgen?' };
    },
  };
  const sttListeners = new Set<(event: any) => void>();
  const streamingSpeechProvider = {
    id: 'deepgram',
    displayName: 'Deepgram',
    startTranscription: vi.fn().mockResolvedValue({
      id: 'stt-1',
      sendAudio: vi.fn(),
      finalize: vi.fn(),
      close: vi.fn(),
      onEvent: (listener: (event: any) => void) => {
        sttListeners.add(listener);
        return () => sttListeners.delete(listener);
      },
    }),
    startSynthesis: vi.fn().mockResolvedValue({
      id: 'tts-1',
      sendText: vi.fn(),
      flush: vi.fn(),
      clear: vi.fn(),
      close: vi.fn(),
      onEvent: vi.fn(),
    }),
  };
  const conversationRepository = createConversationRepository();

  render(
    <MemoryRouter initialEntries={['/conversation']}>
      <SpeakingActivityPage
        aiProvider={aiProvider}
        speechProvider={speechProvider}
        streamingAiProvider={streamingAiProvider}
        streamingSpeechProvider={streamingSpeechProvider}
        conversationRepository={conversationRepository}
      />
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Start live practice' }));
  expect(await screen.findByText(/Listening/i)).toBeInTheDocument();

  sttListeners.forEach(listener =>
    listener({
      type: 'final',
      turn: {
        speaker: 'learner',
        text: 'Ich gehe morgen ins Kino.',
        occurredAt: '2026-05-16T12:00:00.000Z',
        provider: 'deepgram',
      },
    })
  );

  expect(await screen.findByText('Ich gehe morgen ins Kino.')).toBeInTheDocument();
  expect(await screen.findByText('Sehr gut. Was machst du morgen?')).toBeInTheDocument();
  expect(streamingSpeechProvider.startSynthesis).toHaveBeenCalled();
  expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run failing component test**

Run:

```powershell
npm run test:run -- tests/pages/SpeakingActivityPage.test.tsx
```

Expected: FAIL because the page does not accept streaming props or show live-practice controls.

- [ ] **Step 3: Add streaming props and controller state**

In `pages/SpeakingActivityPage.tsx`, add imports:

```ts
import {
  createHandsFreeConversationController,
  type HandsFreeConversationController,
  type HandsFreeConversationState,
} from '../src/application/handsFreeConversation';
import type { StreamingAiProvider } from '../src/domain/ai/streamingAiProvider';
import type { StreamingSpeechProvider } from '../src/domain/speech/streamingSpeechProvider';
```

Extend props:

```ts
streamingAiProvider?: StreamingAiProvider;
streamingSpeechProvider?: StreamingSpeechProvider;
```

Add state:

```ts
const [liveState, setLiveState] = useState<HandsFreeConversationState>({
  status: 'idle',
  turns: [],
  interimTranscript: '',
  currentTutorText: '',
  errorMessage: null,
});
const liveControllerRef = useRef<HandsFreeConversationController | null>(null);
const streamingReady = Boolean(streamingAiProvider && streamingSpeechProvider);
```

Add handler:

```ts
async function handleStartLivePractice() {
  if (!streamingAiProvider || !streamingSpeechProvider) {
    setMessage('Live practice needs OpenRouter and Deepgram streaming providers.');
    return;
  }

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
  });
  liveControllerRef.current = controller;
  controller.onStateChange(nextState => {
    setLiveState(nextState);
    setTurns(nextState.turns);
  });
  await controller.start();
}
```

Add cleanup:

```ts
useEffect(() => {
  return () => {
    void liveControllerRef.current?.end();
  };
}, []);
```

- [ ] **Step 4: Add live controls above manual controls**

Add a primary live section:

```tsx
<div className="db-conversation-live-controls" aria-label="Live practice controls">
  <button
    type="button"
    className="db-primary-button"
    onClick={() => void handleStartLivePractice()}
    disabled={!streamingReady || !providersReady || liveState.status !== 'idle'}
  >
    Start live practice
  </button>
  {liveState.status !== 'idle' && liveState.status !== 'ended' ? (
    <>
      <button type="button" className="db-secondary-button" onClick={() => liveControllerRef.current?.pause()}>
        Pause
      </button>
      <button type="button" className="db-secondary-button" onClick={() => liveControllerRef.current?.interrupt()}>
        Interrupt
      </button>
      <button type="button" className="db-secondary-button" onClick={() => void liveControllerRef.current?.end()}>
        End session
      </button>
    </>
  ) : null}
  <span className="db-live-status">{formatLiveStatus(liveState.status)}</span>
</div>
{liveState.interimTranscript ? (
  <p className="db-interim-transcript">{liveState.interimTranscript}</p>
) : null}
{liveState.currentTutorText ? (
  <p className="db-streaming-tutor-text">{liveState.currentTutorText}</p>
) : null}
```

Label existing manual controls as fallback:

```tsx
<div className="db-conversation-fallback" aria-label="Fallback manual turn mode">
  <span className="db-section-label">Fallback</span>
  ...
</div>
```

Add helper:

```ts
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
```

- [ ] **Step 5: Run component test**

Run:

```powershell
npm run test:run -- tests/pages/SpeakingActivityPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit UI slice**

Run:

```powershell
git add pages/SpeakingActivityPage.tsx tests/pages/SpeakingActivityPage.test.tsx
git commit -m "feat: add hands-free conversation UI"
```

## Task 8: Verification, Packaged Smoke, Vault, And Release Gate

**Files:**
- Modify: `docs/release/native-release-readiness.md`

- [ ] **Step 1: Update release readiness docs**

Add a Conversation v2 gate:

```md
Known release note: the next desktop release after v0.0.3 must smoke-test Conversation v2 hands-free mode in the packaged Tauri app. Required checks: saved providers load, Start live practice reaches Listening, a German learner turn becomes a final transcript, OpenRouter tutor text streams, Deepgram TTS plays the reply, Interrupt returns to Listening, End session saves locally, and fallback manual turn mode still works.
```

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npm run test:run -- tests/infrastructure/native/deepgramFetch.test.ts tests/domain/speech/deepgramStreamingProvider.test.ts tests/domain/ai/openRouterStreamingProvider.test.ts tests/application/handsFreeConversation.test.ts tests/MainApp.providerRuntime.test.tsx tests/pages/SpeakingActivityPage.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full tests and production build**

Run:

```powershell
npm run test:run
npm run build
```

Expected: Vitest passes and Vite build exits 0. Existing chunk-size warnings may remain.

- [ ] **Step 4: Run Rust and Tauri verification**

Run:

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; cargo fmt --check
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; npm run tauri:build
```

Expected: Rust format check passes and Tauri builds a Windows installer.

- [ ] **Step 5: Packaged desktop smoke**

Launch the release executable with WebView2 debugging:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'; Start-Process -FilePath "C:\Users\Mini\Desktop\Projects\DeutschBoost\src-tauri\target\release\deutschboost.exe" -WorkingDirectory "C:\Users\Mini\Desktop\Projects\DeutschBoost\src-tauri\target\release"
```

Required checks:

- App is not blank.
- Settings shows OpenRouter and Deepgram configured from local storage/Stronghold.
- Conversation shows `Start live practice` as the primary action.
- Starting live practice reaches `Listening`.
- A short German learner utterance creates a final learner transcript.
- Tutor text appears.
- Tutor audio plays through Deepgram.
- Interrupt returns to listening.
- End session saves locally.
- Fallback manual record/send still works.

- [ ] **Step 6: Save Vault memory**

Save a Vault memory with:

- Decision implemented: Conversation v2 hands-free default uses Deepgram streaming STT, OpenRouter streaming replies, and Deepgram TTS.
- Files changed.
- Test/build/smoke evidence.
- Open loops still not closed without user confirmation: Gemini Live optional mode, Deepgram Voice Agent spike, Android/APK, local repositories, release hygiene.

- [ ] **Step 7: Commit verification docs**

Run:

```powershell
git add docs/release/native-release-readiness.md
git commit -m "docs: add conversation v2 release gate"
```

- [ ] **Step 8: Release rule**

Do not push a new tag or release until all verification in this task passes in the packaged desktop app.

## Self-Review Notes

- This plan deliberately keeps Gemini Live out of the implementation cycle.
- This plan keeps the current manual flow as fallback instead of deleting it.
- The first streaming implementation uses browser/WebView WebSocket plus temporary Deepgram tokens. If packaged desktop smoke shows WebSocket auth/protocol issues, switch the Deepgram streaming provider transport to the official Tauri WebSocket plugin as a contained follow-up without changing the app-level controller.
- The OpenRouter streaming adapter must parse `ReadableStream` chunks incrementally. A full `response.text()` fallback is only acceptable for test environments without a response body stream.
