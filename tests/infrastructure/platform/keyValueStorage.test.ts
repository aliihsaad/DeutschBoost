import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserKeyValueStorage,
  createPlatformKeyValueStorage,
} from '../../../src/infrastructure/platform/keyValueStorage';
import type { KeyValueStorage } from '../../../src/domain/storage/keyValueStorage';

describe('platform key-value storage', () => {
  it('prefers injected native storage for desktop and Android shells', async () => {
    const nativeStorage: KeyValueStorage = {
      runtime: 'native',
      durability: 'device',
      getItem: vi.fn().mockResolvedValue('native-value'),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    };

    const storage = createPlatformKeyValueStorage({
      nativeStorage,
      browserStorage: {
        getItem: vi.fn().mockReturnValue('browser-value'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    await expect(storage.getItem('settings')).resolves.toBe('native-value');
    expect(storage.runtime).toBe('native');
    expect(storage.durability).toBe('device');
  });

  it('uses browser storage when native storage is not supplied', async () => {
    const browserStorage = {
      getItem: vi.fn().mockReturnValue('browser-value'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const storage = createPlatformKeyValueStorage({ browserStorage });

    await expect(storage.getItem('settings')).resolves.toBe('browser-value');
    await storage.setItem('settings', 'new-value');
    await storage.removeItem('settings');

    expect(storage.runtime).toBe('browser');
    expect(storage.durability).toBe('browser-managed');
    expect(browserStorage.setItem).toHaveBeenCalledWith('settings', 'new-value');
    expect(browserStorage.removeItem).toHaveBeenCalledWith('settings');
  });

  it('falls back to memory storage when browser storage is unavailable', async () => {
    const storage = createBrowserKeyValueStorage(null);

    await storage.setItem('settings', 'memory-value');

    await expect(storage.getItem('settings')).resolves.toBe('memory-value');
    expect(storage.runtime).toBe('memory');
    expect(storage.durability).toBe('ephemeral');
  });
});
