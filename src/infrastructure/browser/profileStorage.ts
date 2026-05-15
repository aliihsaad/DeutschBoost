import {
  createStorageProfileRepository,
  type ProfileStorage,
} from '../../domain/profile/profileRepository';
import {
  createBrowserKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';

export function createBrowserProfileStorage(
  storage?: BrowserStorageLike | null
): ProfileStorage & Pick<KeyValueStorage, 'runtime' | 'durability'> {
  return createBrowserKeyValueStorage(storage);
}

export const browserProfileRepository = createStorageProfileRepository({
  storage: createBrowserProfileStorage(),
});
