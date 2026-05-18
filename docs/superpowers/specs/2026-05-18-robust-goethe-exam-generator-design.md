# Robust Goethe Exam Generator — Design

**Date:** 2026-05-18
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)

## Problem

The exam simulator is the backbone of the app but currently shows an unusable
developer skeleton instead of real exam content:

- **Lesen:** passages render as the generation instruction itself —
  `"Text Teil 1.3: Ein originaler A1-Lesetext im Stil "Short letters or personal
  messages". Die Loesung ist im Text direkt oder indirekt enthalten."`
- **Options** render as placeholders: `"Option a aus dem Text"`,
  `"Option b aus dem Text"`, `"Option c aus dem Text"`.
- **Hören / Schreiben:** the same item (statement, audio, options, writing
  prompt) repeats many times.

### Root cause

`src/domain/exam/examGenerator.ts`:

1. `generateGoetheExam` silently swallows every AI failure
   (`catch → console.warn → return fallback`, line ~333) and returns a developer
   skeleton that was never fit for learners
   (`createObjectivePassage`, `createObjectiveOptions`,
   `createObjectivePrompt`, `createListeningFallbackContent`).
2. The single AI call is capped at `maxTokens: 6000` for the entire 4-module
   exam, which truncates the JSON → parse error → total fallback.
3. `normalizeModule` / `normalizeObjectiveQuestion` are index-aligned against the
   fallback and substitute a placeholder for **any** per-item shape mismatch, so
   even partially good AI output decays into repeated skeleton items.

This is an architectural problem (one root, three symptom areas), not a
single-line bug.

## Approved Decisions

1. **Failure behavior:** retry/repair, then fail loudly. No skeleton is ever
   shown. The exam appears only when all four modules validate.
2. **Generation unit:** one AI call per module (Lesen, Hören, Schreiben,
   Sprechen), strict per-module schema, per-module token budget.

## Design

### 1. Structure / boundaries

| Unit | Responsibility |
|---|---|
| `examTemplates.ts` | Per-level structural blueprint (modules, Teile, timing, points, pass threshold, criteria). **Kept as-is.** Verified against current Goethe-Zertifikat formats (A1–C2: 4 modules, per-Teil breakdown, 60% pass per module). |
| `examModuleSchema.ts` (new) | One strict validator per module type — objective (Lesen/Hören) and productive (Schreiben/Sprechen). Pure functions, independently testable. |
| `examGenerator.ts` | Thin orchestrator: per-module prompt → AI call → validate → retry/repair → typed error. **All `createFallback*` / `createObjective{Passage,Prompt,Options}` / `createListeningFallbackContent` skeleton generators deleted.** The structural blueprint stays; fake content is removed. |

### 2. Generation (per-module, parallel)

- One AI call per module, schema-scoped, with a per-module token budget (no
  shared 6000 cap).
- Modules generated concurrently (`Promise.all`); each module retried
  independently.
- Reading and Listening modeled authentically: a **shared passage/script with N
  questions**, not N standalone stubs. This matches real Goethe format and
  structurally prevents per-item duplication.

### 3. Retry / repair / fail-loud

- Per module: up to 3 attempts.
- Invalid JSON or failed validation triggers a **repair pass**: the invalid
  output plus concrete validation error messages are fed back to the model with
  an instruction to fix only what is wrong.
- Final failure throws a typed `ExamGenerationError` that names the failed
  module and reason.
- `ExamSimulatorPage` (already has `errorMessage` state) renders a clear error
  message and a **Retry** button. No exam is shown unless all four modules
  validate.

### 4. Validators enforce "real"

- **Skeleton/prompt-leak rejection** (generalized from the existing
  `isValidListeningQuestion` regex): reject content matching patterns such as
  `Option [abc] aus dem Text`, `originaler .* Lesetext im Stil`,
  `Aussage \d+: Die Aussage passt zum Text`,
  `Die Loesung ist im Text direkt oder indirekt enthalten`,
  `Audio script|Hoertext|Hörtext`.
- **Uniqueness:** no duplicate passages, prompts, option sets, or
  writing/speaking tasks within a module (normalized, case-insensitive compare).
- **Hören:** each listening item must have a distinct script so Deepgram TTS
  produces distinct audio (fixes "same audio repeated").
- **Objective questions:** require non-empty prompt, ≥2 distinct options, a
  valid `correctOptionIndex` within range, and a passage when the template
  expects one.

### 5. Speaking

Keeps the existing Gemini Live oral-examiner flow (already covered by passing
tests). Only the generation of speaking prompts is hardened through the same
schema/validation/retry path.

### 6. Error handling summary

- AI provider missing → `ExamGenerationError('no-ai-provider')` (no silent
  skeleton).
- AI call throws / times out → retry, then repair, then
  `ExamGenerationError(moduleId)`.
- Validation fails after all attempts → `ExamGenerationError(moduleId)` with the
  validator messages.
- Page surfaces the error and offers Retry.

### 7. Testing

- **Validator unit tests:** reject skeleton text, reject duplicates within a
  module, reject out-of-range `correctOptionIndex`, accept well-formed content.
- **Generator tests** with a mock AI provider:
  - success on first attempt,
  - success after one retry,
  - success after a repair pass,
  - loud failure after exhausting attempts (asserts `ExamGenerationError`,
    asserts no skeleton content returned).
- **`ExamSimulatorPage` test** updated: on generation failure it asserts the
  error message + Retry control instead of silent skeleton; on success it
  asserts real (non-skeleton, unique) content renders.

## Out of Scope

- Curated hand-written fallback exams (explicitly rejected in favor of
  retry/repair + loud failure).
- Changes to scoring logic (`scoreGoetheExam`) beyond what removing the skeleton
  requires.
- Changes to the Gemini Live oral-examiner transport (separate, already fixed).
- Unrelated refactors of `examGenerator.ts` not needed for this goal.

## Success Criteria

- A generated exam never shows prompt-instruction text, `"Option a aus dem
  Text"`, or duplicated Hören/Schreiben items.
- When AI generation cannot produce valid content, the user sees a clear error
  and a Retry button — never a fake exam.
- All four modules contain unique, level-appropriate, schema-valid content.
- Full test suite passes; new validator/generator tests cover success, retry,
  repair, and loud-fail paths.

## References

- [Goethe A1–A2 module breakdown](https://deutale.com/blog/exams/a1-a2-exam-structure-hoeren-lesen-schreiben-sprechen-breakdown/)
- [Goethe-Institut A1 Modellsatz (official)](https://www.goethe.de/pro/relaunch/prf/materialien/A1_sd1/sd_1_modellsatz.pdf)
- [Goethe-Zertifikat B1 Durchführungsbestimmungen (official)](https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_B1.pdf)
- [Goethe-Zertifikat B2 — Goethe-Institut USA](https://www.goethe.de/ins/us/en/spr/prf/gzb2.cfm)
- [Die Prüfungen des Goethe-Instituts (official Prüfungsordnung)](https://www.goethe.de/pro/relaunch/prf/en/Pruefungsordnung.pdf)
