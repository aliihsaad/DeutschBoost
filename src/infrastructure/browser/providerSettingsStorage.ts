import {
  createKeyValueProviderSecretStorage,
  type ProviderSecretStorage,
} from '../../domain/settings/providerSecretStorage';
import {
  createStorageProviderSettingsRepository,
  type ProviderSettingsStorage,
} from '../../domain/settings/providerSettingsRepository';
import {
  createBrowserKeyValueStorage,
  createDefaultPlatformKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';
import { createInstalledNativeProviderSecretStorage } from '../native/providerSecretStorage';

export function createBrowserProviderSettingsStorage(
  storage?: BrowserStorageLike | null
): ProviderSettingsStorage & Pick<KeyValueStorage, 'runtime' | 'durability'> {
  return createBrowserKeyValueStorage(storage);
}

export const browserProviderSettingsRepository = createDefaultProviderSettingsRepository();

interface DefaultProviderSettingsRepositoryOptions {
  storage?: KeyValueStorage;
  nativeSecretStorageResolver?: () => ProviderSecretStorage | null;
}

export function createDefaultProviderSettingsRepository(
  options: DefaultProviderSettingsRepositoryOptions = {}
) {
  const storage = options.storage ?? createDefaultPlatformKeyValueStorage();
  const nativeSecretStorage = (
    options.nativeSecretStorageResolver ?? createInstalledNativeProviderSecretStorage
  )();

  return createStorageProviderSettingsRepository({
    storage,
    secretStorage: nativeSecretStorage ?? createKeyValueProviderSecretStorage({ storage }),
  });
}
