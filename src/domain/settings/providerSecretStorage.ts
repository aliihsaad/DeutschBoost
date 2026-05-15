import type { KeyValueStorage } from '../storage/keyValueStorage';

export const DEFAULT_PROVIDER_SECRETS_STORAGE_KEY = 'deutschboost.providerSecrets.v1';

export type ProviderSecretName = 'ai.apiKey' | 'speech.apiKey';
export type ProviderSecretStorageProtection =
  | 'system-secret-store'
  | 'native-app-storage'
  | 'browser-storage'
  | 'memory';

export interface ProviderSecretStorage {
  protection: ProviderSecretStorageProtection;
  getSecret(name: ProviderSecretName): Promise<string | null>;
  setSecret(name: ProviderSecretName, value: string): Promise<void>;
  removeSecret(name: ProviderSecretName): Promise<void>;
}

interface KeyValueProviderSecretStorageOptions {
  storage: KeyValueStorage;
  key?: string;
  protection?: ProviderSecretStorageProtection;
}

type ProviderSecretStore = Partial<Record<ProviderSecretName, string>>;

export function createKeyValueProviderSecretStorage(
  options: KeyValueProviderSecretStorageOptions
): ProviderSecretStorage {
  const key = options.key ?? DEFAULT_PROVIDER_SECRETS_STORAGE_KEY;
  const protection = options.protection ?? inferProtection(options.storage);

  return {
    protection,
    async getSecret(name: ProviderSecretName): Promise<string | null> {
      const store = await loadSecretStore(options.storage, key);
      return store[name] ?? null;
    },
    async setSecret(name: ProviderSecretName, value: string): Promise<void> {
      const store = await loadSecretStore(options.storage, key);
      store[name] = value;
      await saveSecretStore(options.storage, key, store);
    },
    async removeSecret(name: ProviderSecretName): Promise<void> {
      const store = await loadSecretStore(options.storage, key);
      delete store[name];
      await saveSecretStore(options.storage, key, store);
    },
  };
}

async function loadSecretStore(
  storage: KeyValueStorage,
  key: string
): Promise<ProviderSecretStore> {
  const raw = await storage.getItem(key);

  if (!raw) {
    return {};
  }

  try {
    return normalizeSecretStore(JSON.parse(raw));
  } catch {
    await storage.removeItem(key);
    return {};
  }
}

async function saveSecretStore(
  storage: KeyValueStorage,
  key: string,
  store: ProviderSecretStore
): Promise<void> {
  await storage.setItem(key, JSON.stringify(store));
}

function normalizeSecretStore(value: unknown): ProviderSecretStore {
  const root = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    ...normalizeSecret(root, 'ai.apiKey'),
    ...normalizeSecret(root, 'speech.apiKey'),
  };
}

function normalizeSecret(
  root: Record<string, unknown>,
  name: ProviderSecretName
): ProviderSecretStore {
  const value = root[name];
  return typeof value === 'string' && value.trim().length > 0 ? { [name]: value } : {};
}

function inferProtection(storage: KeyValueStorage): ProviderSecretStorageProtection {
  if (storage.runtime === 'native') {
    return 'native-app-storage';
  }

  if (storage.runtime === 'browser') {
    return 'browser-storage';
  }

  return 'memory';
}
