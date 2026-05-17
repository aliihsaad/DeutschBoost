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
import {
  createKeyValueProviderSecretStorage,
  type ProviderSecretStorage,
} from '../../../src/domain/settings/providerSecretStorage';
import { createMemoryKeyValueStorage } from '../../../src/domain/storage/keyValueStorage';

function createMemoryStorage(
  initial: Record<string, string> = {}
): ProviderSettingsStorage & { read(key: string): string | null } {
  const values = new Map(Object.entries(initial));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    read(key: string): string | null {
      return values.get(key) ?? null;
    },
  };
}

function createSecretStorage(): ProviderSecretStorage {
  return createKeyValueProviderSecretStorage({
    storage: createMemoryKeyValueStorage(),
  });
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
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
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

  it('stores provider API keys outside public settings JSON when secret storage is supplied', async () => {
    const storage = createMemoryStorage();
    const secretStorage = createSecretStorage();
    const repository = createStorageProviderSettingsRepository({ storage, secretStorage });
    const settings: LocalProviderSettings = {
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    };

    await repository.save(settings);

    const storedPublicSettings = JSON.parse(storage.read(DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY)!);
    expect(storedPublicSettings.ai.apiKey).toBeUndefined();
    expect(storedPublicSettings.speech.apiKey).toBeUndefined();
    expect(storedPublicSettings.live.apiKey).toBeUndefined();
    await expect(secretStorage.getSecret('ai.apiKey')).resolves.toBe('openrouter-key');
    await expect(secretStorage.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');
    await expect(secretStorage.getSecret('live.apiKey')).resolves.toBe('gemini-key');
    await expect(repository.load()).resolves.toEqual(settings);
  });

  it('migrates legacy inline API keys into secret storage', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: {
          enabled: true,
          provider: 'openrouter',
          apiKey: 'legacy-openrouter-key',
          model: 'openrouter/auto',
        },
        speech: {
          enabled: true,
          provider: 'deepgram',
          apiKey: 'legacy-deepgram-key',
          model: 'nova-3',
          language: 'de',
        },
        live: {
          enabled: true,
          provider: 'gemini-live',
          apiKey: 'legacy-gemini-key',
          model: 'gemini-2.5-flash-live-preview',
          voiceName: 'Kore',
        },
      }),
    });
    const secretStorage = createSecretStorage();
    const repository = createStorageProviderSettingsRepository({ storage, secretStorage });

    await expect(repository.load()).resolves.toMatchObject({
      ai: { apiKey: 'legacy-openrouter-key' },
      speech: { apiKey: 'legacy-deepgram-key' },
      live: { apiKey: 'legacy-gemini-key' },
    });

    const storedPublicSettings = JSON.parse(storage.read(DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY)!);
    expect(storedPublicSettings.ai.apiKey).toBeUndefined();
    expect(storedPublicSettings.speech.apiKey).toBeUndefined();
    expect(storedPublicSettings.live.apiKey).toBeUndefined();
    await expect(secretStorage.getSecret('ai.apiKey')).resolves.toBe('legacy-openrouter-key');
    await expect(secretStorage.getSecret('speech.apiKey')).resolves.toBe('legacy-deepgram-key');
    await expect(secretStorage.getSecret('live.apiKey')).resolves.toBe('legacy-gemini-key');
  });

  it('merges older partial settings with current defaults', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: {
          enabled: true,
          provider: 'openrouter',
          apiKey: 'openrouter-key',
          baseUrl: 'https://user-openrouter.example',
          siteUrl: 'https://user-site.example',
        },
        speech: {
          baseUrl: 'https://user-deepgram.example',
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: false,
        provider: 'gemini-live',
        model: 'gemini-3.1-flash-live-preview',
        voiceName: 'Kore',
      },
    });
  });

  it('migrates old invalid Gemini Live model values to a supported live model', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: {
          enabled: false,
          provider: 'openrouter',
          model: 'openrouter/auto',
        },
        speech: {
          enabled: false,
          provider: 'deepgram',
          model: 'nova-3',
          ttsModel: 'aura-2-viktoria-de',
          language: 'de',
        },
        live: {
          enabled: true,
          provider: 'gemini-live',
          apiKey: 'gemini-key',
          model: 'gemini-2.5-flash-live-preview',
          voiceName: 'Kore',
        },
      }),
    });
    const repository = createStorageProviderSettingsRepository({ storage });

    await expect(repository.load()).resolves.toMatchObject({
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-3.1-flash-live-preview',
        voiceName: 'Kore',
      },
    });
  });

  it('migrates older Deepgram settings without a TTS model', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
        ai: {
          enabled: false,
          provider: 'openrouter',
          model: 'openrouter/auto',
        },
        speech: {
          enabled: true,
          provider: 'deepgram',
          apiKey: 'deepgram-key',
          model: 'nova-3',
          language: 'de',
        },
      }),
    });
    const repository = createStorageProviderSettingsRepository({ storage });

    const loaded = await repository.load();

    expect(loaded.speech.ttsModel).toBe('aura-2-viktoria-de');
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

  it('updates settings without dropping existing provider secrets from secret storage', async () => {
    const storage = createMemoryStorage();
    const secretStorage = createSecretStorage();
    const repository = createStorageProviderSettingsRepository({ storage, secretStorage });
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Puck',
      },
    });

    const updated = await repository.update((settings) => ({
      ...settings,
      ai: {
        ...settings.ai,
        enabled: false,
      },
    }));

    expect(updated.ai.apiKey).toBe('openrouter-key');
    expect(updated.speech.apiKey).toBe('deepgram-key');
    expect(updated.live?.apiKey).toBe('gemini-key');
    await expect(secretStorage.getSecret('ai.apiKey')).resolves.toBe('openrouter-key');
    await expect(secretStorage.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');
    await expect(secretStorage.getSecret('live.apiKey')).resolves.toBe('gemini-key');
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    });

    await expect(repository.reset()).resolves.toEqual(createDefaultLocalProviderSettings());
    await expect(repository.load()).resolves.toEqual(createDefaultLocalProviderSettings());
    expect(storage.removeItem).toHaveBeenCalledWith(DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY);
  });

  it('resets stored provider secrets when secret storage is supplied', async () => {
    const storage = createMemoryStorage();
    const secretStorage = createSecretStorage();
    const repository = createStorageProviderSettingsRepository({ storage, secretStorage });
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    });

    await repository.reset();

    await expect(secretStorage.getSecret('ai.apiKey')).resolves.toBeNull();
    await expect(secretStorage.getSecret('speech.apiKey')).resolves.toBeNull();
    await expect(secretStorage.getSecret('live.apiKey')).resolves.toBeNull();
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
