# Changelog

## v0.0.8 - 2026-05-18

Desktop hotfix for the installed v0.0.7 exam and live-audio smoke findings.

- Confirmed Gemini Live uses Google's current Live API native-audio model name, `gemini-2.5-flash-native-audio-preview-12-2025`.
- Kept exam generation on the configured OpenRouter provider and selected OpenRouter model; Gemini is not used for exam generation.
- Tightened Hoeren generation so Deepgram TTS reads only the hidden per-question audio script, not visible prompts or answer labels.
- Blocked placeholder Hoeren content such as generic `Audio script` / `Option a aus dem Hoertext` output from AI generation.
- Made Hoeren playback one-shot per question: once the hidden script has played, answer options unlock and the audio button stays disabled.
- Added an active exam-generation progress indicator so starting an AI-generated exam does not look frozen.

## v0.0.7 - 2026-05-18

Desktop pre-release focused on stability and learner workflow clarity.

- Fixed Gemini Live conversation startup and audio flow so the live room waits for Gemini `setupComplete`, starts microphone capture without blocking on WebSocket setup, buffers PCM until the session is ready, and resumes suspended WebView audio contexts.
- Replaced the placeholder desktop/PWA icon with the new DeutschBoost branded icon set.
- Polished the desktop shell and dashboard with clearer local/provider status, mobile-ready navigation, and action-first daily study rows.
- Replaced the Exam placeholder with a real timed Goethe-style simulator: AI/local exam generation from public Goethe model-test structures, module-by-module timed runner, final scoring, and saved local attempt history.
- Added Exam-specific voice behavior: Hoeren now hides transcripts and requires Deepgram TTS playback before answers can be selected, while Sprechen can run a Gemini Live oral examiner session.
- Expanded Exam results into a Goethe-style score sheet with raw module/part points, converted 100-point module scores, ratings, deductions, and productive rubric bands.
- Kept passing activity results visible until the learner chooses to continue instead of instantly returning to the plan.
- Added a clear completed-plan recap with recalibration, next-plan, and continued-practice actions.

Release validation target:

- Full Vitest suite passes.
- Production Vite build passes.
- Tauri packaged desktop build passes.
- Installed desktop smoke confirms app launch, settings, plan flow, Exam visibility, provider-backed voice routes, and Gemini Conversation startup.

Open follow-ups intentionally not included in this tag:

- Exam report export/printing and more official-template refinements across non-B1 levels.
- Broader app-wide UI/UX redesign.
- Android/APK packaging.
- Deeper real-key Gemini Live and Deepgram smoke coverage across more devices.
