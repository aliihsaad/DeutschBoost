import {
  createStorageProviderSettingsRepository,
  type ProviderSettingsStorage,
} from '../../domain/settings/providerSettingsRepository';
import {
  createBrowserKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';

export function createBrowserProviderSettingsStorage(
  storage?: BrowserStorageLike | null
): ProviderSettingsStorage & Pick<KeyValueStorage, 'runtime' | 'durability'> {
  return createBrowserKeyValueStorage(storage);
}

export const browserProviderSettingsRepository = createStorageProviderSettingsRepository({
  storage: createBrowserProviderSettingsStorage(),
});
