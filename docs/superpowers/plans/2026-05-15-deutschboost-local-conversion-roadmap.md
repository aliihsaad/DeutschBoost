# DeutschBoost Local Conversion Starter Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert DeutschBoost from a browser/cloud app into a local-first German learning app with local files, optional OpenRouter AI, and optional Deepgram speech-to-text. Windows desktop is the first package target; a true local mobile app should reuse the same domain/data model with device-local storage instead of cloud storage.

**Architecture:** First separate domain logic from Supabase and Gemini. Then define the new local-app UX/design system, replace persistence with SQLite/local files, replace auth with a local learner profile, add provider-neutral AI and speech services, and package the React UI with Tauri. Mobile-local support should come through an app wrapper with sandboxed SQLite/filesystem APIs, not a cloud-hosted browser app.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri 2, SQLite, OpenRouter-compatible chat completions, Deepgram speech-to-text, local JSON/Markdown export files, app-specific design system.

---

## Phase 0: Baseline And Decision

- [x] Confirm desktop shell choice: Tauri 2 is approved for a smaller local-first app and scoped file/database access.
- [x] Confirm first voice scope: text-first tutor plus turn-based Deepgram STT/transcript; richer live voice can come later.
- [x] Confirm AI provider scope: OpenRouter first, keep provider interface open for local models later.
- [x] Confirm UI/UX improvement as a first-class goal of the conversion.
- [ ] Keep the current cloud app runnable until local repositories are ready.

## Phase 1: Introduce Boundaries Without Changing Behavior

**Files to create:**

- `src/domain/learning/types.ts`
- `src/domain/learning/learningPlanRepository.ts`
- `src/domain/profile/profileRepository.ts`
- `src/domain/conversation/conversationRepository.ts`
- `src/domain/practice/practiceRepository.ts`
- `src/domain/ai/aiProvider.ts`
- `src/domain/ai/jsonGeneration.ts`
- `src/domain/speech/speechProvider.ts`
- `src/domain/speech/transcriptTypes.ts`

**Files to modify:**

- `services/learningPlanService.ts`
- `services/conversationService.ts`
- `services/practiceService.ts`
- `services/activityService.ts`
- `services/geminiService.ts`

Steps:

- [ ] Move shared learning/profile/conversation types out of Supabase-shaped services.
- [ ] Define repository interfaces for learning plans, profile, practice stats, conversation sessions, and study sessions.
- [ ] Define `AiProvider` with JSON and text generation methods.
- [ ] Define `SpeechProvider` with pre-recorded and streaming transcript methods.
- [ ] Keep Supabase and Gemini as temporary adapters behind those interfaces.
- [ ] Add a placeholder Deepgram adapter interface without enabling it in active UI yet.
- [ ] Add tests that prove existing services can run through the new interfaces.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## Phase 1.5: UI/UX Direction And Design System

**Files to create:**

- `src/ui/designTokens.ts`
- `src/ui/navigationModel.ts`
- `src/ui/learningWorkflowModel.ts`
- `docs/superpowers/specs/2026-05-15-deutschboost-ui-ux-direction.md`

**Files to modify:**

- `components/Header.tsx`
- `MainApp.tsx`
- `pages/HomePage.tsx`
- `pages/LearningPlanPage.tsx`
- `pages/SpeakingActivityPage.tsx`
- `pages/ActivityPage.tsx`
- `pages/ProfilePage.tsx`

Steps:

- [ ] Audit current screens for learning workflow friction: unclear next action, repeated gradients/cards, weak daily queue, hard-to-scan plan, and feedback not turning into review.
- [ ] Define the new app information architecture: Dashboard, Plan, Review, Practice, Conversation, Writing, Mistakes, Exam, Library, Settings.
- [ ] Generate and approve visual concepts before major UI implementation: dashboard, activity session, conversation/voice session, mistake notebook, and settings.
- [ ] Create design tokens for typography, colors, spacing, radius, panels, buttons, progress indicators, review cards, transcript rows, and feedback blocks.
- [ ] Define desktop-first layout rules: compact sidebar/app rail, clear page header, dense content regions, stable action bars, no marketing hero as the main app screen.
- [ ] Add tests or story fixtures for navigation model and learning workflow model.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## Phase 2: Local Profile Instead Of Auth

**Files to create:**

- `src/contexts/LocalProfileContext.tsx`
- `src/domain/profile/localProfileDefaults.ts`
- `src/domain/profile/localProfileSchema.ts`

