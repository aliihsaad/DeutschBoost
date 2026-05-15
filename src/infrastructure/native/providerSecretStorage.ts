import type {
  ProviderSecretName,
  ProviderSecretStorage,
} from '../../domain/settings/providerSecretStorage';

export const DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_FILE =
  'deutschboost-provider-secrets.hold';
export const DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_CLIENT =
  'deutschboost-provider-secrets';
export const DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_PASSWORD =
  'deutschboost-provider-secrets-v1';
const DEFAULT_TAURI_STRONGHOLD_RECORD_PREFIX = 'deutschboost.providerSecrets.v1';

type MaybePromise<T> = T | Promise<T>;

export interface TauriStrongholdStoreLike {
  get(key: string): MaybePromise<Uint8Array | null>;
  insert(key: string, value: number[]): MaybePromise<void>;
  remove(key: string): MaybePromise<Uint8Array | null>;
}

export interface TauriStrongholdClientLike {
  getStore(): TauriStrongholdStoreLike;
}

export interface TauriStrongholdLike {
  loadClient(client: string): MaybePromise<TauriStrongholdClientLike>;
  createClient(client: string): MaybePromise<TauriStrongholdClientLike>;
  save(): MaybePromise<void>;
}

export interface TauriStrongholdApiLike {
  Stronghold: {
    load(path: string, password: string): MaybePromise<TauriStrongholdLike>;
  };
}

export interface TauriPathApiLike {
  appDataDir(): MaybePromise<string>;
  join?(...paths: string[]): MaybePromise<string>;
}

export interface NativeProviderSecretStorageGlobal {
  isTauri?: boolean;
}

interface TauriStrongholdDependencies {
  strongholdApi: TauriStrongholdApiLike;
  pathApi: TauriPathApiLike;
}

interface TauriStrongholdProviderSecretStorageOptions
  extends Partial<TauriStrongholdDependencies> {
  loadDependencies?: () => MaybePromise<TauriStrongholdDependencies>;
  vaultPath?: string;
  vaultPassword?: string;
  clientName?: string;
  recordPrefix?: string;
}

interface TauriStrongholdSession {
  stronghold: TauriStrongholdLike;
  store: TauriStrongholdStoreLike;
}

export function createTauriStrongholdProviderSecretStorage(
  options: TauriStrongholdProviderSecretStorageOptions = {}
): ProviderSecretStorage {
  const vaultPassword =
    options.vaultPassword ?? DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_PASSWORD;
  const clientName =
    options.clientName ?? DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_CLIENT;
  const recordPrefix = options.recordPrefix ?? DEFAULT_TAURI_STRONGHOLD_RECORD_PREFIX;
  let sessionPromise: Promise<TauriStrongholdSession> | null = null;

  const getSession = (): Promise<TauriStrongholdSession> => {
    sessionPromise ??= openStrongholdSession({
      ...options,
      vaultPassword,
      clientName,
    });
    return sessionPromise;
  };

  return {
    protection: 'stronghold',
    async getSecret(name: ProviderSecretName): Promise<string | null> {
      const { store } = await getSession();
      const data = await store.get(recordKey(recordPrefix, name));
      if (!data) {
        return null;
      }

      const decoded = new TextDecoder().decode(new Uint8Array(data));
      return decoded.trim().length > 0 ? decoded : null;
    },
    async setSecret(name: ProviderSecretName, value: string): Promise<void> {
      const { store, stronghold } = await getSession();
      await store.insert(
        recordKey(recordPrefix, name),
        Array.from(new TextEncoder().encode(value))
      );
      await stronghold.save();
    },
    async removeSecret(name: ProviderSecretName): Promise<void> {
      const { store, stronghold } = await getSession();
      await store.remove(recordKey(recordPrefix, name));
      await stronghold.save();
    },
  };
}

export function createInstalledNativeProviderSecretStorage(
  globalScope: NativeProviderSecretStorageGlobal = globalThis as NativeProviderSecretStorageGlobal
): ProviderSecretStorage | null {
  if (!globalScope.isTauri) {
    return null;
  }

  return createTauriStrongholdProviderSecretStorage({
    loadDependencies: loadInstalledStrongholdDependencies,
  });
}

async function openStrongholdSession(
  options: TauriStrongholdProviderSecretStorageOptions & {
    vaultPassword: string;
    clientName: string;
  }
): Promise<TauriStrongholdSession> {
  const { strongholdApi, pathApi } = await resolveDependencies(options);
  const vaultPath = options.vaultPath ?? (await resolveVaultPath(pathApi));
  const stronghold = await strongholdApi.Stronghold.load(vaultPath, options.vaultPassword);
  const client = await loadOrCreateClient(stronghold, options.clientName);

  return {
    stronghold,
    store: client.getStore(),
  };
}

async function resolveDependencies(
  options: TauriStrongholdProviderSecretStorageOptions
): Promise<TauriStrongholdDependencies> {
  if (options.strongholdApi && options.pathApi) {
    return {
      strongholdApi: options.strongholdApi,
      pathApi: options.pathApi,
    };
  }

  if (options.loadDependencies) {
    return options.loadDependencies();
  }

  return loadInstalledStrongholdDependencies();
}

async function loadInstalledStrongholdDependencies(): Promise<TauriStrongholdDependencies> {
  const [strongholdApi, pathApi] = await Promise.all([
    import('@tauri-apps/plugin-stronghold'),
    import('@tauri-apps/api/path'),
  ]);

  return {
    strongholdApi,
    pathApi,
  };
}

async function resolveVaultPath(pathApi: TauriPathApiLike): Promise<string> {
  const appData = await pathApi.appDataDir();

  if (pathApi.join) {
    return pathApi.join(appData, DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_FILE);
  }

  return `${trimTrailingPathSeparator(appData)}/${DEFAULT_TAURI_STRONGHOLD_PROVIDER_SECRETS_FILE}`;
}

async function loadOrCreateClient(
  stronghold: TauriStrongholdLike,
  clientName: string
): Promise<TauriStrongholdClientLike> {
  try {
    return await stronghold.loadClient(clientName);
  } catch {
    return stronghold.createClient(clientName);
  }
}

function recordKey(prefix: string, name: ProviderSecretName): string {
  return `${prefix}.${name}`;
}

function trimTrailingPathSeparator(path: string): string {
  return path.replace(/[\\/]+$/, '');
}
