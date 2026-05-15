import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_CLIENT,
  DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_FILE,
  createInstalledNativeProviderSecretStorage,
  createTauriStrongholdProviderSecretStorage,
  type TauriStrongholdApiLike,
  type TauriPathApiLike,
} from '../../../src/infrastructure/native/providerSecretStorage';

function createFakeStrongholdDependencies(options: { loadClientSucceeds?: boolean } = {}) {
  const values = new Map<string, number[]>();
  const store = {
    get: vi.fn(async (key: string) => {
      const value = values.get(key);
      return value ? new Uint8Array(value) : null;
    }),
    insert: vi.fn(async (key: string, value: number[]) => {
      values.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      const value = values.get(key);
      values.delete(key);
      return value ? new Uint8Array(value) : null;
    }),
  };
  const client = {
    getStore: vi.fn(() => store),
  };
  const stronghold = {
    loadClient: vi.fn(async () => {
      if (!options.loadClientSucceeds) {
        throw new Error('client missing');
      }
      return client;
    }),
    createClient: vi.fn(async () => client),
    save: vi.fn(async () => undefined),
  };
  const strongholdApi: TauriStrongholdApiLike = {
    Stronghold: {
      load: vi.fn(async () => stronghold),
    },
  };
  const pathApi: TauriPathApiLike = {
    appDataDir: vi.fn(async () => 'C:/Users/Mini/AppData/Roaming/com.deutschboost.app'),
    join: vi.fn(async (...parts: string[]) => parts.join('/')),
  };

  return { client, pathApi, store, stronghold, strongholdApi };
}

describe('Tauri Stronghold provider secret storage', () => {
  it('saves, loads, removes, and persists provider secrets through Stronghold store records', async () => {
    const { pathApi, store, stronghold, strongholdApi } = createFakeStrongholdDependencies();
    const secrets = createTauriStrongholdProviderSecretStorage({
      strongholdApi,
      pathApi,
      vaultPassword: 'test-vault-password',
    });

    expect(secrets.protection).toBe('stronghold');

    await secrets.setSecret('ai.apiKey', 'openrouter-key');
    await secrets.setSecret('speech.apiKey', 'deepgram-key');

    await expect(secrets.getSecret('ai.apiKey')).resolves.toBe('openrouter-key');
    await expect(secrets.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');

    await secrets.removeSecret('ai.apiKey');

    await expect(secrets.getSecret('ai.apiKey')).resolves.toBeNull();
    await expect(secrets.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');
    expect(pathApi.join).toHaveBeenCalledWith(
      'C:/Users/Mini/AppData/Roaming/com.deutschboost.app',
      DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_FILE
    );
    expect(strongholdApi.Stronghold.load).toHaveBeenCalledWith(
      `C:/Users/Mini/AppData/Roaming/com.deutschboost.app/${DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_FILE}`,
      'test-vault-password'
    );
    expect(stronghold.createClient).toHaveBeenCalledWith(
      DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_CLIENT
    );
    expect(store.insert).toHaveBeenCalledWith(
      'deutschboost.providerSecrets.v1.ai.apiKey',
      Array.from(new TextEncoder().encode('openrouter-key'))
    );
    expect(store.remove).toHaveBeenCalledWith('deutschboost.providerSecrets.v1.ai.apiKey');
    expect(stronghold.save).toHaveBeenCalledTimes(3);
  });

  it('loads an existing Stronghold client before creating a new one', async () => {
    const { stronghold, strongholdApi, pathApi } = createFakeStrongholdDependencies({
      loadClientSucceeds: true,
    });
    const secrets = createTauriStrongholdProviderSecretStorage({
      strongholdApi,
      pathApi,
    });

    await secrets.setSecret('ai.apiKey', 'openrouter-key');

    expect(stronghold.loadClient).toHaveBeenCalledWith(
      DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_CLIENT
    );
    expect(stronghold.createClient).not.toHaveBeenCalled();
  });

  it('detects the installed Tauri runtime before returning a native secret store', () => {
    expect(createInstalledNativeProviderSecretStorage({ isTauri: false })).toBeNull();
    expect(createInstalledNativeProviderSecretStorage({ isTauri: true })?.protection).toBe(
      'stronghold'
    );
  });
});
