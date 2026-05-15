import { describe, expect, it, vi } from 'vitest';
import { createBrowserProfileStorage } from '../../../src/infrastructure/browser/profileStorage';

describe('profileStorage', () => {
  it('adapts browser localStorage to profile storage', async () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => (key === 'profile' ? 'stored-value' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserProfileStorage(localStorageLike);

    await expect(storage.getItem('profile')).resolves.toBe('stored-value');

    await storage.setItem('profile', 'new-value');
    await storage.removeItem('profile');

    expect(localStorageLike.setItem).toHaveBeenCalledWith('profile', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('profile');
    expect(storage.runtime).toBe('browser');
    expect(storage.durability).toBe('browser-managed');
  });

  it('falls back to memory storage when browser storage is unavailable', async () => {
    const storage = createBrowserProfileStorage(null);

    await storage.setItem('profile', 'stored-value');
    await expect(storage.getItem('profile')).resolves.toBe('stored-value');

    await storage.removeItem('profile');
    await expect(storage.getItem('profile')).resolves.toBeNull();
    expect(storage.runtime).toBe('memory');
    expect(storage.durability).toBe('ephemeral');
  });
});
