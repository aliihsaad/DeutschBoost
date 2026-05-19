# DeutschBoost UI System — Design

**Date:** 2026-05-19
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)

## Problem

DeutschBoost has two competing styling systems. Plan and Practice use Tailwind
with a polished modern look; the other ~9 pages use 180+ ad-hoc `.db-*` CSS
classes with flat colors and inconsistent layout. The result is an app that
looks good on two pages and dated/inconsistent everywhere else. The user wants
the whole app to be good-looking and easy for a language learner — not a
dev-tool aesthetic.

The earlier `docs/superpowers/specs/2026-05-15-deutschboost-visual-concept-brief.md`
("restrained workstation, no gradients") is **superseded** by this design: the
product is a consumer language-learning app and should feel warm, friendly, and
effortless.

## Approved Decisions

1. **Approach:** build a shared design kit (tokens + components) first, then
   convert every page onto it.
2. **Scope:** convert all pages, including Plan and Practice, so the app is a
   single system (single source of truth).
3. **Visual language:** friendly and cohesive — one coherent palette, soft cards
   with subtle depth, meaningful accent colors for skills/status, a consistent
   icon set; calmer than today's every-card-a-different-gradient; ages well.
4. **Brand color:** warm amber/gold (`#f2b705`) with charcoal text and soft
   neutral surfaces; semantic green/red/amber for status.

## Section 1 — Foundation (design tokens)

One canonical token layer, consumed via Tailwind v4 theme + CSS variables.
Replaces the split between `src/ui/designTokens.ts`, ad-hoc `--db-*` vars, and
hardcoded hex.

- **Brand:** `--brand: #f2b705`, `--brand-strong: #b77900` (text-on-light /
  accessible foreground), `--brand-soft: #fff4bf` (tints/backgrounds).
- **Neutrals:** `bg #f6f7f8`, `surface #ffffff`, `surface-soft #f8fafc`,
  `border #dfe3e8`, `border-strong #c5cad3`, `text #18181b`,
  `text-muted #666f7b`.
- **Semantic:** `success #16833a` / soft `#e8f7ee`; `danger #d92d20` / soft
  `#fff1ef`; `info #1d4ed8` / soft tint.
- **Skill accents** (small badges/icon chips only — never whole-card gradients):
  one fixed hue each for grammar, vocabulary, listening, reading, writing,
  speaking.
- **Typography:** Plus Jakarta Sans; page title 24, section 16, body 14,
  label 12.
- **Radius:** card 12, control 8, pill 999. **Elevation:** one soft shadow
  token; no glassmorphism/backdrop blur. **Spacing:** 4px base scale.
- **Icons:** one consistent icon set (FontAwesome already present); emoji not
  used as primary UI icons.

## Section 2 — Shared component kit

Location `components/ui/`, one file per component, Tailwind + tokens, no `.db-*`,
presentational with typed props, independently testable:

- `PageHeader` — title, subtitle, optional actions slot.
- `Card` — surface w/ soft shadow; variants `default | soft | interactive`;
  optional header/footer; no nested-card pattern.
- `Button` — `primary | secondary | ghost | danger`; sizes sm/md; loading +
  disabled; icon support.
- `Field` — labeled input/select/textarea wrapper with description + error.
- `Stat` — label + value + optional delta/progress.
- `Badge` / `Pill` — skill + status (new/learning/mastered, configured/error,
  CEFR level).
- `ProgressBar` / `Ring` — linear + circular progress.
- `EmptyState` — icon + message + action (placeholder, no-data,
  error-with-retry).
- `Toast` / inline `Notice` — success/error/info feedback.
- `SegmentedControl` / `OptionCard` — mode/level/skill pickers.
- `AppShell` — refactor of existing `ExperienceAppShell` to consume tokens and
  the new nav/status primitives (chrome stays, restyled).

Pages compose these; almost no bespoke layout CSS. This eliminates the 180+
`.db-*` classes.

