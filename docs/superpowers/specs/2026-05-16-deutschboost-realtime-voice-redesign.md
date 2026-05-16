# DeutschBoost Realtime Voice Redesign

Status: approved direction, pending implementation plan
Date: 2026-05-16

## Purpose

DeutschBoost should keep the local-first OpenRouter and Deepgram direction, but the voice experience must not feel like a clumsy recorder bolted onto a tutor. The current turn-based page is useful as a technical baseline, but the user rejected the manual "record, stop, send" interaction as the final UX and also found that playback still uses system text-to-speech in practice/listening flows.

This spec revises the voice architecture before the next desktop release. Release work stays paused until voice output and the conversation mode are honest, provider-backed, and verified in the packaged app.

## Current Problem

- `pages/ActivityPage.tsx` uses browser/system speech synthesis for vocabulary pronunciation and listening audio playback.
- `services/geminiService.ts` still exposes `speakText`, which wraps `window.speechSynthesis`.
- `pages/SpeakingActivityPage.tsx` plays tutor replies with `SpeechSynthesisUtterance`.
- `src/domain/speech/deepgramProvider.ts` currently implements prerecorded Deepgram speech-to-text only.
- The packaged app has no provider-backed text-to-speech path, so "Deepgram ready" in settings does not mean Deepgram audio output is used.
- The current conversation UX requires explicit stop/send for every turn. That is acceptable as a fallback, but not as the main voice experience.

## Research Summary

### Gemini Live

Gemini Live remains the strongest true realtime voice option for this product shape. It is a stateful WebSocket API that supports streaming audio input and audio output, with voice activity detection and interruption behavior. Google documents audio input as raw 16-bit PCM at 16 kHz and audio output as raw 16-bit PCM at 24 kHz.

Implication: Gemini Live should return as an optional provider for "Live conversation", not as a required dependency for all AI features.

### OpenRouter Audio

OpenRouter now supports audio input/output through chat completions and dedicated speech/transcription endpoints. Its speech endpoint converts text to audio; its transcription endpoint converts audio to text; chat audio output uses streaming chunks. The docs do not describe a single bidirectional low-latency realtime conversation socket equivalent to Gemini Live.

Implication: OpenRouter is still the right default for tutor reasoning, activity generation, evaluation, and text streaming. It should not be treated as a drop-in replacement for Gemini Live realtime voice.

### Deepgram

Deepgram supports realtime speech-to-text, REST and WebSocket text-to-speech, and a Voice Agent API that can run listening, thinking, and speaking over one WebSocket. German Aura-2 voices are available, including `aura-2-julius-de`, `aura-2-viktoria-de`, and other German models.

Implication: Deepgram should become the app's provider-backed voice layer for German audio output and transcript capture. The Voice Agent API deserves a separate spike because it may reduce our custom orchestration, but it should not block the immediate TTS/listening fix.

## Product Direction

DeutschBoost should support three voice modes through one application boundary:

1. **Live Conversation**
   - Optional Gemini Live provider.
   - Best UX for natural back-and-forth, interruption, and low-friction speaking.
   - Uses a separate Gemini Live key/model setting if the user enables it.
   - Not required for placement, text tutoring, plans, or activities.

2. **Near-Live Conversation**
   - Default local-first direction.
   - Deepgram streaming STT captures learner speech.
   - OpenRouter streams tutor text.
   - Deepgram streaming TTS speaks tutor output.
   - Uses automatic voice activity detection or silence detection so the user speaks naturally without manually pressing stop/send every turn.
   - Stores transcript, corrections, confidence, and useful mistakes locally.

3. **Fallback Turn Mode**
   - Manual record/send remains available when streaming is unavailable or disabled.
   - It must be clearly labeled as fallback.
   - It still uses provider-backed Deepgram transcription and Deepgram TTS when available.

## Immediate Release Fix

Before the next release, remove misleading system TTS behavior from active provider-backed flows:

- Listening practice audio should use Deepgram TTS when Deepgram is configured.
- Vocabulary pronunciation and example sentence playback should use Deepgram TTS when Deepgram is configured.
- Tutor reply playback should use Deepgram TTS when Deepgram is configured.
- System `speechSynthesis` may remain only as an explicitly labeled local fallback when no Deepgram TTS provider is available.
- Settings should show Deepgram capabilities more accurately: transcription and speech output are separate capabilities even if they share the same API key.

## Architecture

Add a provider boundary for speech output instead of calling browser APIs directly.

Recommended contracts:

- `SpeechProvider.transcribe(request)` remains for speech-to-text.
- Add `SpeechProvider.synthesize(request)` for text-to-speech in the immediate release fix. Keep one provider object for now because Deepgram supplies both STT and TTS behind one key.
- Add `SpeechSynthesisRequest` with:
  - `feature`
  - `text`
  - `voiceModel`
  - `language`
  - `format`
  - `speed`
- Add `SpeechSynthesisResult` with:
  - `audio`
  - `mimeType`
  - `providerMetadata`

Provider implementations:

- `createDeepgramSpeechProvider` should support:
  - prerecorded STT through `/v1/listen`
  - REST TTS through `/v1/speak` for first release fix
  - streaming STT/TTS later through WebSockets
- `createSystemSpeechProvider` can be a fallback adapter for browser TTS, but only when provider settings say Deepgram is not configured.
- Future `createGeminiLiveVoiceProvider` should live behind a separate realtime voice interface, not inside the generic speech provider.

Settings model:

