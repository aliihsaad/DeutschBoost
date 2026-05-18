# Changelog

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