## Section 3 — Page conversion map & order

Each page becomes a composition of kit components. Order by impact; each step is
independently shippable with green tests.

1. **AppShell + tokens** — foundation, nav, window bar, status pills. One global
   visual shift; no page logic touched.
2. **Dashboard** (`pages/LocalDashboardPage.tsx`) — `PageHeader` + `Stat` grid +
   `Card` panels (next action, today's queue, review due, weak areas, weekly
   strip, last session); `.db-level-meter` → `Ring`.
3. **Activity** (`pages/ActivityPage.tsx`) — prepare → active → result as Cards;
   consistent answer/feedback blocks; `EmptyState` for loading/error. Shared
   layout across the 6 activity types.
4. **Conversation** (`pages/SpeakingActivityPage.tsx`) — Card room: mode
   `OptionCard`s, clear learner/tutor transcript rows, live status as a calm
   `Badge`, stable control bar.
5. **Exam** (`pages/ExamSimulatorPage.tsx`) — largest `.db-exam-*` removal:
   level/section pickers, timed runner, question/option blocks, score sheet,
   history; loud-fail → `EmptyState` + retry.
6. **Placement** (`pages/EnhancedPlacementTestPage.tsx`) — sectioned test with
   visible progress, kit `Field`s, polished result.
7. **Settings** (`pages/LocalSettingsPage.tsx`) — provider Cards, `Field`s, test
   buttons with inline `Notice`, configured/error `Badge`s.
8. **Profile** (`pages/ProfilePage.tsx`) — profile summary + `Field`s,
   saved-state feedback.
9. **Plan & Practice** (`pages/LearningPlanPage.tsx`,
   `pages/PracticePage.tsx`) — refactor onto the kit last, **no visual
   regression** (same or slightly better), so the app is one system. Also retire
   ad-hoc styling in the 4 placeholder workspace pages via `EmptyState`.

Each page = its own implementation-plan step + commit + green tests before the
next.

## Section 4 — Migration & architecture

- **Tailwind v4 theme is the token source.** Define tokens as CSS variables in
  `src/index.css` `@theme`; kit components use Tailwind classes bound to them.
  `src/ui/designTokens.ts` becomes a thin typed re-export so the existing token
  test still has a target.
- **Incremental, non-breaking.** Add kit + tokens first (additive). Convert one
  page per step; delete only that page's now-dead `.db-*` rules in the same
  commit. `index.css` shrinks page-by-page until `.db-*` is gone.
- **Presentation-only.** No routing, state, provider, AI, audio, or data-flow
  changes. JSX structure may change; behavior, handlers, and accessible
  labels do not.
- **Accessibility preserved/improved.** Keep existing roles and `aria-label`s
  (tests and screen readers depend on them); maintain focus states, hit
  targets, and contrast. Amber on white uses `brand-strong` for text/foreground.
- **Boundaries.** Kit in `components/ui/` is dumb and reusable; pages remain the
  composition layer; `ExperienceAppShell` refactored in step 1.

## Section 5 — Testing, scope, success

- **Tests must stay green (currently 301).** Most assert roles/labels/text, not
  classes. Known intentional touch-ups, made in the same step as the related
  change: `tests/ui/designTokens.test.ts` (token values change); any test
  asserting a `.db-*` class or removed copy. No behavioral test rewrites.
- **Per-step verification:** full `npm run test:run` and `npm run build` green
  before a page step is done; visual self-check against the kit.
- **Out of scope:** new features; routing changes; the 4 placeholder workspaces'
  functionality (only their empty-state styling); backend/provider/AI/audio
  logic; mobile-native packaging.
- **Success criteria:** one token system; `.db-*` eliminated from
  `src/index.css`; every page composed from the kit; visually cohesive and
  learner-friendly; Plan/Practice no worse; full suite green; production build
  green.

## Decomposition

One spec (this document) → one multi-step implementation plan: kit + tokens
step, then ~9 page-conversion steps, each independently verified and committed.
