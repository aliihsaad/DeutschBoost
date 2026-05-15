# DeutschBoost Local-First Redesign

Status: draft for user review
Date: 2026-05-15

## Purpose

DeutschBoost should move from a browser/cloud SaaS prototype into a local-first German learning app. The first package target is Windows desktop, but the data model should also support a later true local mobile app that stores learner data in the device app sandbox instead of a cloud database. The new product should work without accounts, keep learner data in local files or SQLite, and use cloud AI only as optional services: OpenRouter for tutor/evaluation intelligence and Deepgram for speech-to-text transcription.

The useful core of the old app is the learning product model: CEFR placement, adaptive learning plans, activity generation, writing feedback, speaking/listening practice, conversation memory, progress tracking, and Goethe-style practice. The parts to remove or replace are Supabase auth/database, Vercel/PWA deployment assumptions, direct browser API key exposure, and Gemini Live voice sessions.

## Current Findings

- The repo is a React 19, TypeScript, Vite app with React Router, Tailwind, Supabase, Gemini, PWA, Vitest, and Vercel config.
- `MainApp.tsx`, `src/contexts/AuthContext.tsx`, `src/lib/supabase.ts`, and service files assume a logged-in Supabase user.
- `services/geminiService.ts` now keeps legacy Gemini text/JSON generation helpers only; Gemini Live helpers have been removed from the active codebase.
- `services/learningPlanService.ts`, `services/conversationService.ts`, and `services/practiceService.ts` are persistence services, but they are tied directly to Supabase tables.
- `pages/ConversationPage.tsx` has been deleted. `pages/SpeakingActivityPage.tsx` is now the active conversation surface, with microphone capture, Deepgram transcription, AI-provider tutor replies, and interim browser-local transcript storage.
- Tests and production build pass when the sandbox allows the esbuild worker to spawn: 42 Vitest tests passed, and `npm run build` completed successfully.

## Recommended Direction

Use Tauri 2 with the existing React/Vite frontend. This keeps most UI code reusable while giving the app a real desktop shell, scoped file access, local app-data directories, SQLite persistence, and a Rust side for safer filesystem and network operations.

Electron is viable but heavier. A pure browser/PWA local mode is the lowest effort, but it does not fully satisfy the local app and files direction because it keeps browser storage limitations, browser API-key exposure risk, and weaker file ownership.

The local-first architecture should be:

- React UI remains the main interface.
- Tauri shell owns local files, database location, secure settings, and desktop packaging.
- UI/UX becomes a first-class conversion goal, not a final polish task.
- SQLite becomes the primary store for profiles, plans, activity results, conversations, vocabulary, spaced repetition, and study sessions.
- JSON/Markdown export files make user data inspectable and portable.
- OpenRouter becomes one implementation behind an AI provider interface, not a direct dependency in page components.
- Deepgram becomes the planned speech-to-text provider for German voice input and transcript capture.
- Gemini Live is removed from the core path. Voice returns as a normal turn-based pipeline rather than a realtime Gemini session.

## Product Concept

DeutschBoost should become a serious personal German learning workstation:

- No login to start.
- A calmer, stronger app UI focused on repeated study workflows rather than a marketing-style SaaS dashboard.
- One local learner profile with CEFR level, target level, native language, daily goal, exam target, and weak areas.
- Local learning memory: mistakes, vocabulary gaps, writing revisions, recurring grammar issues, useful phrases, and prior conversation feedback.
- Structured German path by level: grammar map, vocabulary themes, Goethe exam skills, daily review, and weekly plan.
- AI-assisted practice when enabled: activity generation, writing correction, conversation tutor, exam feedback, and plan adjustment.
- Voice-assisted practice when enabled: learner speech is transcribed by Deepgram, reviewed by the tutor, and stored locally as part of the session memory.
- Non-AI fallback content so the app is still useful without an API key.
- Local files export: learner journal, vocabulary deck, mistakes notebook, weekly reports, and backup bundle.

## Core Modules

### App Shell

Tauri should package the app for Windows first. The shell should expose narrow commands for:

- Getting app data paths.
- Reading and writing user-selected export/import files.
- Opening the local data directory.
- Running SQLite migrations.
- Making AI and speech HTTP/WebSocket calls without exposing API keys to browser code.

### UI And UX Direction

The redesign should happen as part of the conversion, not after it. The current UI has useful screens, but the new local app should feel more like a focused learning cockpit:

- First screen: today's study queue, current CEFR target, weak areas, due reviews, and one clear next action.
- Left navigation or compact app rail for Dashboard, Plan, Review, Practice, Conversation, Writing, Mistakes, Exam, Library, and Settings.
- Dense but readable information layout for repeated use. Avoid oversized marketing sections, decorative card stacks, and one-note gradients.
- Better session flows: start activity, complete activity, review corrections, save mistakes, schedule review, return to daily queue.
- Strong empty states that help the learner begin locally without accounts or cloud setup.
- AI and voice settings should be plain and inspectable: provider, model, API key status, usage, and fallback behavior.
- Mobile-responsive browser layout can remain useful during development, but it is only a viewport check. A real local mobile release should use a wrapper such as Capacitor or a native shell with device-local SQLite/filesystem APIs. Desktop Windows layout remains the first shipping target.

Before major UI implementation, generate and approve visual concepts for the primary local app surfaces: dashboard, activity session, conversation/voice session, mistake notebook, and settings. Build a small design system from the accepted concept: typography, colors, spacing, panels, buttons, navigation, progress indicators, review cards, transcript rows, and feedback blocks.

### Local Data

SQLite should replace Supabase as the source of truth. The first local schema should contain:

