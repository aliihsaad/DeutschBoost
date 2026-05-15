# DeutschBoost Experience-First Local App Design

Status: draft for user review
Date: 2026-05-15
Approved direction: experience-first local app with compatibility adapters

## Purpose

DeutschBoost should not become a local copy of the old browser app. The conversion should produce a smoother German learning desktop app that uses the old project as source material, keeps useful learning behavior, and replaces cloud/browser assumptions with a local-first learner journey.

The guiding rule is:

> Preserve useful learning data and proven behavior. Redesign workflows when the old logic creates friction.

This spec defines the Phase 1.5 product experience before major UI replacement begins.

## Product Shape

DeutschBoost becomes a local German learning workstation for daily practice, review, voice work, and progress tracking.

The app should feel practical and focused:

- No account required to start.
- The first screen always answers: what should I study next?
- Every completed activity can produce review items, mistake notes, vocabulary cards, or a writing revision.
- Voice is turn-based first: record, transcribe with Deepgram, receive tutor feedback, save the transcript locally.
- AI is optional and provider-based. OpenRouter is the first target provider, but the UI should describe capabilities, not vendor names.
- Local files and export are visible features, not hidden implementation details.

## Migration Principle

The legacy app is not the interaction model. It is a library of useful pieces:

- Reuse activity prompts, CEFR concepts, plan generation, writing evaluation, practice types, and existing tests where they still serve the learner.
- Replace Supabase auth with a local learner profile.
- Replace top navigation and marketing-style dashboard composition with a desktop app shell.
- Replace one-off activity completion with a session result flow that saves learning memory.
- Replace Gemini Live with a stable Deepgram transcript plus AI tutor turn.
- Keep old routes temporarily as compatibility entry points, but route them into the new workflow model.

## Information Architecture

The primary desktop shell should use a compact left rail or sidebar. The first version should include these destinations:

- Dashboard: daily queue, level, weak areas, due reviews, recent progress, next best action.
- Plan: weekly learning path with clear upcoming and completed items.
- Review: due vocabulary, grammar mistakes, phrases, and previous corrections.
- Practice: free practice by skill, level, topic, and exam target.
- Conversation: text and push-to-talk tutor sessions.
- Writing: prompts, drafts, AI feedback, and revision history.
- Mistakes: searchable notebook of grammar, vocabulary, pronunciation, and writing issues.
- Exam: Goethe-style timed practice and local reports.
- Library: saved readings, listening items, grammar notes, and content packs.
- Settings: local profile, data location, backup/export, AI provider, speech provider, privacy.

The old pages can remain during migration, but new navigation labels and workflow models should be designed around these destinations.

## First-Run Flow

The old login/signup gate should become a local setup flow:

1. Create local learner profile.
2. Choose current level or take placement test.
3. Pick goal: general fluency, Goethe exam, work, travel, university, or custom.
4. Choose daily target and preferred practice mix.
5. Configure AI and speech later, not as a blocker.

If the user skips setup details, the app should start with safe defaults:

- Level: A1
- Target: improve general German
- Daily target: 20 minutes
- Voice: disabled until Deepgram key is configured
- AI: disabled until OpenRouter key is configured, with local sample activities available

## Dashboard

The dashboard should replace the current hero/stat-card home screen. It should behave like a learning cockpit:

- One primary next action with estimated time and reason.
- Today's queue, grouped by review, plan item, speaking, writing, and exam practice.
- Weak areas surfaced from mistakes and recent scores.
- Due reviews count and quick start.
- Current CEFR level and target level.
- Progress strip for the week, not a large decorative chart.
- Recent session summary with corrections saved.

The dashboard should avoid oversized hero copy, decorative gradients, emoji-driven stats, nested cards, and marketing-style sections. It should be dense enough for repeated daily use while staying readable.

## Learning Queue Model

The app should compute a daily queue from local state:

- Due review cards first.
- Active plan item second.
- Weakest skill practice third.
- Conversation or writing prompt fourth.
- Optional exam task if the learner has an exam goal.

Each queue item should expose:

- id
- title
- skill
- level
- estimated minutes
- source: review, plan, weak-area, exam, free-practice
- reason shown to the learner
- destination route or workflow intent
- completion effect

This queue model should be testable without React.

## Activity Session Flow

All activity types should converge on a consistent session loop:

1. Prepare: show skill, topic, goal, estimated time, and start button.
2. Do: focused activity UI with progress, answer input, and stable action area.
3. Feedback: score, corrections, explanation, and what improved.
4. Save learning memory: convert mistakes, words, phrases, or revision notes into local review items.
5. Return: next queue item, retry, or review saved mistakes.

The old behavior of immediately navigating away after a score is too thin. Completion should feel useful because it captures what the learner needs next.

## Mistake Notebook

Mistakes should become a core product surface. Each saved mistake should contain:

- German text or utterance.
- Learner answer.
- Corrected answer.
- Explanation in learner's native language when useful.
- Skill category: grammar, vocabulary, pronunciation, listening, reading, writing.
- CEFR level.
- Source session.
- Review schedule.
- Status: new, learning, mastered, ignored.

The notebook should support search, filters, review action, and linking back to the source transcript or activity result.

## Review Flow

Review should combine vocabulary, grammar mistakes, phrases, and corrections. The first version can use a simple spaced repetition model, then improve later.

Review cards should support:

