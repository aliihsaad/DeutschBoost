# DeutschBoost Native Release Readiness

This project now has a shared storage boundary, optional native storage adapter shapes, a working Tauri desktop shell, and Stronghold-backed provider secrets for packaged desktop builds. The next release work is Android packaging plus Android-native secret storage.

## Current Targets

| Target | Runtime | Storage expectation | Secret expectation |
| --- | --- | --- | --- |
| PWA | Browser | Browser-managed storage | Browser-managed fallback only |
| Desktop | Tauri v2 | Tauri Store or SQL-backed adapter | Tauri Stronghold-backed provider secret adapter |
| Android APK | Capacitor | Capacitor Preferences now, SQLite later for larger stores | Android encrypted storage adapter |

## Check Readiness

Run:

```bash
node scripts/native-readiness.mjs
```

The checker validates:

- PWA build script and PWA plugin.
- Tauri package/scripts/config files and Rust toolchain.
- Capacitor package/scripts/config files, Android project, Java, and Android SDK environment.

Current status after the desktop-shell stage:

- PWA release: ready.
- Desktop installable release: ready on this machine after installing Rust with rustup.
- Android APK release: blocked until the Capacitor packages/project, Java JDK, and Android SDK are installed.

## Desktop Installable Release Path

Use Tauri for desktop because the app already has a local-first React core and needs device-local storage, offline support, and installable releases.

Implemented desktop foundation:

- `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-stronghold`, and `@tauri-apps/cli` are installed.
- `src-tauri/` is initialized for the existing Vite app with `devUrl` `http://localhost:5173` and frontend output `../dist`.
- Tauri Store and Stronghold permissions are enabled in `src-tauri/capabilities/default.json`.
- The Rust shell initializes the Store and Stronghold plugins.
- The TypeScript provider settings wiring prefers a Tauri Stronghold secret adapter in packaged desktop builds, so OpenRouter and Deepgram keys are not stored in ordinary settings JSON.
- `npm run tauri:build` produced `src-tauri/target/release/bundle/nsis/DeutschBoost_0.0.4_x64-setup.exe`.
- Packaged desktop smoke passed for v0.0.4 on this machine: app launch was not blank, saved OpenRouter/Deepgram settings loaded, placement completed through evaluation with intentionally incomplete OpenRouter JSON, the ErrorBoundary did not appear, and a normalized learning plan was generated. Synthetic smoke data was removed afterward.

Useful commands:

```bash
npm run tauri:dev
npm run tauri:build
```

## GitHub Desktop Release Tags

The Windows desktop installer is built by `.github/workflows/desktop-release.yml`.

- Keep the versions aligned in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- Push a semantic version tag such as `v0.0.4` to run the release workflow.
- The workflow runs the Vitest suite, builds the Tauri NSIS installer on `windows-latest`, and publishes a GitHub prerelease with the setup executable attached.
- The current installer is unsigned, so Windows may show an unknown publisher warning until code signing is configured.

Release commands:

```bash
git tag -a v0.0.4 -m "DeutschBoost v0.0.4 desktop pre-release"
git push origin master
git push origin v0.0.4
```

Known release note: `v0.0.1` was the first desktop pre-release and exposed a blank-window startup bug caused by eager Gemini API key initialization. Use `v0.0.2` or newer for desktop testing.
Known release note: `v0.0.2` fixed startup and Deepgram desktop bridge issues, but placement question generation still used a legacy Gemini-only path. Use `v0.0.3` or newer for placement-test desktop testing.
Known release note: `v0.0.3` routes placement question generation through the configured AI provider and routes Settings, listening, vocabulary, and tutor reply playback through Deepgram TTS when Deepgram is enabled. Browser/system TTS remains only a no-provider fallback.
Known release note: `v0.0.4` fixes the placement evaluation crash caused by AI JSON missing `strengths` or `weaknesses`, normalizes learning-plan JSON before rendering/saving, and keeps the desktop app from showing the ErrorBoundary after placement submission.

## Conversation V2 Release Gate

Do not push or tag the next desktop release until the packaged Tauri app passes this checklist on the target machine:

- App launch is not blank.
- Settings shows saved OpenRouter and Deepgram provider configuration from native storage/Stronghold.
- Settings Deepgram key test and speak test pass.
- Conversation shows `Start live practice` when both streaming providers are configured.
- `Start live practice` reaches `Listening` without a manual record/send step.
- A short German learner utterance creates a final learner transcript.
- OpenRouter tutor text streams into the transcript.
- Deepgram TTS plays the tutor reply.
- `Interrupt` returns the live session to `Listening`.
- `End session` saves the local conversation session.
- Fallback manual `Start session` -> `Record answer` -> `Stop and send` still works.

If a shell was open before Rust was installed, restart it or prepend Cargo manually for the current session:

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
```

Desktop note before public release: the current Stronghold vault password is app-managed for a no-login local app. It protects keys from ordinary JSON/browser storage exposure and keeps them recoverable for provider calls, but it is not the same as a user-entered passphrase or OS keychain account binding.

## Android APK Path

Use Capacitor for Android because the user accepted internet-connected mobile and the React core can remain shared.

1. Install Java JDK 17+ and Android Studio.
2. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`.
3. Add Capacitor packages:

```bash
npm i @capacitor/core @capacitor/android @capacitor/preferences
npm i -D @capacitor/cli
```

4. Initialize Capacitor:

```bash
npx cap init DeutschBoost com.deutschboost.app --web-dir dist
npx cap add android
```

5. Add scripts:

```json
{
  "android:sync": "npm run build && cap sync android",
  "android:open": "cap open android"
}
```

6. Configure Android signing only after a debug APK runs correctly.

## Important Constraints

- Do not hash-only OpenRouter or Deepgram API keys. The app needs recoverable keys to call the providers.
- Browser storage is acceptable for PWA fallback, but packaged desktop/mobile builds need native secure secret storage before distribution.
- Do not add cloud auth back into the local app shell.
