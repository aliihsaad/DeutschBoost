# DeutschBoost Platform Persistence Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared persistence boundary so the same app core can target browser/PWA storage now, then Tauri desktop and Android APK native storage without rewriting repositories.

**Architecture:** Create an async-capable `KeyValueStorage` contract in the domain layer, with infrastructure factories that select native storage when supplied, browser storage when available, and memory only as a non-durable fallback. Existing browser repository adapters keep their public exports but delegate to the shared storage boundary instead of each reimplementing localStorage detection.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, async key/value repository adapters, future Tauri/Capacitor native storage adapters.

---

## Files

- Create: `src/domain/storage/keyValueStorage.ts`
  - Define `KeyValueStorage`, `StorageDurability`, `StorageRuntime`, and `createMemoryKeyValueStorage`.
- Create: `src/infrastructure/platform/keyValueStorage.ts`
  - Define `BrowserStorageLike`, `createBrowserKeyValueStorage`, `createPlatformKeyValueStorage`, and `resolveBrowserLocalStorage`.
- Create: `tests/domain/storage/keyValueStorage.test.ts`
  - Verify memory storage semantics.
- Create: `tests/infrastructure/platform/keyValueStorage.test.ts`
  - Verify native-first, browser-second, memory-fallback runtime selection.
- Modify: `src/infrastructure/browser/providerSettingsStorage.ts`
  - Delegate storage creation to `createBrowserKeyValueStorage`.
- Modify: `src/infrastructure/browser/profileStorage.ts`
  - Delegate storage creation to `createBrowserKeyValueStorage`.
- Modify: `src/infrastructure/browser/learningPlanStorage.ts`
  - Delegate storage creation to `createBrowserKeyValueStorage`.
- Modify: `src/infrastructure/browser/conversationStorage.ts`
  - Make storage async-compatible and delegate default storage to the platform key/value boundary.
- Modify: existing infrastructure tests
  - Keep existing public adapter contracts green, adding async expectations where needed.

---

### Task 1: Domain Key/Value Storage Contract

**Files:**
- Create: `src/domain/storage/keyValueStorage.ts`
- Test: `tests/domain/storage/keyValueStorage.test.ts`

- [x] **Step 1: Write failing domain tests**

Tests assert:
- Memory storage starts empty.
- `setItem`, `getItem`, and `removeItem` work.
- Metadata identifies memory fallback as non-durable.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/domain/storage/keyValueStorage.test.ts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement domain storage contract**

Add the async-compatible storage interface and memory implementation.

- [x] **Step 4: Verify domain tests pass**

Run:

```bash
npm run test:run -- tests/domain/storage/keyValueStorage.test.ts
```

Expected: PASS.

---

### Task 2: Platform Storage Selection

**Files:**
- Create: `src/infrastructure/platform/keyValueStorage.ts`
- Test: `tests/infrastructure/platform/keyValueStorage.test.ts`

- [x] **Step 1: Write failing platform tests**

Tests assert:
- A supplied native storage is preferred and marked `runtime: "native"`.
- Browser storage is selected when no native storage is supplied.
- Memory fallback is selected when browser storage is unavailable.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/infrastructure/platform/keyValueStorage.test.ts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement platform storage factory**

Keep native storage as an injected dependency for future Tauri/Capacitor adapters.

- [x] **Step 4: Verify platform tests pass**

Run:

```bash
npm run test:run -- tests/infrastructure/platform/keyValueStorage.test.ts
```

Expected: PASS.

---

### Task 3: Migrate Current Browser Repositories To Shared Boundary

**Files:**
- Modify: `src/infrastructure/browser/providerSettingsStorage.ts`
- Modify: `src/infrastructure/browser/profileStorage.ts`
- Modify: `src/infrastructure/browser/learningPlanStorage.ts`
- Modify: `src/infrastructure/browser/conversationStorage.ts`
- Test: existing `tests/infrastructure/browser/*.test.ts`

- [x] **Step 1: Write/adjust failing adapter tests**

Add expectations proving the adapters expose platform metadata and remain compatible with current repositories.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/infrastructure/browser/providerSettingsStorage.test.ts tests/infrastructure/browser/profileStorage.test.ts tests/infrastructure/browser/learningPlanStorage.test.ts tests/infrastructure/browser/conversationStorage.test.ts
```

Expected: FAIL before migration because adapters do not expose the shared metadata and conversation storage is not async-shaped.

- [x] **Step 3: Migrate adapters**

Replace duplicated localStorage/memory helpers with calls to the shared platform factory. Convert conversation store reads/writes to `await` the storage interface.

- [x] **Step 4: Verify adapter tests pass**

Run:

```bash
npm run test:run -- tests/infrastructure/browser/providerSettingsStorage.test.ts tests/infrastructure/browser/profileStorage.test.ts tests/infrastructure/browser/learningPlanStorage.test.ts tests/infrastructure/browser/conversationStorage.test.ts
```

Expected: PASS.

---

### Task 4: Final Verification And Commit

- [x] **Step 1: Run focused storage tests**

Run:

```bash
npm run test:run -- tests/domain/storage/keyValueStorage.test.ts tests/infrastructure/platform/keyValueStorage.test.ts tests/infrastructure/browser/providerSettingsStorage.test.ts tests/infrastructure/browser/profileStorage.test.ts tests/infrastructure/browser/learningPlanStorage.test.ts tests/infrastructure/browser/conversationStorage.test.ts
```

- [x] **Step 2: Run full tests**

Run:

```bash
npm run test:run
```

- [x] **Step 3: Run production build**

Run:

```bash
npm run build
```

- [x] **Step 4: Commit scoped changes**

Do not stage the user's existing `package.json` or `package-lock.json` changes.

```bash
git add docs/superpowers/plans/2026-05-15-deutschboost-platform-persistence-boundary.md src/domain/storage/keyValueStorage.ts src/infrastructure/platform/keyValueStorage.ts src/infrastructure/browser/providerSettingsStorage.ts src/infrastructure/browser/profileStorage.ts src/infrastructure/browser/learningPlanStorage.ts src/infrastructure/browser/conversationStorage.ts tests/domain/storage/keyValueStorage.test.ts tests/infrastructure/platform/keyValueStorage.test.ts tests/infrastructure/browser/providerSettingsStorage.test.ts tests/infrastructure/browser/profileStorage.test.ts tests/infrastructure/browser/learningPlanStorage.test.ts tests/infrastructure/browser/conversationStorage.test.ts
git commit -m "feat: add platform persistence boundary"
```

---

## Self Review

- Spec coverage: This plan creates the best-practice persistence seam for shared web, desktop, and Android packaging. It does not add Capacitor/Tauri dependencies yet; that belongs in a later adapter-specific slice.
- Placeholder scan: No TBD placeholders remain.
- Type consistency: Storage interfaces are async-compatible and structurally compatible with current repository storage contracts.