- Show prompt.
- Reveal answer or correction.
- Mark again, hard, good, or easy.
- Add note.
- Start a quick related practice when repeated failure is detected.

The review flow should be separate from the plan so daily learning does not depend only on generated activities.

## Conversation And Voice

Conversation should move from realtime Gemini Live to a stable turn-based tutor:

1. User chooses text or voice input.
2. Voice mode records a short turn.
3. Deepgram transcribes German speech.
4. The transcript is shown before or during submission, depending on latency.
5. OpenRouter-compatible tutor responds using learner profile, level, mode, and recent mistakes.
6. Session transcript and feedback are saved locally.

Conversation modes should be simplified around learner outcomes:

- Free talk
- Roleplay
- Pronunciation check
- Reading aloud
- Grammar repair
- Vocabulary activation

The UI should make transcript confidence and corrections understandable without turning the page into provider debug output.

## Writing Coach

Writing should be its own destination rather than only one activity type:

- Prompt selection by level, topic, and exam style.
- Draft editor.
- Feedback grouped by grammar, vocabulary, structure, and clarity.
- Revision pass with before/after comparison.
- Saved corrections to mistake notebook.

Old writing evaluation logic can remain behind the AI provider interface, but the UX should encourage revision, not just scoring.

## Settings And Local Files

Settings should be plain and inspectable:

- Local profile and learning goals.
- Data location and open local folder action.
- Backup, export, and import.
- AI provider status: configured, disabled, last error, selected model.
- Speech provider status: configured, disabled, selected Deepgram model/language.
- Privacy note explaining what leaves the device when AI or speech is enabled.

API keys should not be handled as normal browser state in the desktop release. Tauri should own secure storage or a local settings command boundary.

## Visual Direction

Before replacing major screens, create and approve visual concepts for:

- Dashboard
- Activity session and result
- Conversation with voice transcript
- Mistake notebook and review
- Settings

The design should be desktop-first, calm, and productivity-oriented:

- restrained palette with clear semantic colors
- compact sidebar or rail
- strong typography hierarchy
- stable action bars
- readable tables/lists where useful
- panels only where they frame real work
- no nested cards
- no decorative gradient-orb backgrounds
- no marketing hero as the app home
- no giant rounded elements when compact controls are better

The accepted visual concept becomes the implementation spec for UI work.

## Architecture Impact

The first implementation slice should create UI/domain models before changing large pages:

- `src/ui/navigationModel.ts`
- `src/ui/learningWorkflowModel.ts`
- `src/ui/designTokens.ts`

These modules should not depend on Supabase, Gemini, Deepgram, OpenRouter, or React. They should describe app destinations, queue item shape, activity session states, and result effects.

React pages should then consume those models. This keeps the experience independent from the temporary cloud adapters.

## Compatibility Rules

During migration:

- Keep current app runnable.
- Keep existing routes where practical, but allow redirects into new destinations.
- Do not preserve old UI copy or layout when it weakens the desktop experience.
- Keep old service calls behind provider/repository interfaces until local replacements are ready.
- Add compatibility shims only as temporary adapters, not as new product architecture.

## Error And Empty States

The app should handle missing cloud services as normal states:

- No AI key: show local sample exercises and explain that AI generation is disabled.
- No Deepgram key: keep text conversation available and show voice as disabled.
- AI failure: offer retry, use local fallback when possible, and do not lose the learner's draft.
- Speech failure: keep recorded/transcribed state clear and allow retry or manual text entry.
- No plan: show placement/setup next action.
- No mistakes: invite the learner to complete a session, not a decorative empty card.
- No reviews due: suggest plan, speaking, writing, or library practice.

## Testing Strategy

Before visual screen replacement, add tests for:

- navigation destination list and active route matching
- daily queue ordering
- queue item reasons
- activity session state transitions
- result-to-review/mistake conversion rules
- provider-disabled states for AI and speech

After UI work starts, add component or browser checks for:

- dashboard empty state
- dashboard with active plan and due reviews
- activity result save flow
- voice disabled state
- transcript turn saved state
- settings provider status

## Implementation Order

1. Write this spec and get user review.
2. Create a Phase 1.5 implementation plan.
3. Add test-first UI/domain models for navigation and learning workflow.
4. Generate and approve visual concepts for the primary app surfaces.
5. Build design tokens from the accepted concept.
6. Replace the app shell and dashboard.
7. Replace activity result flow so learning memory is saved.
8. Replace conversation UI with text-first and Deepgram-ready turn flow.
9. Add mistake notebook and review surfaces.
10. Add local settings surfaces for files, AI, and speech.

## Out Of Scope For This Phase

- Full Tauri packaging.
- SQLite repository implementation.
- Complete visual redesign implementation.
- Live streaming voice.
- Offline speech recognition.
- Paid content packs.
- Full migration from existing Supabase user data.

These remain in later phases of the local-first roadmap.

## Acceptance Criteria

The experience-first migration direction is ready to implement when:

- The user approves this spec.
- Navigation and workflow models can be implemented without cloud dependencies.
- The dashboard target is a daily learning cockpit, not the old home page.
- Activity completion includes feedback and learning-memory capture.
- Conversation target is turn-based Deepgram transcript plus AI tutor response.
- Mistakes and review are first-class destinations.
- Visual UI work is gated on approved concepts for the main surfaces.