- Keep the existing `speech.model` as the Deepgram STT model for backward compatibility in this release.
- Add a separate `speech.ttsModel` for the Deepgram Aura voice model.
- Normalize older settings by defaulting missing `ttsModel` to `aura-2-viktoria-de`.

Tauri bridge:

- Extend `createTauriDeepgramFetch` to proxy `/v1/speak`.
- Add a Rust command such as `deepgram_speak` that posts JSON `{ text }` to `https://api.deepgram.com/v1/speak`.
- Return binary audio safely to the renderer. If the existing proxy response shape is string-only, introduce a byte-array response for TTS instead of forcing audio through text.
- Keep API keys in Stronghold-backed settings; do not expose them as ordinary renderer state.

## UI And UX

Conversation should become a voice session surface, not a recorder page.

First improved version:

- One primary "Start live practice" action.
- Status line: listening, thinking, speaking, paused, needs settings.
- Microphone can run until silence is detected, then the learner turn is processed.
- The transcript appears as it becomes available.
- Tutor response begins as text, then plays through Deepgram TTS.
- The learner can interrupt or pause the session.
- Manual record/send is available under a fallback or troubleshooting control.

Listening and vocabulary practice should have a normal audio player state:

- Play, replay, loading, failed.
- Provider label should say "Deepgram voice" when Deepgram is used.
- If falling back to system TTS, label it clearly and keep it secondary.

## Settings

Settings should not imply that Deepgram only means transcription. The page should show:

- Deepgram API key status.
- STT model: `nova-3` or supported alternatives.
- STT language: German (`de`).
- TTS voice: default German Aura-2 voice `aura-2-viktoria-de`, with `aura-2-julius-de` available as a list option.
- Test key button.
- Record/transcribe test button.
- Speak test audio button that plays a short German sentence through Deepgram TTS.

All selectable values should come from lists. No free-text provider URLs or model IDs in the normal UI.

## Testing Strategy

Unit tests:

- Deepgram TTS builds the correct `/v1/speak?model=...` request with `Authorization: Token ...`.
- Tauri Deepgram fetch routes `/api/deepgram/v1/speak` to the native command.
- Activity listening calls `speechProvider.synthesize`, not `speakText`.
- Vocabulary playback calls provider-backed synthesis.
- Conversation tutor playback calls provider-backed synthesis.
- Missing Deepgram shows a fallback/system TTS state honestly.

Integration/component tests:

- Practice listening cannot silently use system TTS when `speechProvider` is supplied.
- Settings can test a generated Deepgram TTS sample.
- Conversation route receives both AI provider and speech provider from `MainApp`.

Packaged desktop smoke before release:

- Launch Tauri release executable.
- Verify Settings shows OpenRouter and Deepgram configured.
- Verify Deepgram key test passes.
- Verify Deepgram speak test produces playable audio.
- Verify listening practice Play Audio uses Deepgram and marks audio played.
- Verify conversation can produce a tutor text response and play provider-backed audio.
- Verify placement start and learning-plan generation still work.

## Implementation Order

1. Keep v0.0.3 release paused.
2. Add Deepgram TTS to the speech provider contract.
3. Extend the Tauri Deepgram bridge for `/v1/speak`.
4. Add a settings "Speak test audio" button.
5. Pass `speechProvider` into `ActivityPage`.
6. Replace listening, vocabulary, and tutor reply playback with provider-backed audio.
7. Keep system TTS only as explicit fallback.
8. Run full tests, build, Tauri build, and packaged desktop smoke.
9. Only then commit, tag, and release.
10. Plan the larger near-live and optional Gemini Live conversation rewrite as the next voice milestone.

## Out Of Scope For The Immediate Fix

- Full Gemini Live reimplementation.
- Full Deepgram Voice Agent integration.
- Custom WebRTC/LiveKit layer.
- Offline STT/TTS engines.
- Mobile APK voice handling.

These should follow after the provider-backed TTS fix is stable.

## Acceptance Criteria

The next release can move forward only when:

- No active listening/practice/conversation playback path pretends to use Deepgram while actually using system TTS.
- Deepgram TTS works from the packaged desktop app.
- OpenRouter remains the text/tutor/evaluation provider.
- Gemini Live is documented as an optional future live provider, not a removed forever capability.
- The manual record/send conversation flow is no longer presented as the final desired voice UX.
- Vault contains the current release state and open voice loops.

## Sources Checked

- Gemini Live API overview: `https://ai.google.dev/gemini-api/docs/live-api`
- Gemini Live WebSocket reference: `https://ai.google.dev/api/live`
- Gemini Live capabilities: `https://ai.google.dev/gemini-api/docs/live-api/capabilities`
- OpenRouter audio guide: `https://openrouter.ai/docs/guides/overview/multimodal/audio`
- OpenRouter speech endpoint: `https://openrouter.ai/docs/api/api-reference/speech/create-audio-speech`
- OpenRouter audio announcement: `https://openrouter.ai/announcements/announcing-audio-apis`
- Deepgram TTS REST guide: `https://developers.deepgram.com/docs/text-to-speech`
- Deepgram TTS voices: `https://developers.deepgram.com/docs/tts-models`
- Deepgram streaming STT: `https://developers.deepgram.com/docs/live-streaming-audio`
- Deepgram streaming TTS: `https://developers.deepgram.com/docs/streaming-text-to-speech`
- Deepgram Voice Agent: `https://developers.deepgram.com/docs/voice-agent`
