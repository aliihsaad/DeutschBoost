# DeutschBoost Local Learning Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active learning-plan, placement-result, and study-progress path with a local repository boundary so DeutschBoost can run without Supabase for core learning flow.

**Architecture:** Extend the existing `LearningPlanRepository` interface into a storage-backed domain repository, then expose a browser-local adapter as the interim persistence layer. Keep the repository storage API async-capable so the same domain code can later receive a Tauri SQLite adapter without changing pages.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, localStorage-compatible storage adapter now, Tauri SQLite/local files later.

---

## Files

- Modify: `src/domain/learning/learningPlanRepository.ts`
  - Add storage-backed repository factory.
  - Normalize saved plans and generate stable local IDs.
  - Store placement results and active learning plans in one local store.
- Create: `src/infrastructure/browser/learningPlanStorage.ts`
  - Browser `localStorage` adapter with in-memory fallback.
- Create: `tests/domain/learning/learningPlanRepository.test.ts`
  - Repository behavior tests.
- Create: `tests/infrastructure/browser/learningPlanStorage.test.ts`
  - Browser adapter tests.
- Modify: `services/learningPlanService.ts`
  - Replace Supabase calls with the local repository and profile repository.
- Modify: `tests/services/learningPlanService.test.ts`
  - Remove Supabase mocks and test local behavior.
- Modify: `MainApp.tsx`
  - Load and save plans for `local-learner`.
  - Remove direct Supabase test-result/profile writes.
- Modify: `pages/EnhancedPlacementTestPage.tsx`
  - Stop writing placement results directly to Supabase; let `onTestComplete` own local persistence.
- Modify: `pages/LearningPlanPage.tsx`
  - Load study streak/time from the local profile repository instead of Supabase.
- Modify: `pages/ActivityPage.tsx`
  - Allow activity completion without a logged-in Supabase user.
- Modify: `tests/MainApp.providerRuntime.test.tsx`
  - Update mocks for local learning/profile repositories.
- Modify: `App.tsx`
  - Remove the Supabase auth wrapper from the active local app shell.
- Modify: `pages/PracticePage.tsx`
  - Remove cloud-backed practice sessions and replace free-text topic entry with a fixed topic list.
- Modify: `pages/SpeakingActivityPage.tsx`
  - Load local profile context instead of Supabase auth context.
- Modify: `pages/ExamSimulatorPage.tsx`
  - Load the default exam level from the local profile repository.
- Create: `tests/architecture/noCloudAuthInLocalShell.test.ts`
  - Guard active local routes against reintroducing Supabase auth/cloud service imports.
- Create: `tests/pages/LearningPlanPage.test.tsx`
  - Verify local profile stats are used without auth.

---

### Task 1: Local Learning Plan Repository

**Files:**
- Modify: `src/domain/learning/learningPlanRepository.ts`
- Test: `tests/domain/learning/learningPlanRepository.test.ts`

- [x] **Step 1: Write failing repository tests**

Create tests proving:

```ts
const repository = createStorageLearningPlanRepository({
  storage,
  now: () => '2026-05-15T12:00:00.000Z',
  idFactory: () => 'plan-1',
  itemIdFactory: (planId, week, index) => `${planId}-w${week}-i${index}`,
  placementIdFactory: () => 'placement-1',
});
```

Expected behaviors:

- `loadActive('local-learner')` returns `null` when storage is empty.
- `save({ learnerId: 'local-learner', plan })` assigns `planId` and item IDs.
- Saving a second plan deactivates the first active plan.
- `markItemCompletion({ learnerId, itemId, completed })` updates the stored item.
- `recordPlacementResult(learnerId, result)` stores a local placement result.
- Corrupt JSON is cleared and treated as empty storage.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/domain/learning/learningPlanRepository.test.ts
```

Expected: FAIL because `createStorageLearningPlanRepository` is not exported yet.

- [x] **Step 3: Implement repository factory**

Add:

```ts
export const DEFAULT_LEARNING_PLAN_STORAGE_KEY = 'deutschboost.learningPlans.v1';
export interface LearningPlanStorage { getItem(...); setItem(...); removeItem(...); }
export function createStorageLearningPlanRepository(...): LearningPlanRepository
```

The store shape is:

```ts
interface LearningPlanStore {
  activePlanIdsByLearner: Record<string, string>;
  plans: Array<{ id; learnerId; placementResultId?; isActive; createdAt; plan }>;
  placementResults: PlacementResultRecord[];
}
```

- [x] **Step 4: Verify repository tests pass**

Run:

```bash
npm run test:run -- tests/domain/learning/learningPlanRepository.test.ts
```

Expected: PASS.

---

### Task 2: Browser Adapter

**Files:**
- Create: `src/infrastructure/browser/learningPlanStorage.ts`
- Test: `tests/infrastructure/browser/learningPlanStorage.test.ts`

- [x] **Step 1: Write failing adapter tests**

Tests should mirror existing profile/settings adapter tests:

```ts
const storage = createBrowserLearningPlanStorage(localStorageLike);
storage.setItem('plans', 'value');
expect(localStorageLike.setItem).toHaveBeenCalledWith('plans', 'value');
```

Also assert `browserLearningPlanRepository` is exported.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/infrastructure/browser/learningPlanStorage.test.ts
```