- `learner_profile`
- `placement_results`
- `learning_plans`
- `learning_plan_items`
- `activity_attempts`
- `conversation_sessions`
- `study_sessions`
- `vocabulary_cards`
- `review_queue`
- `mistake_notes`
- `app_settings`
- `ai_usage_events`
- `speech_usage_events`

Keep the current TypeScript domain types, but decouple them from Supabase generated database types.

### AI Provider Layer

Create an AI provider boundary:

- `generateJson<T>(request)`
- `generateText(request)`
- `streamText(request)` when useful
- `evaluateWriting(request)`
- `generateActivity(request)`

The first provider should call OpenRouter chat completions. OpenRouter documents `POST https://openrouter.ai/api/v1/chat/completions`, with request/response schemas similar to OpenAI Chat API. The app should keep provider/model/settings in local settings, validate JSON responses, track cost metadata when available, and fail gracefully into local fallback exercises.

Do not put OpenRouter calls directly in React pages. React should call application services, services call provider interfaces, and providers call Tauri commands or a local backend adapter.

### Voice And Conversation

Drop Gemini Live as a required feature.

First replacement:

- Text-first conversation tutor remains available without microphone setup.
- Push-to-talk voice mode uses Deepgram speech-to-text to capture the learner's German speech and produce a transcript.
- OpenRouter receives the transcript plus local learning memory and returns the tutor response and/or feedback.
- German audio playback can start with WebView speech synthesis, then later move to a dedicated TTS provider if quality becomes a blocker.
- Conversation memory should be local and explicit: recent corrections, recurring mistakes, vocabulary to reuse, and user preferences.

Deepgram integration should be turn-based first:

- Press to speak.
- Capture short audio or stream until end-of-speech.
- Store raw transcript, confidence/metadata when available, and the cleaned learner utterance.
- Send the cleaned utterance to the tutor pipeline.
- Save the full exchange locally.

Later voice options:

- Local STT/TTS engines for privacy.
- Deepgram streaming with interim results and end-of-speech handling for a more live feeling.
- OpenRouter-compatible audio or multimodal models if a selected model becomes useful for specific learning tasks.
- Whisper-based transcription only as an offline/privacy fallback if latency and quality are acceptable for the learning mode.

### Learning Engine

The app should become stronger by adding durable local learning systems rather than only generating one-off AI content:

- CEFR placement and recalibration.
- 12-week adaptive plan option, with a focused daily queue.
- Spaced repetition for vocabulary and grammar mistakes.
- Mistake notebook that turns corrections into review cards.
- Writing coach with revision history.
- Goethe exam simulator with timed sections and local reports.
- Reading/listening library stored as local content packs.
- Progress dashboards from local study sessions.
- Improved UX around those systems: the learner should always know what to do next, why it matters, and what changed after a practice session.

## Migration Strategy

Convert in slices instead of rewriting everything at once:

1. Introduce domain repositories and AI provider interfaces while the browser app still runs.
2. Define the new UI/UX direction and design system before moving major screens.
3. Add local mock/in-memory repositories and tests.
4. Add SQLite repositories.
5. Replace Supabase auth with a local learner profile.
6. Replace Gemini SDK calls with provider-agnostic AI services.
7. Add OpenRouter provider and settings.
8. Add Deepgram provider and settings for speech-to-text.
9. Remove Gemini Live conversation flow and ship text-first plus turn-based voice conversation practice.
10. Add Tauri shell and desktop packaging.
11. Add export/import and local backup.
12. Add a mobile-local packaging spike only after the desktop local store is stable, reusing domain services and replacing desktop file commands with device sandbox storage.
13. Then improve learning depth: spaced repetition, mistake notebook, exam packs.

## Risks

- The current app mixes UI, persistence, and AI calls in page flows, so boundaries must be introduced before replacing services.
- Direct API calls from the renderer could expose keys. AI calls should go through Tauri commands or another trusted local process.
- Deepgram API keys have the same renderer exposure risk as OpenRouter keys and should also live behind Tauri commands or secure local settings.
- Gemini response schemas and OpenRouter model behavior will not match perfectly. JSON validation and repair/fallback handling are required.
- Voice should not block the conversion. A strong text-first tutor plus a stable turn-based Deepgram transcript flow is better than trying to recreate realtime Gemini Live immediately.
- UI/UX redesign must be scoped around real learning workflows. A visually polished shell without better daily study, review, and feedback flows would not meet the product goal.
- Mobile browsers cannot safely behave like full local file apps on iOS/Android. True mobile-local support needs an app wrapper or native shell with sandboxed storage.
- Existing Supabase data migration is unknown. The first version should support local fresh start and later add an import path if needed.

## Initial Decision

Recommended first milestone: "Local Core Alpha".

It should run as the existing Vite app during development, but use local repositories, an OpenRouter-compatible AI provider abstraction, and a Deepgram-compatible speech provider abstraction. After that passes tests, wrap it in Tauri and move filesystem/database/API-key concerns behind desktop commands.

The user approved the Tauri/local-first direction and explicitly allowed Deepgram for voice and transcript on 2026-05-15.

## Sources Checked

- OpenRouter API reference: `https://openrouter.ai/docs/api/reference/overview`
- OpenRouter chat completions: `https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request`
- Tauri SQL plugin reference: `https://v2.tauri.app/es/reference/javascript/sql/`
- Tauri filesystem plugin: `https://v2.tauri.app/plugin/file-system/`
- Deepgram live streaming audio guide: `https://developers.deepgram.com/docs/live-streaming-audio`
- Deepgram pre-recorded transcription API reference: `https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded`
