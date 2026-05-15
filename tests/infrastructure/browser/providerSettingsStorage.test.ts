import { describe, expect, it, vi } from 'vitest';
import { createBrowserProviderSettingsStorage } from '../../../src/infrastructure/browser/providerSettingsStorage';

describe('providerSettingsStorage', () => {
  it('adapts browser localStorage to provider settings storage', async () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => (key === 'settings' ? 'stored-value' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserProviderSettingsStorage(localStorageLike);

    await expect(storage.getItem('settings')).resolves.toBe('stored-value');

    await storage.setItem('settings', 'new-value');
    await storage.removeItem('settings');

    expect(localStorageLike.setItem).toHaveBeenCalledWith('settings', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('settings');
    expect(storage.runtime).toBe('browser');
    expect(storage.durability).toBe('browser-managed');
  });

  it('falls back to memory storage when browser storage is unavailable', async () => {
    const storage = createBrowserProviderSettingsStorage(null);

    await storage.setItem('settings', 'stored-value');
    await expect(storage.getItem('settings')).resolves.toBe('stored-value');

    await storage.removeItem('settings');
    await expect(storage.getItem('settings')).resolves.toBeNull();
    expect(storage.runtime).toBe('memory');
    expect(storage.durability).toBe('ephemeral');
  });
});
