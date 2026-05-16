import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const TARGETS = {
  pwa: {
    label: 'PWA release',
    checks: [
      {
        id: 'build-script',
        label: 'Has npm build script',
        action: 'Keep scripts.build mapped to the production Vite build.',
        test: context => hasScript(context.packageJson, 'build'),
      },
      {
        id: 'pwa-plugin-package',
        label: 'Has vite-plugin-pwa installed',
        action: 'Install vite-plugin-pwa or keep it in dependencies/devDependencies.',
        test: context => hasPackage(context.packageJson, 'vite-plugin-pwa'),
      },
    ],
  },
  desktop: {
    label: 'Desktop installable release',
    checks: [
      {
        id: 'tauri-cli-package',
        label: 'Has Tauri CLI package',
        action: 'Install @tauri-apps/cli as a dev dependency.',
        test: context => hasPackage(context.packageJson, '@tauri-apps/cli'),
      },
      {
        id: 'tauri-api-package',
        label: 'Has Tauri frontend API package',
        action: 'Install @tauri-apps/api as an app dependency.',
        test: context => hasPackage(context.packageJson, '@tauri-apps/api'),
      },
      {
        id: 'tauri-store-package',
        label: 'Has Tauri Store plugin package',
        action: 'Install @tauri-apps/plugin-store to back local key/value storage.',
        test: context => hasPackage(context.packageJson, '@tauri-apps/plugin-store'),
      },
      {
        id: 'tauri-stronghold-package',
        label: 'Has Tauri Stronghold plugin package',
        action: 'Install @tauri-apps/plugin-stronghold or wire an OS keychain adapter for provider secrets.',
        test: context => hasPackage(context.packageJson, '@tauri-apps/plugin-stronghold'),
      },
      {
        id: 'tauri-dev-script',
        label: 'Has tauri:dev script',
        action: 'Add a tauri:dev script that runs the Tauri development shell.',
        test: context => hasScript(context.packageJson, 'tauri:dev'),
      },
      {
        id: 'tauri-build-script',
        label: 'Has tauri:build script',
        action: 'Add a tauri:build script that creates the installable desktop bundle.',
        test: context => hasScript(context.packageJson, 'tauri:build'),
      },
      {
        id: 'tauri-config',
        label: 'Has src-tauri/tauri.conf.json',
        action: 'Initialize or add the src-tauri/tauri.conf.json desktop shell config.',
        test: context => context.files.has('src-tauri/tauri.conf.json'),
      },
      {
        id: 'tauri-cargo-manifest',
        label: 'Has src-tauri/Cargo.toml',
        action: 'Initialize the Rust sidecar project with src-tauri/Cargo.toml.',
        test: context => context.files.has('src-tauri/Cargo.toml'),
      },
      {
        id: 'rustc-command',
        label: 'Rust compiler is available',
        action: 'Install Rust with rustup so rustc is available on PATH.',
        test: context => context.commands.has('rustc'),
      },
      {
        id: 'cargo-command',
        label: 'Cargo is available',
        action: 'Install Rust with rustup so cargo is available on PATH.',
        test: context => context.commands.has('cargo'),
      },
    ],
  },
  android: {
    label: 'Android APK release',
    checks: [
      {
        id: 'capacitor-cli-package',
        label: 'Has Capacitor CLI package',
        action: 'Install @capacitor/cli as a dev dependency.',
        test: context => hasPackage(context.packageJson, '@capacitor/cli'),
      },
      {
        id: 'capacitor-core-package',
        label: 'Has Capacitor core package',
        action: 'Install @capacitor/core as an app dependency.',
        test: context => hasPackage(context.packageJson, '@capacitor/core'),
      },
      {
        id: 'capacitor-android-package',
        label: 'Has Capacitor Android package',
        action: 'Install @capacitor/android as an app dependency.',
        test: context => hasPackage(context.packageJson, '@capacitor/android'),
      },
      {
        id: 'capacitor-preferences-package',
        label: 'Has Capacitor Preferences package',
        action: 'Install @capacitor/preferences to back native key/value storage.',
        test: context => hasPackage(context.packageJson, '@capacitor/preferences'),
      },
      {
        id: 'android-sync-script',
        label: 'Has android:sync script',
        action: 'Add an android:sync script that builds web assets and runs cap sync android.',
        test: context => hasScript(context.packageJson, 'android:sync'),
      },
      {
        id: 'android-open-script',
        label: 'Has android:open script',
        action: 'Add an android:open script that opens the native Android project.',
        test: context => hasScript(context.packageJson, 'android:open'),
      },
      {
        id: 'capacitor-config',
        label: 'Has capacitor.config.json',
        action: 'Initialize Capacitor with appId com.deutschboost.app and webDir dist.',
        test: context => context.files.has('capacitor.config.json'),
      },
      {
        id: 'android-project',
        label: 'Has Android native project',
        action: 'Run npx cap add android after Capacitor is installed.',
        test: context => context.files.has('android'),
      },
      {
        id: 'java-command',
        label: 'Java JDK is available',
        action: 'Install Java JDK 17+ and make java available on PATH.',
        test: context => context.commands.has('java'),
      },
      {
        id: 'android-sdk-env',
        label: 'Android SDK path is configured',
        action: 'Install Android Studio and set ANDROID_HOME or ANDROID_SDK_ROOT.',
        test: context => Boolean(context.env.ANDROID_HOME || context.env.ANDROID_SDK_ROOT),
      },
    ],
  },
};

