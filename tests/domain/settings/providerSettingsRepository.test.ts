import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultLocalProviderSettings,
  type LocalProviderSettings,
} from '../../../src/domain/settings/providerSettings';
import {
  DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY,
  createStorageProviderSettingsRepository,
  type ProviderSettingsStorage,
} from '../../../src/domain/settings/providerSettingsRepository';

function createMemoryStorage(initial: Record<string, string> = {}): ProviderSettingsStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('providerSettingsRepository', () => {
  it('loads default local provider settings when storage is empty', async () => {
    const storage = createMemoryStorage();
    const repository = createStorageProviderSettingsRepository({ storage });

    await expect(repository.load()).resolves.toEqual(createDefaultLocalProviderSettings());
    expect(storage.getItem).toHaveBeenCalledWith(DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY);
  });

  it('saves and reloads local provider settings', async () => {
    const storage = createMemoryStorage();
    const repository = createStorageProviderSettingsRepository({ storage });
    const settings: LocalProviderSettings = {
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openai/gpt-4o-mini',
        appTitle: 'DeutschBoost',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
      },
    };

    await repository.save(settings);
    await expect(repository.load()).resolves.toEqual(settings);

    expect(storage.setItem).toHaveBeenCalledWith(
      DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY,
      expect.any(String)
    );
    const [, savedSettings] = vi.mocked(storage.setItem).mock.calls[0]!;
    expect(JSON.parse(savedSettings)).toEqual(settings);
  });

  it('merges older partial settings with current defaults', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: {
          enabled: true,
          provider: 'openrouter',
          apiKey: 'openrouter-key',
        },
      }),
    });
    const repository = createStorageProviderSettingsRepository({ storage });

    await expect(repository.load()).resolves.toEqual({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: false,
        provider: 'deepgram',
        model: 'nova-3',
        language: 'de',
      },
    });
  });

  it('ignores invalid stored setting shapes', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: 'not-settings',
        speech: {
          enabled: 'yes',
          model: '',
        },
      }),
    });
    const repository = createStorageProviderSettingsRepository({ storage });

    await expect(repository.load()).resolves.toEqual(createDefaultLocalProviderSettings());
  });

  it('updates settings from the latest stored value', async () => {
    const storage = createMemoryStorage();
    const repository = createStorageProviderSettingsRepository({ storage });

    const updated = await repository.update((settings) => ({
      ...settings,
      ai: {
        ...settings.ai,
        enabled: true,
        apiKey: 'openrouter-key',
      },
    }));

    expect(updated.ai.enabled).toBe(true);
    expect(updated.ai.apiKey).toBe('openrouter-key');
    await expect(repository.load()).resolves.toMatchObject({
      ai: {
        enabled: true,
        apiKey: 'openrouter-key',
      },
    });
  });

  it('supports async storage adapters for native local persistence', async () => {
    const values = new Map<string, string>();
    const storage: ProviderSettingsStorage = {
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    };
    const repository = createStorageProviderSettingsRepository({ storage });

    const updated = await repository.update((settings) => ({
      ...settings,
      speech: {
        ...settings.speech,
        enabled: true,
        apiKey: 'deepgram-key',
      },
    }));

    expect(updated.speech.enabled).toBe(true);
    await expect(repository.load()).resolves.toMatchObject({
      speech: {
        enabled: true,
        apiKey: 'deepgram-key',
      },
    });
  });

  it('resets stored settings back to defaults', async () => {
    const storage = createMemoryStorage();
    const repository = createStorageProviderSettingsRepository({ storage });
    await repository.save({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openai/gpt-4o-mini',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
      },
    });

    await expect(repository.reset()).resolves.toEqual(createDefaultLocalProviderSettings());
    await expect(repository.load()).resolves.toEqual(createDefaultLocalProviderSettings());
    expect(storage.removeItem).toHaveBeenCalledWith(DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY);
  });

  it('recovers defaults and clears storage when saved JSON is corrupt', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: '{not json',
    });
    const repository = createStorageProviderSettingsRepository({ storage });

    await expect(repository.load()).resolves.toEqual(createDefaultLocalProviderSettings());
    expect(storage.removeItem).toHaveBeenCalledWith(DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY);
  });
});
