import { describe, expect, it } from 'vitest';
import {
  evaluateNativeReadiness,
  formatNativeReadinessReport,
} from '../../scripts/native-readiness.mjs';

const basePackageJson = {
  scripts: {
    build: 'vite build',
    dev: 'vite',
  },
  dependencies: {
    'vite-plugin-pwa': '^1.1.0',
  },
  devDependencies: {},
};

describe('native release readiness', () => {
  it('marks the PWA target ready when the web build and PWA plugin exist', () => {
    const result = evaluateNativeReadiness({
      packageJson: basePackageJson,
      files: new Set(),
      commands: new Set(['node', 'npm']),
      env: {},
    });

    expect(result.targets.pwa.ready).toBe(true);
    expect(result.targets.pwa.checks.every(check => check.ok)).toBe(true);
  });

  it('reports desktop and Android blockers before native packages and toolchains exist', () => {
    const result = evaluateNativeReadiness({
      packageJson: basePackageJson,
      files: new Set(),
      commands: new Set(['node', 'npm']),
      env: {},
    });

    expect(result.targets.desktop.ready).toBe(false);
    expect(getMissingCheckIds(result, 'desktop')).toEqual(
      expect.arrayContaining([
        'tauri-cli-package',
        'tauri-api-package',
        'tauri-config',
        'rustc-command',
        'cargo-command',
      ])
    );
    expect(result.targets.android.ready).toBe(false);
    expect(getMissingCheckIds(result, 'android')).toEqual(
      expect.arrayContaining([
        'capacitor-cli-package',
        'capacitor-core-package',
        'capacitor-android-package',
        'capacitor-config',
        'android-project',
        'java-command',
        'android-sdk-env',
      ])
    );
  });

  it('marks desktop and Android ready when required packages, files, and commands exist', () => {
    const result = evaluateNativeReadiness({
      packageJson: {
        scripts: {
          build: 'vite build',
          dev: 'vite',
          'tauri:dev': 'tauri dev',
          'tauri:build': 'tauri build',
          'android:sync': 'cap sync android',
          'android:open': 'cap open android',
        },
        dependencies: {
          '@capacitor/android': '^8.0.0',
          '@capacitor/core': '^8.0.0',
          '@capacitor/preferences': '^8.0.0',
          '@tauri-apps/api': '^2.11.0',
          '@tauri-apps/plugin-store': '^2.4.0',
          '@tauri-apps/plugin-stronghold': '^2.4.0',
          'vite-plugin-pwa': '^1.1.0',
        },
        devDependencies: {
          '@capacitor/cli': '^8.0.0',
          '@tauri-apps/cli': '^2.11.0',
        },
      },
      files: new Set([
        'src-tauri/tauri.conf.json',
        'src-tauri/Cargo.toml',
        'capacitor.config.json',
        'android',
      ]),
      commands: new Set(['node', 'npm', 'rustc', 'cargo', 'java']),
      env: {
        ANDROID_HOME: 'C:/Android/sdk',
      },
    });

    expect(result.targets.desktop.ready).toBe(true);
    expect(result.targets.android.ready).toBe(true);
  });

  it('formats a readable report with next actions', () => {
    const result = evaluateNativeReadiness({
      packageJson: basePackageJson,
      files: new Set(),
      commands: new Set(['node', 'npm']),
      env: {},
    });

    const report = formatNativeReadinessReport(result);

    expect(report).toContain('Desktop installable release');
    expect(report).toContain('Android APK release');
    expect(report).toContain('Install @tauri-apps/cli');
    expect(report).toContain('Install Java JDK');
  });
});

function getMissingCheckIds(
  result: ReturnType<typeof evaluateNativeReadiness>,
  target: 'desktop' | 'android'
): string[] {
  return result.targets[target].checks
    .filter(check => !check.ok)
    .map(check => check.id);
}
