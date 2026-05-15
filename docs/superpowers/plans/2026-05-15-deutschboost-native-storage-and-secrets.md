# DeutschBoost Native Storage And Provider Secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DeutschBoost ready for desktop/mobile native storage while moving provider API keys out of ordinary settings JSON.

**Architecture:** Add optional native key/value adapters for Tauri Store and Capacitor Preferences without hard package imports, then add a provider-secret storage boundary that can wrap browser storage now and native secure storage later. Provider settings keep returning API keys in memory for runtime use, but saved public settings no longer contain `apiKey` fields when a secret store is configured.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tauri v2 Store-compatible adapter, Capacitor Preferences-compatible adapter, provider secret storage boundary.

---

## Research Basis

- Tauri Store is the official persistent key/value plugin and supports Windows, Linux, macOS, Android, and iOS; it is async and can save state to disk.
- Tauri plugin permissions are capability-gated, so frontend code should keep native calls behind a narrow adapter.
- Capacitor documents browser `localStorage` as transient in WebViews and recommends native Preferences for small key/value data, with SQLite/encrypted storage for larger or sensitive data.
- Tauri Stronghold is the future secure-storage target for secrets, but this slice avoids adding native dependencies until the shell exists.

---

## Files

- Create: `src/domain/settings/providerSecretStorage.ts`
  - Define provider secret names and a storage wrapper over `KeyValueStorage`.
- Modify: `src/domain/settings/providerSettingsRepository.ts`
  - Add optional `secretStorage` support.
  - Save API keys outside public settings JSON when a secret store is supplied.
  - Load existing legacy inline keys and migrate them into secret storage.
- Create: `src/infrastructure/native/keyValueStorage.ts`
  - Add optional Tauri Store and Capacitor Preferences adapters.
  - Add installed-native detection through globals only.
- Modify: `src/infrastructure/platform/keyValueStorage.ts`
  - Add `createDefaultPlatformKeyValueStorage`.
- Modify: browser repository modules
  - Default repositories use platform-aware storage instead of browser-only storage.
  - Provider settings repository uses a provider secret store.
- Create: `tests/domain/settings/providerSecretStorage.test.ts`
- Modify: `tests/domain/settings/providerSettingsRepository.test.ts`
- Create: `tests/infrastructure/native/keyValueStorage.test.ts`
- Modify: `tests/infrastructure/platform/keyValueStorage.test.ts`

---

### Task 1: Provider Secret Storage Boundary

**Files:**
- Create: `src/domain/settings/providerSecretStorage.ts`
- Test: `tests/domain/settings/providerSecretStorage.test.ts`

- [x] **Step 1: Write failing secret storage tests**

Tests assert:
- `createKeyValueProviderSecretStorage` saves and reloads `ai.apiKey` and `speech.apiKey`.
- Removing one secret does not remove the other.
- Corrupt secret JSON is cleared and treated as empty.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/domain/settings/providerSecretStorage.test.ts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement provider secret storage**

Use a dedicated storage key `deutschboost.providerSecrets.v1` and JSON object values.

- [x] **Step 4: Verify tests pass**

Run:

```bash
npm run test:run -- tests/domain/settings/providerSecretStorage.test.ts
```

Expected: PASS.

---

### Task 2: Provider Settings Secret Split

**Files:**
- Modify: `src/domain/settings/providerSettingsRepository.ts`
- Test: `tests/domain/settings/providerSettingsRepository.test.ts`

- [x] **Step 1: Write failing repository tests**

Tests assert:
- With `secretStorage`, saved public settings JSON has no `apiKey` fields.
- `load()` still returns the API keys by merging secret storage into normalized settings.
- Legacy inline API keys are migrated into secret storage and removed from public settings JSON.
- `reset()` removes both public settings and provider secrets.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/domain/settings/providerSettingsRepository.test.ts
```

Expected: FAIL before repository support exists.

- [x] **Step 3: Implement repository secret split**

Keep existing behavior when no `secretStorage` is supplied for compatibility with focused unit tests and old callers.

- [x] **Step 4: Verify repository tests pass**

Run:

```bash
npm run test:run -- tests/domain/settings/providerSettingsRepository.test.ts
```

Expected: PASS.

---

### Task 3: Optional Native Key/Value Adapters

**Files:**
- Create: `src/infrastructure/native/keyValueStorage.ts`
- Modify: `src/infrastructure/platform/keyValueStorage.ts`
- Test: `tests/infrastructure/native/keyValueStorage.test.ts`
- Test: `tests/infrastructure/platform/keyValueStorage.test.ts`

- [x] **Step 1: Write failing native adapter tests**

Tests assert:
- Tauri Store adapter loads one store, reads strings, writes strings, deletes keys, and calls `save()` after writes.
- Capacitor Preferences adapter maps `get`, `set`, and `remove` to `KeyValueStorage`.
- Installed-native detection prefers Tauri Store over Capacitor Preferences and returns `null` when neither is present.
- Default platform storage prefers detected native storage before browser storage.

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/infrastructure/native/keyValueStorage.test.ts tests/infrastructure/platform/keyValueStorage.test.ts
```

