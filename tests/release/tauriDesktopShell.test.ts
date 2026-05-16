import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;
}

function readText(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Tauri desktop shell configuration', () => {
  it('exposes desktop commands and required frontend packages', () => {
    const packageJson = readJson<{
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>('package.json');

    expect(packageJson.scripts?.tauri).toBe('tauri');
    expect(packageJson.scripts?.['tauri:dev']).toBe('tauri dev');
    expect(packageJson.scripts?.['tauri:build']).toBe('tauri build');
    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/api');
    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/plugin-store');
    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/plugin-stronghold');
    expect(packageJson.devDependencies).toHaveProperty('@tauri-apps/cli');
  });

  it('uses the Vite-compatible Tauri build configuration', () => {
    const config = readJson<{
      productName?: string;
      identifier?: string;
      build?: Record<string, string>;
    }>('src-tauri/tauri.conf.json');

    expect(config.productName).toBe('DeutschBoost');
    expect(config.identifier).toBe('com.deutschboost.app');
    expect(config.build).toMatchObject({
      beforeDevCommand: 'npm run dev',
      beforeBuildCommand: 'npm run build',
      devUrl: 'http://localhost:5173',
      frontendDist: '../dist',
    });
  });

  it('grants only the native plugin permissions the current app shell needs', () => {
    const capability = readJson<{ permissions?: string[] }>(
      'src-tauri/capabilities/default.json'
    );

    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        'core:default',
        'store:default',
        'stronghold:default',
        'stronghold:allow-remove-store-record',
      ])
    );
  });

  it('initializes the Rust plugins used by the native storage adapters', () => {
    expect(existsSync(path.join(root, 'src-tauri/Cargo.toml'))).toBe(true);
    expect(existsSync(path.join(root, 'src-tauri/src/main.rs'))).toBe(true);
    expect(existsSync(path.join(root, 'src-tauri/src/lib.rs'))).toBe(true);

    const cargo = readText('src-tauri/Cargo.toml');
    expect(cargo).toContain('tauri-plugin-store');
    expect(cargo).toContain('tauri-plugin-stronghold');
    expect(cargo).toContain('[profile.dev.package.scrypt]');

    const lib = readText('src-tauri/src/lib.rs');
    expect(lib).toContain('tauri_plugin_store::Builder');
    expect(lib).toContain('tauri_plugin_stronghold::Builder::with_argon2');
    expect(lib).toContain('deepgram_auth_token');
    expect(lib).toContain('deepgram_transcribe');
  });

  it('keeps the Vite dev server stable for the Tauri shell', () => {
    const viteConfig = readText('vite.config.ts');

    expect(viteConfig).toContain('clearScreen: false');
    expect(viteConfig).toContain('strictPort: true');
    expect(viteConfig).toContain('TAURI_DEV_HOST');
    expect(viteConfig).toContain("'**/src-tauri/**'");
  });

  it('does not keep the PWA service worker active inside Tauri desktop builds', () => {
    const viteConfig = readText('vite.config.ts');
    const indexHtml = readText('index.html');
    const cleanupScript = readText('public/desktop-sw-cleanup.js');

    expect(viteConfig).toContain('isTauriBuild ? tauriDesktopServiceWorkerCleanupPlugin() : VitePWA');
    expect(viteConfig).toContain("fileName: 'sw.js'");
    expect(indexHtml).toContain('/desktop-sw-cleanup.js');
    expect(cleanupScript).toContain("location.hostname === 'tauri.localhost'");
    expect(cleanupScript).toContain('getRegistrations()');
  });

  it('allows packaged desktop font styles without opening script execution', () => {
    const config = readJson<{
      app?: {
        security?: {
          csp?: string;
        };
      };
    }>('src-tauri/tauri.conf.json');
    const csp = config.app?.security?.csp ?? '';

    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(csp).toContain('https://cdnjs.cloudflare.com');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('allows packaged desktop IPC used by Tauri plugin storage commands', () => {
    const config = readJson<{
      app?: {
        security?: {
          csp?: string;
        };
      };
    }>('src-tauri/tauri.conf.json');
    const csp = config.app?.security?.csp ?? '';
    const connectSrc = csp
      .split(';')
      .map(directive => directive.trim())
      .find(directive => directive.startsWith('connect-src'));

    expect(connectSrc).toContain('http://ipc.localhost');
  });
});
