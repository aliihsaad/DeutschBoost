import {
  createMemoryKeyValueStorage,
  type KeyValueStorage,
} from '../../domain/storage/keyValueStorage';
import { createInstalledNativeKeyValueStorage } from '../native/keyValueStorage';

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PlatformKeyValueStorageOptions {
  nativeStorage?: KeyValueStorage | null;
  browserStorage?: BrowserStorageLike | null;
}

interface DefaultPlatformKeyValueStorageOptions {
  nativeStorageResolver?: () => KeyValueStorage | null;
  browserStorage?: BrowserStorageLike | null;
}

export function createPlatformKeyValueStorage(
  options: PlatformKeyValueStorageOptions = {}
): KeyValueStorage {
  if (options.nativeStorage) {
    return options.nativeStorage;
  }

  return createBrowserKeyValueStorage(options.browserStorage);
}

export function createDefaultPlatformKeyValueStorage(
  options: DefaultPlatformKeyValueStorageOptions = {}
): KeyValueStorage {
  const resolveNativeStorage = options.nativeStorageResolver ?? createInstalledNativeKeyValueStorage;

  return createPlatformKeyValueStorage({
    nativeStorage: resolveNativeStorage(),
    browserStorage: options.browserStorage,
  });
}

export function createBrowserKeyValueStorage(
  storage: BrowserStorageLike | null | undefined = resolveBrowserLocalStorage()
): KeyValueStorage {
  if (!storage) {
    return createMemoryKeyValueStorage();
  }

  return {
    runtime: 'browser',
    durability: 'browser-managed',
    async getItem(key: string): Promise<string | null> {
      return storage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      storage.setItem(key, value);
    },
    async removeItem(key: string): Promise<void> {
      storage.removeItem(key);
    },
  };
}

export function resolveBrowserLocalStorage(): BrowserStorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
