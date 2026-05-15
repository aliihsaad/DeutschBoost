import {
  createStorageProviderSettingsRepository,
  type ProviderSettingsStorage,
} from '../../domain/settings/providerSettingsRepository';
import { createKeyValueProviderSecretStorage } from '../../domain/settings/providerSecretStorage';
import {
  createBrowserKeyValueStorage,
  createDefaultPlatformKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';

export function createBrowserProviderSettingsStorage(
  storage?: BrowserStorageLike | null
): ProviderSettingsStorage & Pick<KeyValueStorage, 'runtime' | 'durability'> {
  return createBrowserKeyValueStorage(storage);
}

export const browserProviderSettingsRepository = createDefaultProviderSettingsRepository();

function createDefaultProviderSettingsRepository() {
  const storage = createDefaultPlatformKeyValueStorage();

  return createStorageProviderSettingsRepository({
    storage,
    secretStorage: createKeyValueProviderSecretStorage({ storage }),
  });
}
