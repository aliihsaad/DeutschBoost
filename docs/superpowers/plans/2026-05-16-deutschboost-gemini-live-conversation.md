# DeutschBoost Gemini Live Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the primary Conversation experience a real Gemini Live realtime voice session.

**Architecture:** OpenRouter stays the text AI provider, Deepgram stays speech/TTS/fallback, and Gemini Live becomes a separate live-conversation provider with its own saved key and model. The UI starts Gemini Live directly, streams raw PCM microphone chunks over WebSocket, plays Gemini audio output, and stores transcripts locally through the existing conversation repository.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri 2, raw Gemini Live WebSocket API, browser MediaStream/AudioContext.

---

## File Structure

- Modify `src/domain/settings/providerSettings.ts`: add Gemini Live provider settings, model/voice dropdown options, status snapshot, factory helper.
- Modify `src/domain/settings/providerSettingsRepository.ts`: normalize/persist Gemini Live settings and keep the Gemini key out of public settings JSON.
- Modify `src/domain/settings/providerSecretStorage.ts`: add `live.apiKey` to the secret storage contract.
- Create `src/domain/conversation/liveConversationProvider.ts`: provider/session/event contracts used by runtime, controller, and tests.
- Create `src/domain/conversation/geminiLiveProvider.ts`: raw WebSocket Gemini Live implementation.
- Create `src/application/geminiLiveConversation.ts`: app controller that starts/stops a Gemini Live session, records transcripts, and manages UI state.
- Modify `src/application/providerRuntime.ts`: create a `liveConversationProvider` from settings.
- Modify `src/infrastructure/browser/audioRecorder.ts`: add PCM16 microphone capture for Gemini Live.
- Modify `pages/LocalSettingsPage.tsx`: add Gemini Live key/model/voice controls without free-text provider fields.
- Modify `pages/SpeakingActivityPage.tsx`: make Gemini Live the primary Conversation path; keep old Deepgram/OpenRouter turn mode as fallback.
- Modify `MainApp.tsx`: pass `runtime.liveConversationProvider` into Conversation routes.
- Modify `src-tauri/tauri.conf.json`: allow `wss://generativelanguage.googleapis.com` and `https://generativelanguage.googleapis.com`.
- Update tests under `tests/domain/settings`, `tests/application`, `tests/domain/conversation`, `tests/infrastructure/browser`, `tests/pages`, and `tests/release`.

## External API Facts Used

- Gemini Live raw WebSocket endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=...`.
- First client message is setup/configuration; API reference describes the authoritative `setup` wrapper.
- Realtime audio input is raw little-endian PCM16 with MIME like `audio/pcm;rate=16000`.
- Output audio is raw PCM16 at 24kHz.
- `inputAudioTranscription` and `outputAudioTranscription` in setup enable transcript events.
- Server interruption events should clear local playback queues.

## Tasks

### Task 1: Settings And Secret Model

**Files:**
- Modify: `src/domain/settings/providerSettings.ts`
- Modify: `src/domain/settings/providerSettingsRepository.ts`
- Modify: `src/domain/settings/providerSecretStorage.ts`
- Test: `tests/domain/settings/providerSettings.test.ts`
- Test: `tests/domain/settings/providerSettingsRepository.test.ts`
- Test: `tests/domain/settings/providerSecretStorage.test.ts`

- [ ] **Step 1: Write failing settings tests**

Add tests that assert:
- defaults include disabled `live` settings with provider `gemini-live`, model `gemini-2.5-flash-native-audio-preview-12-2025`, and voice `Kore`;
- `GEMINI_LIVE_MODEL_OPTIONS` and `GEMINI_LIVE_VOICE_OPTIONS` are dropdown lists;
- saved `live.apiKey` is stored in secret storage, not public JSON;
- reset removes `live.apiKey`.

Run:

```powershell
npm run test:run -- tests/domain/settings/providerSettings.test.ts tests/domain/settings/providerSettingsRepository.test.ts tests/domain/settings/providerSecretStorage.test.ts
```

Expected: fail because `live` settings and `live.apiKey` do not exist.

- [ ] **Step 2: Implement settings/secrets**

Add:

```ts
export type LiveConversationProviderSetting = 'gemini-live';

export interface LocalLiveConversationProviderSettings {
  enabled: boolean;
  provider: LiveConversationProviderSetting;
  apiKey?: string;
  model: string;
  voiceName: string;
}
```

Extend `LocalProviderSettings` with `live`, add model/voice options, normalization, secret migration, and reset handling for `live.apiKey`.

- [ ] **Step 3: Re-run focused settings tests**

Run the same command. Expected: pass.

### Task 2: Gemini Live Provider

**Files:**
- Create: `src/domain/conversation/liveConversationProvider.ts`
- Create: `src/domain/conversation/geminiLiveProvider.ts`
- Test: `tests/domain/conversation/geminiLiveProvider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Cover:
- WebSocket URL uses the fixed Google endpoint and key query parameter;
- on open, provider sends a setup message with `setup.model`, audio response modality, input/output transcription, German tutor system instruction, and voice config;
- provider waits for `setupComplete` before resolving the session;
- `sendAudioPcm16` sends `realtimeInput.audio` with `audio/pcm;rate=16000`;
- server `inputTranscription`, `outputTranscription`, `inlineData`, `interrupted`, and `turnComplete` messages emit typed events.

