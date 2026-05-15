import {
  createStorageLearningPlanRepository,
  type LearningPlanStorage,
} from '../../domain/learning/learningPlanRepository';
import {
  createBrowserKeyValueStorage,
  createDefaultPlatformKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';

export function createBrowserLearningPlanStorage(
  storage?: BrowserStorageLike | null
): LearningPlanStorage & Pick<KeyValueStorage, 'runtime' | 'durability'> {
  return createBrowserKeyValueStorage(storage);
}

export const browserLearningPlanRepository = createStorageLearningPlanRepository({
  storage: createDefaultPlatformKeyValueStorage(),
});