export function evaluateNativeReadiness(input) {
  const context = normalizeContext(input);
  const targets = Object.fromEntries(
    Object.entries(TARGETS).map(([target, definition]) => {
      const checks = definition.checks.map(check => ({
        id: check.id,
        label: check.label,
        ok: check.test(context),
        action: check.action,
      }));

      return [
        target,
        {
          target,
          label: definition.label,
          ready: checks.every(check => check.ok),
          checks,
        },
      ];
    })
  );

  return { targets };
}

export function formatNativeReadinessReport(result) {
  return Object.values(result.targets)
    .map(target => {
      const lines = [
        `${target.ready ? 'READY' : 'BLOCKED'} ${target.label}`,
        ...target.checks.map(check => {
          const status = check.ok ? 'OK' : 'MISSING';
          return `  [${status}] ${check.label}${check.ok ? '' : ` - ${check.action}`}`;
        }),
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

export function readPackageJson(cwd = process.cwd()) {
  return JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'));
}

export function collectKnownFiles(cwd = process.cwd()) {
  return new Set([
    ...existingPaths(cwd, [
      'src-tauri/tauri.conf.json',
      'src-tauri/Cargo.toml',
      'capacitor.config.json',
      'android',
    ]),
  ]);
}

export function collectAvailableCommands(commandNames) {
  return new Set(commandNames.filter(commandAvailable));
}

export function runNativeReadinessCli(cwd = process.cwd(), env = process.env) {
  const result = evaluateNativeReadiness({
    packageJson: readPackageJson(cwd),
    files: collectKnownFiles(cwd),
    commands: collectAvailableCommands(['node', 'npm', 'rustc', 'cargo', 'java']),
    env,
  });

  console.log(formatNativeReadinessReport(result));
  return Object.values(result.targets).every(target => target.ready) ? 0 : 1;
}

function normalizeContext(input) {
  return {
    packageJson: input.packageJson ?? {},
    files: input.files ?? new Set(),
    commands: input.commands ?? new Set(),
    env: input.env ?? {},
  };
}

function hasScript(packageJson, name) {
  return typeof packageJson.scripts?.[name] === 'string' && packageJson.scripts[name].length > 0;
}

function hasPackage(packageJson, name) {
  return Boolean(packageJson.dependencies?.[name] || packageJson.devDependencies?.[name]);
}

function existingPaths(cwd, candidates) {
  return candidates.filter(candidate => existsSync(path.join(cwd, candidate)));
}

function commandAvailable(command) {
  const result = process.platform === 'win32'
    ? spawnSync(`${command} --version`, {
        encoding: 'utf8',
        shell: true,
        stdio: 'ignore',
      })
    : spawnSync(command, ['--version'], {
        encoding: 'utf8',
        stdio: 'ignore',
      });
  return result.status === 0;
}