Expected: FAIL because the file does not exist.

- [x] **Step 3: Implement browser storage adapter**

Use the same in-memory fallback pattern as `profileStorage.ts` and `providerSettingsStorage.ts`.

- [x] **Step 4: Verify adapter tests pass**

Run:

```bash
npm run test:run -- tests/infrastructure/browser/learningPlanStorage.test.ts
```

Expected: PASS.

---

### Task 3: Learning Plan Service Migration

**Files:**
- Modify: `services/learningPlanService.ts`
- Modify: `tests/services/learningPlanService.test.ts`

- [x] **Step 1: Write failing service tests**

Tests should assert:

- Empty plan validation fails before storage writes.
- Empty week validation fails before storage writes.
- Valid plan saves through local repository and normalizes lowercase skill names.
- Loading active plan returns the locally saved active plan.
- Updating completion changes the saved item.
- Updating progress changes local profile `studyStreak` and `totalStudyTimeMinutes`.

- [x] **Step 2: Verify tests fail against Supabase-backed service**

Run:

```bash
npm run test:run -- tests/services/learningPlanService.test.ts
```

Expected: FAIL after tests stop mocking Supabase and expect local repository behavior.

- [x] **Step 3: Replace Supabase implementation**

Use `browserLearningPlanRepository` and `browserProfileRepository` by default. Keep exported function names stable:

```ts
saveLearningPlan(userId, plan, placementResultId)
loadActiveLearningPlan(userId)
updatePlanItemCompletion(userId, itemId, completed)
updateUserProgress(userId, activityType, durationSeconds, itemsCompleted)
```

- [x] **Step 4: Verify service tests pass**

Run:

```bash
npm run test:run -- tests/services/learningPlanService.test.ts
```

Expected: PASS.

---

### Task 4: Active Flow Wiring

**Files:**
- Modify: `MainApp.tsx`
- Modify: `pages/EnhancedPlacementTestPage.tsx`
- Modify: `pages/LearningPlanPage.tsx`
- Modify: `pages/ActivityPage.tsx`
- Modify: `tests/MainApp.providerRuntime.test.tsx`

- [x] **Step 1: Write failing UI integration tests**

Extend `tests/MainApp.providerRuntime.test.tsx` to assert:

- `MainApp` loads the learning plan through the local service even when `user` is `null`.
- `handleTestComplete` records a local placement result, saves a generated plan, and navigates to `/learning-plan` without calling Supabase.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/MainApp.providerRuntime.test.tsx
```

Expected: FAIL because `MainApp` still depends on `user` and imports Supabase.

- [x] **Step 3: Wire local learner ID**

Use a constant:

```ts
const LOCAL_LEARNER_ID = 'local-learner';
```

Remove direct Supabase writes from `MainApp.tsx` and `EnhancedPlacementTestPage.tsx`.

- [x] **Step 4: Move profile stats to local profile repository**

In `LearningPlanPage.tsx`, load `studyStreak` and `totalStudyTimeMinutes` from `browserProfileRepository`.

- [x] **Step 5: Allow local activity completion**

In `ActivityPage.tsx`, use `user?.id ?? 'local-learner'` and only require `itemId`.

- [x] **Step 6: Verify UI integration tests pass**

Run:

```bash
npm run test:run -- tests/MainApp.providerRuntime.test.tsx tests/pages/LearningPlanPage.test.tsx
```

Expected: PASS.

---

### Task 5: Final Verification And Commit

- [x] **Step 1: Run focused tests**

Run:

```bash
npm run test:run -- tests/domain/learning/learningPlanRepository.test.ts tests/infrastructure/browser/learningPlanStorage.test.ts tests/services/learningPlanService.test.ts tests/MainApp.providerRuntime.test.tsx
```

- [x] **Step 2: Run full test suite**

Run:

```bash
npm run test:run
```

- [x] **Step 3: Run production build**

Run:

```bash
npm run build
```

- [x] **Step 4: Commit only this slice**

Do not stage the user's existing `package.json` or `package-lock.json` changes unless explicitly requested.

```bash
git add MainApp.tsx pages/EnhancedPlacementTestPage.tsx pages/LearningPlanPage.tsx pages/ActivityPage.tsx services/learningPlanService.ts src/domain/learning/learningPlanRepository.ts src/infrastructure/browser/learningPlanStorage.ts tests/domain/learning/learningPlanRepository.test.ts tests/infrastructure/browser/learningPlanStorage.test.ts tests/services/learningPlanService.test.ts tests/MainApp.providerRuntime.test.tsx docs/superpowers/plans/2026-05-15-deutschboost-local-learning-data-layer.md
git commit -m "feat: add local learning data layer"
```

---

## Self Review

- Spec coverage: This plan covers the first critical persistence slice: learning plans, placement results, item completion, and study progress. It intentionally leaves conversation storage, practice sessions, mistakes, review, and real Tauri SQLite for later slices.
- Placeholder scan: No TBD placeholders remain.
- Type consistency: The repository names match existing `src/domain/learning/learningPlanRepository.ts` exports, and page/service function names stay stable for current callers.
