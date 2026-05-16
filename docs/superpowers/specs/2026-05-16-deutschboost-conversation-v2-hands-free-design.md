# DeutschBoost Conversation v2 Hands-Free Design

Status: approved provider balance, ready for implementation planning
Date: 2026-05-16

## Purpose

Conversation should stop feeling like a recorder workflow. The target first release is a hands-free turn-taking session: the learner presses one start button, speaks naturally, the app detects the end of the learner's turn, sends the final utterance to the tutor, plays the tutor reply through Deepgram, and returns to listening.

The default provider balance is:

- Deepgram streaming speech-to-text for learner audio.
- OpenRouter streaming chat for tutor reasoning and text.
- Deepgram text-to-speech for tutor playback.
- Manual record/send remains available as fallback.
- Gemini Live remains a documented optional future mode for true realtime interruption/barge-in, not the default implementation.

## Current State

The app currently has a working provider-backed turn mode:

- `pages/SpeakingActivityPage.tsx` starts a local conversation session, records one learner audio sample, stops on button press, sends the sample through `runTurnBasedConversationTurn`, appends learner and tutor turns locally, and can play tutor replies through `SpeechProvider.synthesize`.
- `src/application/turnBasedConversation.ts` coordinates prerecorded Deepgram STT and OpenRouter text generation for one complete turn.
- `src/domain/speech/speechProvider.ts` supports prerecorded `transcribe()` and REST-style `synthesize()`.
- `src/domain/speech/deepgramProvider.ts` implements Deepgram prerecorded `/v1/listen` and `/v1/speak` through the existing fetch abstraction.
- `src/infrastructure/native/deepgramFetch.ts` and `src-tauri/src/lib.rs` proxy REST Deepgram calls in desktop builds so API keys are not handled as plain endpoint URLs.

The missing piece is a streaming session controller that can keep the microphone and WebSocket state alive while still fitting the app's local-first storage and provider abstractions.

## Researched Constraints

Deepgram streaming STT uses `wss://api.deepgram.com/v1/listen`. It supports temporary bearer tokens or API-key auth, binary audio frames, `Finalize`, `CloseStream`, `KeepAlive`, `SpeechStarted`, `UtteranceEnd`, `is_final`, and `speech_final`. For a complete learner turn, finalized transcripts should be buffered and concatenated until `speech_final: true` arrives; `speech_final` alone is not enough for long utterances.

Deepgram streaming TTS uses `wss://api.deepgram.com/v1/speak`. It accepts text messages plus flush/clear/close commands and returns binary audio chunks as they are generated. In client environments where custom WebSocket headers are hard, Deepgram documents `Sec-WebSocket-Protocol` as the browser-friendly path, with `token` plus the temporary token/API key sent as WebSocket subprotocol values.

OpenRouter supports streaming chat completions by setting `stream: true`; responses arrive as SSE chunks and can be cancelled with `AbortController`. This is enough for lower-latency text rendering and sentence buffering, but it is not a Gemini-Live-equivalent bidirectional speech socket.

Tauri has an official WebSocket plugin for opening WebSocket connections from JavaScript through a Rust client across desktop and mobile. For this first Conversation v2 implementation, the browser-native WebSocket path with short-lived Deepgram tokens is simpler and easier to test. The Tauri plugin remains the fallback path if desktop WebView header/protocol behavior blocks reliable Deepgram sockets.

## Approaches Considered

### Approach A: Cascaded Hands-Free Pipeline

Use Deepgram streaming STT for learner input, OpenRouter streaming text for the tutor, and Deepgram TTS for reply playback. Keep manual turn mode as a fallback.

Pros:

- Matches the approved provider balance.
- Improves UX without reintroducing Gemini Live as a required provider.
- Reuses current OpenRouter, Deepgram, settings, and local transcript storage.
- Easy to test with mocked streaming adapters.

Cons:

- Not true full-duplex live voice.
- Barge-in must be limited to a controlled "interrupt/pause" action in this cycle.

Recommendation: implement this first.

### Approach B: Deepgram Voice Agent Spike

Use Deepgram Voice Agent as a single voice pipeline and configure STT, LLM, TTS, and endpointing through Deepgram.

Pros:

- Potentially less custom orchestration.
- Could deliver a smoother voice-agent feel.

Cons:

- Less direct control over local tutor prompts, OpenRouter model choice, transcript shape, and cost visibility.
- Higher integration risk for this release.
- Would need separate research and proof-of-concept before replacing the current app flow.

Recommendation: keep as a later spike, not this implementation.

### Approach C: Gemini Live Optional Mode Now

Add Gemini Live back immediately as a second conversation provider.

Pros:

- Best true realtime voice behavior.
- Cleaner interruption/barge-in semantics.

Cons:

- Adds a second provider/key/settings surface before the default path is stable.
- More expensive and less aligned with the local-first OpenRouter/Deepgram default.
- Reopens legacy code paths that were intentionally removed.

Recommendation: document it as a premium/live future mode after Conversation v2 is stable.

## Target UX

The Conversation page becomes a voice session surface with a clear state machine:

- `needs-settings`: OpenRouter or Deepgram is missing.
- `idle`: ready to start.
- `connecting`: Deepgram token/WebSocket and local session setup are starting.
- `listening`: microphone is live and interim transcript can update.
- `thinking`: learner turn is final and OpenRouter is generating the tutor reply.
- `speaking`: Deepgram TTS is playing the tutor reply.
- `paused`: user paused the session without ending it.
- `ending`: final feedback and local save are running.
- `ended`: session saved.
- `fallback`: manual record/send mode is active.
- `error`: recoverable failure state.

