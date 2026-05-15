import {
  createStorageProviderSettingsRepository,
  type ProviderSettingsStorage,
} from '../../domain/settings/providerSettingsRepository';

interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createBrowserProviderSettingsStorage(
  storage: BrowserStorageLike | null | undefined = resolveBrowserLocalStorage()
): ProviderSettingsStorage {
  if (!storage) {
    return createMemoryProviderSettingsStorage();
  }

  return {
    getItem(key: string): string | null {
      return storage.getItem(key);
    },
    setItem(key: string, value: string): void {
      storage.setItem(key, value);
    },
    removeItem(key: string): void {
      storage.removeItem(key);
    },
  };
}

export const browserProviderSettingsRepository = createStorageProviderSettingsRepository({
  storage: createBrowserProviderSettingsStorage(),
});

function resolveBrowserLocalStorage(): BrowserStorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function createMemoryProviderSettingsStorage(): ProviderSettingsStorage {
  const values = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
    removeItem(key: string): void {
      values.delete(key);
    },
  };
}
