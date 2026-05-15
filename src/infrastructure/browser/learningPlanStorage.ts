import {
  createStorageLearningPlanRepository,
  type LearningPlanStorage,
} from '../../domain/learning/learningPlanRepository';

interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createBrowserLearningPlanStorage(
  storage: BrowserStorageLike | null | undefined = resolveBrowserLocalStorage()
): LearningPlanStorage {
  if (!storage) {
    return createMemoryLearningPlanStorage();
  }

  return {
    getItem(key: string): string | null {
      return storage.getItem(key);
    },
    setItem(key: string, value: string): void {
      storage.setItem(key, value);
    },
    removeItem(key: string): void {
      storage.removeItem(key);
    },
  };
}

export const browserLearningPlanRepository = createStorageLearningPlanRepository({
  storage: createBrowserLearningPlanStorage(),
});

function resolveBrowserLocalStorage(): BrowserStorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function createMemoryLearningPlanStorage(): LearningPlanStorage {
  const values = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
    removeItem(key: string): void {
      values.delete(key);
    },
  };
}