Expected: FAIL because native adapter exports do not exist.

- [x] **Step 3: Implement native adapters**

Use structural types only. Do not import `@tauri-apps/*` or `@capacitor/*` packages in this slice.

- [x] **Step 4: Verify native adapter tests pass**

Run:

```bash
npm run test:run -- tests/infrastructure/native/keyValueStorage.test.ts tests/infrastructure/platform/keyValueStorage.test.ts
```

Expected: PASS.

---

### Task 4: Wire Defaults To Platform-Aware Storage

**Files:**
- Modify: `src/infrastructure/browser/providerSettingsStorage.ts`
- Modify: `src/infrastructure/browser/profileStorage.ts`
- Modify: `src/infrastructure/browser/learningPlanStorage.ts`
- Modify: `src/infrastructure/browser/conversationStorage.ts`
- Test: existing infrastructure/page/service tests

- [x] **Step 1: Adjust tests if public settings no longer contain secrets**

Keep UI behavior the same: saved keys are hidden, tests can still use saved keys, and runtime providers still receive keys from repository-loaded settings.

- [x] **Step 2: Implement default repository wiring**

Default repositories use `createDefaultPlatformKeyValueStorage()`. Provider settings also wraps that storage with `createKeyValueProviderSecretStorage()`.

- [x] **Step 3: Run focused verification**

Run:

```bash
npm run test:run -- tests/domain/settings/providerSecretStorage.test.ts tests/domain/settings/providerSettingsRepository.test.ts tests/infrastructure/native/keyValueStorage.test.ts tests/infrastructure/platform/keyValueStorage.test.ts tests/pages/LocalSettingsPage.test.tsx tests/MainApp.providerRuntime.test.tsx
```

- [x] **Step 4: Run full verification and commit**

Run:

```bash
npm run test:run
npm run build
git diff --check
git add docs/superpowers/plans/2026-05-15-deutschboost-native-storage-and-secrets.md src/domain/settings/providerSecretStorage.ts src/domain/settings/providerSettingsRepository.ts src/infrastructure/native/keyValueStorage.ts src/infrastructure/platform/keyValueStorage.ts src/infrastructure/browser/providerSettingsStorage.ts src/infrastructure/browser/profileStorage.ts src/infrastructure/browser/learningPlanStorage.ts src/infrastructure/browser/conversationStorage.ts tests/domain/settings/providerSecretStorage.test.ts tests/domain/settings/providerSettingsRepository.test.ts tests/infrastructure/native/keyValueStorage.test.ts tests/infrastructure/platform/keyValueStorage.test.ts tests/pages/LocalSettingsPage.test.tsx
git commit -m "feat: add native storage adapters and provider secrets"
```

Do not stage the user's existing `package.json` or `package-lock.json` changes.

---

## Self Review

- Spec coverage: Covers native storage readiness and provider-key separation without adding unverified native dependencies.
- Placeholder scan: No TBD placeholders remain.
- Type consistency: `KeyValueStorage` stays the shared persistence contract; provider secrets use a narrow wrapper instead of changing every repository.

## Follow-up: Tauri Stronghold Desktop Secrets

Commit pending for the follow-up slice after the Tauri shell landed:

- Added `src/infrastructure/native/providerSecretStorage.ts` as a Tauri Stronghold-backed `ProviderSecretStorage`.
- Default provider settings wiring now prefers the installed Stronghold adapter when running inside Tauri and falls back to key/value secret storage for browser/PWA.
- Provider settings `update()` now loads through the configured secret storage so non-key updates do not accidentally erase existing provider keys.
- Tauri capabilities now include `stronghold:allow-remove-store-record` because resetting/removing provider keys uses the Stronghold store removal command.
