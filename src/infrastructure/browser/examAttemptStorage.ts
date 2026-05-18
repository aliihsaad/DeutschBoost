import {
  createStorageExamAttemptRepository,
  type ExamAttemptRepository,
} from '../../domain/exam/examAttemptRepository';
import {
  createBrowserKeyValueStorage,
  createDefaultPlatformKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';

export function createBrowserExamAttemptStorage(
  storage?: BrowserStorageLike | null
): Pick<KeyValueStorage, 'runtime' | 'durability' | 'getItem' | 'setItem' | 'removeItem'> {
  return createBrowserKeyValueStorage(storage);
}

export const browserExamAttemptRepository: ExamAttemptRepository = createStorageExamAttemptRepository({
  storage: createDefaultPlatformKeyValueStorage(),
});