**Files to modify:**

- `App.tsx`
- `MainApp.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/SignupPage.tsx`
- `src/contexts/AuthContext.tsx`
- `pages/ProfilePage.tsx`

Steps:

- [ ] Replace required login with a first-run local profile setup.
- [ ] Keep old auth pages inaccessible or remove them from the active route tree.
- [ ] Map the current `userProfile` fields to one local learner profile.
- [ ] Update all pages to read learner data from `LocalProfileContext`.
- [ ] Add a migration shim so components that currently expect `user.id` receive a stable local learner id.
- [ ] Run profile and routing tests.
- [ ] Run `npm run build`.

## Phase 3: SQLite Local Store

**Files to create:**

- `src/localdb/schema.sql`
- `src/localdb/migrations.ts`
- `src/localdb/localDatabase.ts`
- `src/localdb/repositories/localLearningPlanRepository.ts`
- `src/localdb/repositories/localConversationRepository.ts`
- `src/localdb/repositories/localPracticeRepository.ts`
- `src/localdb/repositories/localProfileRepository.ts`

**Files to modify:**

- `services/learningPlanService.ts`
- `services/conversationService.ts`
- `services/practiceService.ts`
- `utils/supabaseQuery.ts`

Steps:

- [ ] Create SQLite schema matching the local-first data model.
- [ ] Add a migration runner with idempotent migration tracking.
- [ ] Implement local repositories for profile, learning plans, plan items, conversations, practice sessions, study sessions, vocabulary cards, and mistake notes.
- [ ] Replace Supabase repository injection with local repository injection.
- [ ] Remove runtime dependency on `src/lib/supabase.ts` from the main learning flow.
- [ ] Add unit tests for create/load/update plan, complete activity, create/end conversation, and update study streak.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## Phase 4: OpenRouter AI Adapter

**Files to create:**

- `src/domain/ai/openRouterProvider.ts`
- `src/domain/ai/promptCatalog.ts`
- `src/domain/ai/modelSettings.ts`
- `src/domain/ai/aiUsageRepository.ts`
- `src/settings/AiSettingsPage.tsx`

**Files to modify:**

- `services/geminiService.ts`
- `services/activityService.ts`
- `services/conversationService.ts`
- `services/practiceService.ts`
- `src/vite-env.d.ts`

Steps:

- [ ] Extract prompts from `geminiService.ts` into `promptCatalog.ts`.
- [ ] Replace Google SDK-specific response schemas with provider-neutral JSON contracts.
- [ ] Implement OpenRouter chat completions adapter using local settings for API key and model.
- [ ] Validate all AI JSON with `parseAiJsonResponse` plus schema-level checks.
- [ ] Add offline fallback activity generation for grammar, vocabulary, and reading.
- [ ] Track AI usage locally by feature, model, timestamp, and token/cost fields when returned.
- [ ] Add tests for successful JSON generation, malformed JSON fallback, missing API key handling, and provider error handling.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## Phase 5: Deepgram Speech-To-Text Adapter

**Files to create:**

- `src/domain/speech/deepgramProvider.ts`
- `src/domain/speech/speechSettings.ts`
- `src/domain/speech/audioCapture.ts`
- `src/domain/speech/transcriptCleaner.ts`
- `src/settings/SpeechSettingsPage.tsx`

**Files to modify:**

- `src/vite-env.d.ts`
- `services/conversationService.ts`
- `pages/SpeakingActivityPage.tsx`

Steps:

- [ ] Implement a Deepgram provider behind `SpeechProvider`.
- [ ] Support German transcription with a configurable language setting, defaulting to `de`.
- [ ] Support turn-based recording first: capture a short utterance, send it for transcription, receive final text, then pass it to the tutor.
- [ ] Store transcript text, timestamps, confidence/metadata when available, and raw provider response references locally.
- [ ] Add Deepgram API-key and model/settings UI, but route production calls through Tauri commands before desktop release.
- [ ] Add tests for missing API key, successful transcript, empty transcript, provider error, and transcript cleaning.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## Phase 6: Replace Gemini Live Conversation

**Files to create:**

- `src/domain/conversation/conversationTutor.ts`
- `src/domain/conversation/conversationMemory.ts`
- `src/domain/conversation/feedbackEngine.ts`
- `src/domain/conversation/voiceTurnController.ts`

**Files to modify:**

