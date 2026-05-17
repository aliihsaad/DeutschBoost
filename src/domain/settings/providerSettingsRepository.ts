import {
  DEEPGRAM_LANGUAGE_OPTIONS,
  DEEPGRAM_MODEL_OPTIONS,
  DEEPGRAM_TTS_MODEL_OPTIONS,
  GEMINI_LIVE_MODEL_OPTIONS,
  GEMINI_LIVE_VOICE_OPTIONS,
  OPENROUTER_MODEL_OPTIONS,
  createDefaultLocalProviderSettings,
  type AiProviderSetting,
  type LiveConversationProviderSetting,
  type LocalProviderSettings,
  type SpeechProviderSetting,
} from './providerSettings';
import type { ProviderSecretStorage } from './providerSecretStorage';

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
  secretStorage?: ProviderSecretStorage;
  key?: string;
}

export function createStorageProviderSettingsRepository(
  options: StorageProviderSettingsRepositoryOptions
): ProviderSettingsRepository {
  const key = options.key ?? DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY;

  return {
    async load(): Promise<LocalProviderSettings> {
      return loadFromStorage(options.storage, key, options.secretStorage);
    },
    async save(settings: LocalProviderSettings): Promise<LocalProviderSettings> {
      const normalized = normalizeProviderSettings(settings);
      if (options.secretStorage) {
        await saveProviderSecrets(options.secretStorage, normalized);
        await options.storage.setItem(key, JSON.stringify(removeProviderSecrets(normalized)));
      } else {
        await options.storage.setItem(key, JSON.stringify(normalized));
      }
      return normalized;
    },
    async update(
      updater: (settings: LocalProviderSettings) => LocalProviderSettings
    ): Promise<LocalProviderSettings> {
      const current = await loadFromStorage(options.storage, key, options.secretStorage);
      return this.save(updater(current));
    },
    async reset(): Promise<LocalProviderSettings> {
      await options.storage.removeItem(key);
      await options.secretStorage?.removeSecret('ai.apiKey');
      await options.secretStorage?.removeSecret('speech.apiKey');
      await options.secretStorage?.removeSecret('live.apiKey');
      return createDefaultLocalProviderSettings();
    },
  };
}

async function loadFromStorage(
  storage: ProviderSettingsStorage,
  key: string,
  secretStorage?: ProviderSecretStorage
): Promise<LocalProviderSettings> {
  const stored = await storage.getItem(key);

  if (!stored) {
    return createDefaultLocalProviderSettings();
  }

  try {
    const normalized = normalizeProviderSettings(JSON.parse(stored));

    if (!secretStorage) {
      return normalized;
    }

    const merged = await mergeStoredProviderSecrets(secretStorage, normalized);
    await migrateInlineProviderSecrets(storage, key, secretStorage, normalized, merged);
    return merged;
  } catch {
    await storage.removeItem(key);
    await secretStorage?.removeSecret('ai.apiKey');
    await secretStorage?.removeSecret('speech.apiKey');
    await secretStorage?.removeSecret('live.apiKey');
    return createDefaultLocalProviderSettings();
  }
}

async function mergeStoredProviderSecrets(
  secretStorage: ProviderSecretStorage,
  settings: LocalProviderSettings
): Promise<LocalProviderSettings> {
  const aiApiKey = await secretStorage.getSecret('ai.apiKey') ?? settings.ai.apiKey;
  const speechApiKey = await secretStorage.getSecret('speech.apiKey') ?? settings.speech.apiKey;
  const liveSettings = settings.live ?? createDefaultLocalProviderSettings().live!;
  const liveApiKey = await secretStorage.getSecret('live.apiKey') ?? liveSettings.apiKey;

  return {
    ai: {
      ...settings.ai,
      ...optionalText('apiKey', aiApiKey),
    },
    speech: {
      ...settings.speech,
      ...optionalText('apiKey', speechApiKey),
    },
    live: {
      ...liveSettings,
      ...optionalText('apiKey', liveApiKey),
    },
  };
}

async function migrateInlineProviderSecrets(
  storage: ProviderSettingsStorage,
  key: string,
  secretStorage: ProviderSecretStorage,
  normalized: LocalProviderSettings,
  merged: LocalProviderSettings
): Promise<void> {
  if (!normalized.ai.apiKey && !normalized.speech.apiKey && !normalized.live?.apiKey) {
    return;
  }

  await saveProviderSecrets(secretStorage, merged);
  await storage.setItem(key, JSON.stringify(removeProviderSecrets(normalized)));
}

async function saveProviderSecrets(
  secretStorage: ProviderSecretStorage,
  settings: LocalProviderSettings
): Promise<void> {
  if (settings.ai.apiKey) {
    await secretStorage.setSecret('ai.apiKey', settings.ai.apiKey);
  } else {
    await secretStorage.removeSecret('ai.apiKey');
  }

  if (settings.speech.apiKey) {
    await secretStorage.setSecret('speech.apiKey', settings.speech.apiKey);
  } else {
    await secretStorage.removeSecret('speech.apiKey');
  }

  if (settings.live?.apiKey) {
    await secretStorage.setSecret('live.apiKey', settings.live.apiKey);
  } else {
    await secretStorage.removeSecret('live.apiKey');
  }
}

function removeProviderSecrets(settings: LocalProviderSettings): LocalProviderSettings {
  const ai = { ...settings.ai };
  const speech = { ...settings.speech };
  const live = { ...(settings.live ?? createDefaultLocalProviderSettings().live!) };
  delete ai.apiKey;
  delete speech.apiKey;
  delete live.apiKey;
  return { ai, speech, live };
}

function normalizeProviderSettings(settings: unknown): LocalProviderSettings {
  const defaults = createDefaultLocalProviderSettings();
  const root = asRecord(settings);
  const ai = asRecord(root.ai);
  const speech = asRecord(root.speech);
  const live = asRecord(root.live);

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
      ttsModel: normalizeModelOption(
        speech.ttsModel,
        DEEPGRAM_TTS_MODEL_OPTIONS,
        defaults.speech.ttsModel
      ),
      language: normalizeModelOption(speech.language, DEEPGRAM_LANGUAGE_OPTIONS, defaults.speech.language),
      ...optionalText('apiKey', speech.apiKey, defaults.speech.apiKey),
    },
    live: {
      enabled: normalizeBoolean(live.enabled, defaults.live!.enabled),
      provider: normalizeLiveConversationProvider(live.provider, defaults.live!.provider),
      model: normalizeModelOption(live.model, GEMINI_LIVE_MODEL_OPTIONS, defaults.live!.model),
      voiceName: normalizeModelOption(live.voiceName, GEMINI_LIVE_VOICE_OPTIONS, defaults.live!.voiceName),
      ...optionalText('apiKey', live.apiKey, defaults.live!.apiKey),
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

function normalizeLiveConversationProvider(
  value: unknown,
  fallback: LiveConversationProviderSetting
): LiveConversationProviderSetting {
  return value === 'gemini-live' ? value : fallback;
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
