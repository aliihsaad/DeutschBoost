import {
  DEEPGRAM_LANGUAGE_OPTIONS,
  DEEPGRAM_MODEL_OPTIONS,
  OPENROUTER_MODEL_OPTIONS,
  createDefaultLocalProviderSettings,
  type AiProviderSetting,
  type LocalProviderSettings,
  type SpeechProviderSetting,
} from './providerSettings';

export const DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY = 'deutschboost.providerSettings.v1';

type MaybePromise<T> = T | Promise<T>;

export interface ProviderSettingsStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}

export interface ProviderSettingsRepository {
  load(): Promise<LocalProviderSettings>;
  save(settings: LocalProviderSettings): Promise<LocalProviderSettings>;
  update(
    updater: (settings: LocalProviderSettings) => LocalProviderSettings
  ): Promise<LocalProviderSettings>;
  reset(): Promise<LocalProviderSettings>;
}

interface StorageProviderSettingsRepositoryOptions {
  storage: ProviderSettingsStorage;
  key?: string;
}

export function createStorageProviderSettingsRepository(
  options: StorageProviderSettingsRepositoryOptions
): ProviderSettingsRepository {
  const key = options.key ?? DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY;

  return {
    async load(): Promise<LocalProviderSettings> {
      return loadFromStorage(options.storage, key);
    },
    async save(settings: LocalProviderSettings): Promise<LocalProviderSettings> {
      const normalized = normalizeProviderSettings(settings);
      await options.storage.setItem(key, JSON.stringify(normalized));
      return normalized;
    },
    async update(
      updater: (settings: LocalProviderSettings) => LocalProviderSettings
    ): Promise<LocalProviderSettings> {
      const current = await loadFromStorage(options.storage, key);
      return this.save(updater(current));
    },
    async reset(): Promise<LocalProviderSettings> {
      await options.storage.removeItem(key);
      return createDefaultLocalProviderSettings();
    },
  };
}

async function loadFromStorage(
  storage: ProviderSettingsStorage,
  key: string
): Promise<LocalProviderSettings> {
  const stored = await storage.getItem(key);

  if (!stored) {
    return createDefaultLocalProviderSettings();
  }

  try {
    return normalizeProviderSettings(JSON.parse(stored));
  } catch {
    await storage.removeItem(key);
    return createDefaultLocalProviderSettings();
  }
}

function normalizeProviderSettings(settings: unknown): LocalProviderSettings {
  const defaults = createDefaultLocalProviderSettings();
  const root = asRecord(settings);
  const ai = asRecord(root.ai);
  const speech = asRecord(root.speech);

  return {
    ai: {
      enabled: normalizeBoolean(ai.enabled, defaults.ai.enabled),
      provider: normalizeAiProvider(ai.provider, defaults.ai.provider),
      model: normalizeModelOption(ai.model, OPENROUTER_MODEL_OPTIONS, defaults.ai.model),
      ...optionalText('apiKey', ai.apiKey, defaults.ai.apiKey),
    },
    speech: {
      enabled: normalizeBoolean(speech.enabled, defaults.speech.enabled),
      provider: normalizeSpeechProvider(speech.provider, defaults.speech.provider),
      model: normalizeModelOption(speech.model, DEEPGRAM_MODEL_OPTIONS, defaults.speech.model),
      language: normalizeModelOption(speech.language, DEEPGRAM_LANGUAGE_OPTIONS, defaults.speech.language),
      ...optionalText('apiKey', speech.apiKey, defaults.speech.apiKey),
    },
  };
}

function normalizeAiProvider(
  value: unknown,
  fallback: AiProviderSetting
): AiProviderSetting {
  return value === 'gemini' || value === 'openrouter' ? value : fallback;
}

function normalizeSpeechProvider(
  value: unknown,
  fallback: SpeechProviderSetting
): SpeechProviderSetting {
  return value === 'deepgram' ? value : fallback;
}

function normalizeModelOption(
  value: unknown,
  options: Array<{ value: string }>,
  fallback: string
): string {
  return typeof value === 'string' && options.some(option => option.value === value) ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function optionalText<Key extends string>(
  key: Key,
  value: unknown,
  fallback?: string
): Partial<Record<Key, string>> {
  const normalized = normalizeOptionalText(value) ?? normalizeOptionalText(fallback);
  return normalized ? ({ [key]: normalized } as Partial<Record<Key, string>>) : {};
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