Run:

```powershell
npm run test:run -- tests/domain/conversation/geminiLiveProvider.test.ts
```

Expected: fail because files do not exist.

- [ ] **Step 2: Implement the provider**

Use a small injected `WebSocketCtor` for tests. Base64 conversion must work for `ArrayBuffer` and `Uint8Array` in browser tests. Keep the API key inside the socket URL only; do not log it.

- [ ] **Step 3: Re-run provider tests**

Run the same command. Expected: pass.

### Task 3: PCM Microphone Capture

**Files:**
- Modify: `src/infrastructure/browser/audioRecorder.ts`
- Test: `tests/infrastructure/browser/audioRecorder.test.ts`

- [ ] **Step 1: Write failing PCM capture tests**

Cover:
- requests microphone access;
- creates audio processing at 16k target rate;
- converts `Float32Array` samples to little-endian PCM16 chunks;
- stops tracks and closes/disconnects audio nodes.

Run:

```powershell
npm run test:run -- tests/infrastructure/browser/audioRecorder.test.ts
```

Expected: fail because PCM capture is not implemented.

- [ ] **Step 2: Implement PCM capture**

Add `startBrowserPcmAudioCapture({ onPcmChunk, onError })`. Use `AudioContext`, `MediaStreamAudioSourceNode`, and `ScriptProcessorNode` for broad WebView compatibility. Keep pure conversion helpers separately testable.

- [ ] **Step 3: Re-run audio tests**

Run the same command. Expected: pass.

### Task 4: Runtime And Controller

**Files:**
- Modify: `src/application/providerRuntime.ts`
- Create: `src/application/geminiLiveConversation.ts`
- Test: `tests/application/providerRuntime.test.ts`
- Test: `tests/application/geminiLiveConversation.test.ts`

- [ ] **Step 1: Write failing runtime/controller tests**

Cover:
- runtime creates `liveConversationProvider` only when Gemini Live is enabled and keyed;
- controller starts a local session, starts Gemini Live, starts PCM capture after setup, appends learner/tutor transcript turns, plays audio chunks, ends the local session, and stops mic/session cleanly.

Run:

```powershell
npm run test:run -- tests/application/providerRuntime.test.ts tests/application/geminiLiveConversation.test.ts
```

Expected: fail because live runtime/controller do not exist.

- [ ] **Step 2: Implement runtime/controller**

Add `liveConversationProvider` to `LocalProviderRuntime`. Build controller state names around the actual experience: `idle`, `connecting`, `listening`, `speaking`, `ending`, `ended`, `error`.

- [ ] **Step 3: Re-run runtime/controller tests**

Run the same command. Expected: pass.

### Task 5: Settings And Conversation UI

**Files:**
- Modify: `pages/LocalSettingsPage.tsx`
- Modify: `pages/SpeakingActivityPage.tsx`
- Modify: `MainApp.tsx`
- Modify: `components/ExperienceAppShell.tsx`
- Test: `tests/pages/LocalSettingsPage.test.tsx`
- Test: `tests/pages/SpeakingActivityPage.test.tsx`
- Test: `tests/MainApp.providerRuntime.test.tsx`
- Test: `tests/architecture/noLegacyGeminiLive.test.ts`

- [ ] **Step 1: Write failing UI tests**

Cover:
- settings shows Gemini Live as its own provider panel with password key, model dropdown, and voice dropdown;
- saved Gemini key is hidden like other keys;
- Conversation missing-state says Gemini Live is required for realtime Conversation;
- Conversation primary action is `Start Gemini Live`;
- no free-text provider configuration fields are added;
- fallback record/send remains available only as secondary/manual mode.

Run:

```powershell
npm run test:run -- tests/pages/LocalSettingsPage.test.tsx tests/pages/SpeakingActivityPage.test.tsx tests/MainApp.providerRuntime.test.tsx tests/architecture/noLegacyGeminiLive.test.ts
```

Expected: fail because UI and route props are not wired.

- [ ] **Step 2: Implement UI wiring**

Settings: add a third provider card. Conversation: show Gemini Live controls first; show provider status and local transcript; move Deepgram/OpenRouter record/send into a secondary fallback section.

- [ ] **Step 3: Re-run UI tests**

Run the same command. Expected: pass.

### Task 6: Desktop CSP And Verification

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Test: `tests/release/tauriDesktopShell.test.ts`

- [ ] **Step 1: Write failing CSP test**

Assert `connect-src` includes `https://generativelanguage.googleapis.com` and `wss://generativelanguage.googleapis.com`.

Run:

```powershell
npm run test:run -- tests/release/tauriDesktopShell.test.ts
```

Expected: fail until CSP is updated.

- [ ] **Step 2: Update CSP**

Add only the Gemini Live origins needed for API key WebSocket and future ephemeral-token provisioning.

- [ ] **Step 3: Full verification**

Run:

```powershell
npm run test:run
npm run build
```

Expected: all tests pass and production Vite build succeeds.

## Release Gate

Do not tag or push a release from this plan until:
- Settings can save OpenRouter, Deepgram, and Gemini Live without exposing keys in public JSON.
- Conversation can start Gemini Live from the installed desktop app.
- The old record/send path is visibly secondary and no longer presented as the main Conversation experience.
- Vault has an implementation summary and any incomplete follow-up is saved as an open loop.
