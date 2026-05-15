import { describe, expect, it, vi } from 'vitest';
import { createBrowserProviderSettingsStorage } from '../../../src/infrastructure/browser/providerSettingsStorage';

describe('providerSettingsStorage', () => {
  it('adapts browser localStorage to provider settings storage', () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => (key === 'settings' ? 'stored-value' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserProviderSettingsStorage(localStorageLike);

    expect(storage.getItem('settings')).toBe('stored-value');

    storage.setItem('settings', 'new-value');
    storage.removeItem('settings');

    expect(localStorageLike.setItem).toHaveBeenCalledWith('settings', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('settings');
  });

  it('falls back to memory storage when browser storage is unavailable', () => {
    const storage = createBrowserProviderSettingsStorage(null);

    storage.setItem('settings', 'stored-value');
    expect(storage.getItem('settings')).toBe('stored-value');

    storage.removeItem('settings');
    expect(storage.getItem('settings')).toBeNull();
  });
});
