import { describe, expect, it, vi } from 'vitest';
import {
  browserLearningPlanRepository,
  createBrowserLearningPlanStorage,
} from '../../../src/infrastructure/browser/learningPlanStorage';

describe('learningPlanStorage', () => {
  it('adapts browser localStorage to learning-plan storage', () => {
    const localStorageLike = {
      getItem: vi.fn(() => 'stored-value'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createBrowserLearningPlanStorage(localStorageLike);

    expect(storage.getItem('plans')).toBe('stored-value');
    storage.setItem('plans', 'new-value');
    storage.removeItem('plans');

    expect(localStorageLike.getItem).toHaveBeenCalledWith('plans');
    expect(localStorageLike.setItem).toHaveBeenCalledWith('plans', 'new-value');
    expect(localStorageLike.removeItem).toHaveBeenCalledWith('plans');
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
