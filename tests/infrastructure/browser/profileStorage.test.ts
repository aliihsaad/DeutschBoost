import { describe, expect, it, vi } from 'vitest';
import { createBrowserProfileStorage } from '../../../src/infrastructure/browser/profileStorage';

describe('profileStorage', () => {
  it('adapts browser localStorage to profile storage', () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => (key === 'profile' ? 'stored-value' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserProfileStorage(localStorageLike);

    expect(storage.getItem('profile')).toBe('stored-value');

    storage.setItem('profile', 'new-value');
    storage.removeItem('profile');

    expect(localStorageLike.setItem).toHaveBeenCalledWith('profile', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('profile');
  });

  it('falls back to memory storage when browser storage is unavailable', () => {
    const storage = createBrowserProfileStorage(null);

    storage.setItem('profile', 'stored-value');
    expect(storage.getItem('profile')).toBe('stored-value');

    storage.removeItem('profile');
    expect(storage.getItem('profile')).toBeNull();
  });
});
