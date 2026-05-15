import { describe, expect, it, vi } from 'vitest';
import {
  browserLearningPlanRepository,
  createBrowserLearningPlanStorage,
} from '../../../src/infrastructure/browser/learningPlanStorage';

describe('learningPlanStorage', () => {
  it('adapts browser localStorage to learning-plan storage', async () => {
    const localStorageLike = {
      getItem: vi.fn(() => 'stored-value'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserLearningPlanStorage(localStorageLike);

    await expect(storage.getItem('plans')).resolves.toBe('stored-value');
    await storage.setItem('plans', 'new-value');
    await storage.removeItem('plans');

    expect(localStorageLike.getItem).toHaveBeenCalledWith('plans');
    expect(localStorageLike.setItem).toHaveBeenCalledWith('plans', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('plans');
    expect(storage.runtime).toBe('browser');
    expect(storage.durability).toBe('browser-managed');
  });

  it('falls back to memory storage when browser storage is unavailable', async () => {
    const storage = createBrowserLearningPlanStorage(null);

    await storage.setItem('plans', 'stored-value');
    await expect(storage.getItem('plans')).resolves.toBe('stored-value');

    await storage.removeItem('plans');
    await expect(storage.getItem('plans')).resolves.toBeNull();
    expect(storage.runtime).toBe('memory');
    expect(storage.durability).toBe('ephemeral');
  });

  it('exports the browser learning-plan repository singleton', () => {
    expect(browserLearningPlanRepository).toEqual({
      loadActive: expect.any(Function),
      save: expect.any(Function),
      markItemCompletion: expect.any(Function),
      recordPlacementResult: expect.any(Function),
    });
  });
});
