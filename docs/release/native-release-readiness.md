# DeutschBoost Native Release Readiness

This project now has a shared storage boundary and optional native storage adapter shapes. The next release work is platform packaging, not more browser storage.

## Current Targets

| Target | Runtime | Storage expectation | Secret expectation |
| --- | --- | --- | --- |
| PWA | Browser | Browser-managed storage | Browser-managed fallback only |
| Desktop | Tauri v2 | Tauri Store or SQL-backed adapter | Tauri Stronghold or OS keychain adapter |
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

## Desktop Installable Release Path

Use Tauri for desktop because the app already has a local-first React core and needs device-local storage, offline support, and installable releases.

1. Install Rust with `rustup` so `rustc` and `cargo` are on `PATH`.
2. Add Tauri packages:

```bash
npm i @tauri-apps/api @tauri-apps/plugin-store @tauri-apps/plugin-stronghold
npm i -D @tauri-apps/cli
```

3. Initialize the Tauri shell for the existing Vite app:

```bash
npx tauri init
```

Use:

- Dev URL: `http://localhost:5173`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`
- Web assets: `../dist`

4. Add scripts:

```json
{
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

5. Configure Tauri plugin permissions for store/stronghold before treating packaged secrets as production-safe.

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