- `pages/SpeakingActivityPage.tsx`
- `services/conversationService.ts`
- `services/geminiService.ts`

Steps:

- [x] Remove `@google/genai` Live session usage from the active conversation flow.
- [x] Build a text-first conversation tutor that sends full local conversation context to the AI provider.
- [x] Add a voice-turn mode that uses Deepgram transcript output as the learner message.
- [x] Persist each tutor/user exchange locally in the browser adapter as an interim step.
- [x] Generate feedback at session end using local transcripts and learner level.
- [ ] Keep German speech synthesis as optional output for tutor messages.
- [ ] Keep fully live streaming voice behind a later feature flag.
- [ ] Add tests for session start, message append, feedback generation, and history loading.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## Phase 7: Tauri Desktop Shell

**Files to create:**

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs`
- `src-tauri/capabilities/default.json`
- `src/desktop/desktopApi.ts`
- `src/desktop/localPaths.ts`

**Files to modify:**

- `package.json`
- `vite.config.ts`
- `README.md`
- `CLAUDE.md`

Steps:

- [ ] Add Tauri CLI and app scaffold.
- [ ] Add commands for app data path, database path, export file write, import file read, AI HTTP call, and speech HTTP/WebSocket call.
- [ ] Move OpenRouter and Deepgram API-key access behind desktop commands before shipping desktop builds.
- [ ] Configure Windows dev and production packaging.
- [ ] Keep `npm run dev` for browser development and add `npm run tauri:dev`.
- [ ] Add `npm run tauri:build`.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Run `npm run tauri:dev` and verify the app opens with a local profile and local learning plan.

## Phase 8: Local Files, Export, And Backup

**Files to create:**

- `src/domain/export/exportBundle.ts`
- `src/domain/export/markdownReport.ts`
- `src/domain/import/importBundle.ts`
- `src/settings/DataSettingsPage.tsx`

**Files to modify:**

- `MainApp.tsx`
- `components/Header.tsx`
- `pages/ProfilePage.tsx`

Steps:

- [ ] Add export bundle containing profile, plans, activity attempts, conversations, vocabulary, mistakes, and settings.
- [ ] Add Markdown weekly report export.
- [ ] Add JSON import with validation and conflict rules.
- [ ] Add "Open data folder" and "Create backup" actions.
- [ ] Add tests for export/import round trip.
- [ ] Run `npm run test:run`.
- [ ] Run desktop smoke test.

## Phase 8.5: Mobile-Local Packaging Spike

Run this only after the desktop local store is stable. The goal is to prove phone/tablet support without turning the app back into a cloud web product.

Steps:

- [ ] Keep the shared React/domain modules reusable across desktop and mobile targets.
- [ ] Evaluate Capacitor or a native mobile shell for app-sandbox file access and device-local SQLite.
- [ ] Replace Tauri-specific file/database commands with a mobile storage adapter behind the same repository interfaces.
- [ ] Verify OpenRouter and Deepgram remain optional network providers while learner data stays on-device.
- [ ] Add a mobile smoke test for first-run profile, daily queue, completed activity, and offline reload.

## Phase 9: Strong Learning Upgrade

**Files to create:**

- `src/domain/review/spacedRepetition.ts`
- `src/domain/mistakes/mistakeNotebook.ts`
- `src/domain/exam/goetheExamCatalog.ts`
- `src/domain/exam/examSimulator.ts`
- `pages/MistakeNotebookPage.tsx`
- `pages/ReviewPage.tsx`

Steps:

- [ ] Convert grammar corrections and vocabulary suggestions into review cards.
- [ ] Add daily review queue with spaced repetition scheduling.
- [ ] Add mistake notebook grouped by grammar topic, vocabulary, word order, case, tense, and pronunciation.
- [ ] Add Goethe-style exam packs as local content.
- [ ] Add weekly report generation.
- [ ] Add tests for review scheduling and mistake card creation.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.

## First Code Change To Make After Approval

Start with Phase 1. The first pull should not add Tauri yet. It should create the repository plus AI/speech provider interfaces, wire the current Supabase/Gemini implementations behind them, and prove the current app still builds. Then do Phase 1.5 before moving major screens so the local app does not inherit the old SaaS-style UI.

## Current Verification Baseline

- `npm run test:run`: passed, 42 tests.
- `npm run build`: passed.
- Both commands required elevated execution because the sandbox blocked esbuild worker spawn with `EPERM`.
