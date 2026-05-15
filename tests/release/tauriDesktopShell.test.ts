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
      expect.arrayContaining(['core:default', 'store:default', 'stronghold:default'])
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
  });

  it('keeps the Vite dev server stable for the Tauri shell', () => {
    const viteConfig = readText('vite.config.ts');

    expect(viteConfig).toContain('clearScreen: false');
    expect(viteConfig).toContain('strictPort: true');
    expect(viteConfig).toContain('TAURI_DEV_HOST');
    expect(viteConfig).toContain("'**/src-tauri/**'");
  });
});
