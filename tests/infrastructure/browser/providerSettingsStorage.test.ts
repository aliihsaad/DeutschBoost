import { describe, expect, it, vi } from 'vitest';
import { createMemoryKeyValueStorage } from '../../../src/domain/storage/keyValueStorage';
import type { ProviderSecretStorage } from '../../../src/domain/settings/providerSecretStorage';
import {
  createBrowserProviderSettingsStorage,
  createDefaultProviderSettingsRepository,
} from '../../../src/infrastructure/browser/providerSettingsStorage';

describe('providerSettingsStorage', () => {
  it('adapts browser localStorage to provider settings storage', async () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => (key === 'settings' ? 'stored-value' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserProviderSettingsStorage(localStorageLike);

    await expect(storage.getItem('settings')).resolves.toBe('stored-value');

    await storage.setItem('settings', 'new-value');
    await storage.removeItem('settings');

    expect(localStorageLike.setItem).toHaveBeenCalledWith('settings', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('settings');
    expect(storage.runtime).toBe('browser');
    expect(storage.durability).toBe('browser-managed');
  });

  it('falls back to memory storage when browser storage is unavailable', async () => {
    const storage = createBrowserProviderSettingsStorage(null);

    await storage.setItem('settings', 'stored-value');
    await expect(storage.getItem('settings')).resolves.toBe('stored-value');

    await storage.removeItem('settings');
    await expect(storage.getItem('settings')).resolves.toBeNull();
    expect(storage.runtime).toBe('memory');
    expect(storage.durability).toBe('ephemeral');
  });

  it('uses native provider secret storage when the installed platform supplies it', async () => {
    const storage = createMemoryKeyValueStorage();
    const secretValues = new Map<string, string>();
    const nativeSecretStorage: ProviderSecretStorage = {
      protection: 'stronghold',
      getSecret: vi.fn(async (name) => secretValues.get(name) ?? null),
      setSecret: vi.fn(async (name, value) => {
        secretValues.set(name, value);
      }),
      removeSecret: vi.fn(async (name) => {
        secretValues.delete(name);
      }),
    };
    const repository = createDefaultProviderSettingsRepository({
      storage,
      nativeSecretStorageResolver: () => nativeSecretStorage,
    });

    await repository.save({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
      },
    });

    await expect(nativeSecretStorage.getSecret('ai.apiKey')).resolves.toBe('openrouter-key');
    await expect(nativeSecretStorage.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');
    const publicSettings = await storage.getItem('deutschboost.providerSettings.v1');
    expect(publicSettings).not.toContain('openrouter-key');
    expect(publicSettings).not.toContain('deepgram-key');
  });
});