The learner's main workflow:

1. Press `Start live practice`.
2. Speak German.
3. See interim transcript while speaking.
4. Pause naturally; endpointing finalizes the turn.
5. See tutor text stream in.
6. Hear tutor audio through Deepgram.
7. The app returns to listening.

Controls:

- Start live practice.
- Pause/resume.
- Interrupt reply, which stops TTS playback and returns to listening.
- End session.
- Fallback manual mode, clearly secondary.

No free-text language or provider settings are introduced. Conversation mode remains selected from existing mode options.

## Architecture

Add a streaming layer next to the existing REST-style provider layer instead of overloading `SpeechProvider.transcribe()`.

New units:

- `src/domain/speech/streamingSpeechProvider.ts`: provider-neutral streaming STT and TTS contracts, transcript event types, audio output event types, and session lifecycle interfaces.
- `src/domain/speech/deepgramStreamingProvider.ts`: Deepgram WebSocket STT/TTS implementation, backed by short-lived auth tokens from the existing Deepgram key.
- `src/domain/ai/streamingAiProvider.ts`: optional `streamText()` contract for OpenRouter, keeping existing `generateText()` intact.
- `src/domain/ai/openRouterStreamingProvider.ts`: OpenRouter SSE chat completion streaming parser.
- `src/application/handsFreeConversation.ts`: orchestration state machine that connects STT, AI, TTS, local repository writes, and session events.
- `pages/SpeakingActivityPage.tsx`: UI surface that consumes the state machine and keeps the old manual turn mode available.

The existing `runTurnBasedConversationTurn()` stays as fallback and as a stable testable baseline.

## Security And Provider Boundaries

Provider API keys stay in current local provider settings/secret storage. For Deepgram streaming WebSockets, the renderer should not put the long-lived API key in a WebSocket URL. Instead:

1. Use a Deepgram auth grant bridge to mint a short-lived token through `POST https://api.deepgram.com/v1/auth/grant`.
2. Connect WebSockets with `Authorization: Bearer <temporary token>` when possible.
3. In browser/WebView paths where custom WebSocket headers are not available, use the documented `Sec-WebSocket-Protocol` auth path with the temporary token.

OpenRouter streaming can continue through `fetch` with the existing provider key, because the current OpenRouter adapter already operates in the renderer/provider boundary. A later native proxy can harden OpenRouter streaming too, but it should not block this slice unless a packaged smoke test reveals a concrete risk.

## Error Handling

The session controller should classify failures:

- Microphone permission denied: show a direct settings/device message.
- Deepgram token failure: show provider settings link and keep manual fallback disabled until fixed.
- STT socket disconnect: stop listening, preserve transcript, offer reconnect.
- Empty final utterance: ignore once; after repeated empty turns, show a mic/input hint.
- OpenRouter error: keep the learner turn, show retry tutor reply.
- TTS error: show text reply and offer replay/fallback.
- Playback interruption: cancel current audio and return to listening.

The session should never lose already-finalized transcript turns when a provider call fails.

## Testing Strategy

Unit tests:

- Deepgram streaming STT builds the correct URL/query and buffers `is_final` transcript pieces until `speech_final`.
- Deepgram streaming STT emits interim transcript updates without committing them as final turns.
- Deepgram streaming TTS sends text and flush commands, emits binary audio chunks, and closes cleanly.
- OpenRouter streaming parser ignores SSE comments and yields text deltas.
- Hands-free controller transitions through listening -> thinking -> speaking -> listening.
- Hands-free controller preserves transcript on OpenRouter/TTS errors.

Component tests:

- Conversation page shows `Start live practice` as the primary action.
- A mocked final STT event produces a learner bubble, streamed tutor bubble, and provider-backed audio playback.
- Pause, resume, interrupt, end session, and fallback manual mode work without free-text provider inputs.

Packaged smoke before release:

- Saved OpenRouter/Deepgram settings load.
- Start live practice reaches listening state.
- Speaking a short German sentence creates a final learner transcript.
- Tutor reply appears and audio plays through Deepgram.
- Interrupt returns to listening.
- End session saves transcript and feedback locally.
- Manual fallback still works.

## Acceptance Criteria

- The default Conversation page no longer requires pressing record, stop, and send for every normal turn.
- The app can complete at least two hands-free conversation turns with Deepgram STT, OpenRouter tutor text, and Deepgram TTS.
- Manual record/send remains available as fallback, clearly labeled.
- Existing provider settings remain list-based and do not expose editable base URLs.
- Gemini Live is not reintroduced into active code in this cycle.
- Tests and packaged desktop smoke pass before any release tag.

## Sources Checked

- Deepgram streaming STT reference: `https://developers.deepgram.com/reference/speech-to-text/listen-streaming`
- Deepgram endpointing and interim results: `https://developers.deepgram.com/docs/understand-endpointing-interim-results`
- Deepgram streaming TTS guide: `https://developers.deepgram.com/docs/streaming-text-to-speech`
- Deepgram streaming TTS reference: `https://developers.deepgram.com/reference/text-to-speech/speak-streaming`
- Deepgram token grant reference: `https://developers.deepgram.com/reference/auth/tokens/grant`
- Deepgram `Sec-WebSocket-Protocol` guide: `https://developers.deepgram.com/docs/using-the-sec-websocket-protocol`
- OpenRouter streaming reference: `https://openrouter.ai/docs/api/reference/streaming`
- Tauri WebSocket plugin: `https://v2.tauri.app/plugin/websocket/`
