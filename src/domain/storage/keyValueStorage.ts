export type MaybePromise<T> = T | Promise<T>;
export type StorageRuntime = 'native' | 'browser' | 'memory';
export type StorageDurability = 'device' | 'browser-managed' | 'ephemeral';

export interface KeyValueStorage {
  runtime: StorageRuntime;
  durability: StorageDurability;
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}

export function createMemoryKeyValueStorage(
  initial: Record<string, string> = {}
): KeyValueStorage {
  const values = new Map(Object.entries(initial));

  return {
    runtime: 'memory',
    durability: 'ephemeral',
    async getItem(key: string): Promise<string | null> {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      values.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      values.delete(key);
    },
  };
}
