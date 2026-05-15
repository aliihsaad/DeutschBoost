import { describe, expect, it, vi } from 'vitest';
import {
  createCapacitorPreferencesKeyValueStorage,
  createInstalledNativeKeyValueStorage,
  createTauriStoreKeyValueStorage,
} from '../../../src/infrastructure/native/keyValueStorage';

describe('native key-value storage adapters', () => {
  it('adapts Tauri Store to KeyValueStorage and saves after writes', async () => {
    const store = {
      get: vi.fn(async (key: string) => (key === 'settings' ? 'stored-value' : null)),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    };
    const load = vi.fn(async () => store);
    const storage = createTauriStoreKeyValueStorage(load, {
      storePath: 'deutschboost.json',
    });

    await expect(storage.getItem('settings')).resolves.toBe('stored-value');
    await storage.setItem('settings', 'new-value');
    await storage.removeItem('settings');

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('deutschboost.json', { autoSave: false });
    expect(store.set).toHaveBeenCalledWith('settings', 'new-value');
    expect(store.delete).toHaveBeenCalledWith('settings');
    expect(store.save).toHaveBeenCalledTimes(2);
    expect(storage.runtime).toBe('native');
    expect(storage.durability).toBe('device');
  });

  it('ignores non-string values read from Tauri Store', async () => {
    const store = {
      get: vi.fn(async () => ({ nested: true })),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const storage = createTauriStoreKeyValueStorage(async () => store);

    await expect(storage.getItem('settings')).resolves.toBeNull();
  });

  it('adapts Capacitor Preferences to KeyValueStorage', async () => {
    const preferences = {
      get: vi.fn(async ({ key }: { key: string }) => ({
        value: key === 'settings' ? 'stored-value' : null,
      })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const storage = createCapacitorPreferencesKeyValueStorage(preferences);

    await expect(storage.getItem('settings')).resolves.toBe('stored-value');
    await storage.setItem('settings', 'new-value');
    await storage.removeItem('settings');

    expect(preferences.get).toHaveBeenCalledWith({ key: 'settings' });
    expect(preferences.set).toHaveBeenCalledWith({ key: 'settings', value: 'new-value' });
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'settings' });
    expect(storage.runtime).toBe('native');
    expect(storage.durability).toBe('device');
  });

  it('detects installed native storage and prefers Tauri Store over Capacitor Preferences', async () => {
    const tauriStore = {
      get: vi.fn(async () => 'tauri-value'),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const tauriLoad = vi.fn(async () => tauriStore);
    const preferences = {
      get: vi.fn(async () => ({ value: 'capacitor-value' })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    const storage = createInstalledNativeKeyValueStorage({
      __TAURI__: { store: { load: tauriLoad } },
      Capacitor: { Plugins: { Preferences: preferences } },
    });

    await expect(storage?.getItem('settings')).resolves.toBe('tauri-value');
    expect(tauriLoad).toHaveBeenCalled();
    expect(preferences.get).not.toHaveBeenCalled();
  });

  it('returns null when no supported native storage is installed', () => {
    expect(createInstalledNativeKeyValueStorage({})).toBeNull();
  });
});
