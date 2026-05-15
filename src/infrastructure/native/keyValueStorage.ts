import type { KeyValueStorage, MaybePromise } from '../../domain/storage/keyValueStorage';

export interface TauriStoreLike {
  get(key: string): MaybePromise<unknown>;
  set(key: string, value: string): MaybePromise<void>;
  delete(key: string): MaybePromise<void>;
  save?(): MaybePromise<void>;
}

export type TauriStoreLoader = (
  path: string,
  options: { autoSave: false }
) => MaybePromise<TauriStoreLike>;

export interface TauriStoreStorageOptions {
  storePath?: string;
  saveOnWrite?: boolean;
}

export interface CapacitorPreferencesLike {
  get(input: { key: string }): MaybePromise<{ value: string | null }>;
  set(input: { key: string; value: string }): MaybePromise<void>;
  remove(input: { key: string }): MaybePromise<void>;
}

export interface NativeStorageGlobal {
  __TAURI__?: {
    store?: {
      load?: TauriStoreLoader;
    };
  };
  Capacitor?: {
    Plugins?: {
      Preferences?: CapacitorPreferencesLike;
    };
  };
}

const DEFAULT_TAURI_STORE_PATH = 'deutschboost.json';

export function createTauriStoreKeyValueStorage(
  loadStore: TauriStoreLoader,
  options: TauriStoreStorageOptions = {}
): KeyValueStorage {
  const storePath = options.storePath ?? DEFAULT_TAURI_STORE_PATH;
  const saveOnWrite = options.saveOnWrite ?? true;
  let storePromise: Promise<TauriStoreLike> | null = null;

  const getStore = (): Promise<TauriStoreLike> => {
    storePromise ??= Promise.resolve(loadStore(storePath, { autoSave: false }));
    return storePromise;
  };

  const saveStore = async (store: TauriStoreLike): Promise<void> => {
    if (saveOnWrite) {
      await store.save?.();
    }
  };

  return {
    runtime: 'native',
    durability: 'device',
    async getItem(key: string): Promise<string | null> {
      const value = await (await getStore()).get(key);
      return typeof value === 'string' ? value : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      const store = await getStore();
      await store.set(key, value);
      await saveStore(store);
    },
    async removeItem(key: string): Promise<void> {
      const store = await getStore();
      await store.delete(key);
      await saveStore(store);
    },
  };
}

export function createCapacitorPreferencesKeyValueStorage(
  preferences: CapacitorPreferencesLike
): KeyValueStorage {
  return {
    runtime: 'native',
    durability: 'device',
    async getItem(key: string): Promise<string | null> {
      const result = await preferences.get({ key });
      return result.value ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      await preferences.set({ key, value });
    },
    async removeItem(key: string): Promise<void> {
      await preferences.remove({ key });
    },
  };
}

export function createInstalledNativeKeyValueStorage(
  globalScope: NativeStorageGlobal = globalThis as NativeStorageGlobal
): KeyValueStorage | null {
  const tauriStoreLoader = globalScope.__TAURI__?.store?.load;
  if (tauriStoreLoader) {
    return createTauriStoreKeyValueStorage(tauriStoreLoader);
  }

  const preferences = globalScope.Capacitor?.Plugins?.Preferences;
  if (preferences) {
    return createCapacitorPreferencesKeyValueStorage(preferences);
  }

  return null;
}
