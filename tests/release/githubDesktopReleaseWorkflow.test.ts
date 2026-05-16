import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const releaseWorkflowPath = path.join(root, '.github', 'workflows', 'desktop-release.yml');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;
}

describe('GitHub desktop release workflow', () => {
  it('keeps npm and Tauri desktop versions aligned for the current release', () => {
    const packageJson = readJson<{ version?: string }>('package.json');
    const tauriConfig = readJson<{ version?: string }>('src-tauri/tauri.conf.json');
    const cargoToml = readFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');

    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(cargoToml).toContain(`version = "${packageJson.version}"`);
  });

  it('builds a tagged Windows desktop release with Tauri artifacts', () => {
    expect(existsSync(releaseWorkflowPath)).toBe(true);

    const workflow = readFileSync(releaseWorkflowPath, 'utf8');

    expect(workflow).toContain("tags:");
    expect(workflow).toContain("'v*.*.*'");
    expect(workflow).toContain('runs-on: windows-latest');
    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run test:run');
    expect(workflow).toContain('tauri-apps/tauri-action@v0');
    expect(workflow).toContain('releaseDraft: false');
    expect(workflow).toContain('prerelease: true');
    expect(workflow).toContain('includeUpdaterJson: false');
    expect(workflow).toContain('assetNamePattern: DeutschBoost_[version]_[platform]_[arch][setup][ext]');
    expect(workflow).not.toContain('uploadUpdaterJson:');
    expect(workflow).not.toContain('releaseAssetNamePattern:');
  });
});
