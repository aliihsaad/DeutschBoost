import type { AiProvider } from '../ai/aiProvider';
import { createGeminiAiProvider, type GeminiClientLike } from '../ai/geminiProvider';
import { createOpenRouterProvider } from '../ai/openRouterProvider';
import type { SpeechProvider } from '../speech/speechProvider';
import { createDeepgramSpeechProvider } from '../speech/deepgramProvider';
import type { ProviderSettingsSnapshot } from '../../ui/providerStatusModel';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type AiProviderSetting = 'gemini' | 'openrouter';
export type SpeechProviderSetting = 'deepgram';

export interface LocalAiProviderSettings {
  enabled: boolean;
  provider: AiProviderSetting;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  appTitle?: string;
  siteUrl?: string;
}

export interface LocalSpeechProviderSettings {
  enabled: boolean;
  provider: SpeechProviderSetting;
  apiKey?: string;
  model: string;
  language: string;
  baseUrl?: string;
}

export interface LocalProviderSettings {
  ai: LocalAiProviderSettings;
  speech: LocalSpeechProviderSettings;
}

export interface ProviderFactoryDependencies {
  geminiClient?: GeminiClientLike;
  fetchFn?: FetchLike;
  now?: () => string;
}

export interface ProviderSettingsSnapshots {
  ai: ProviderSettingsSnapshot;
  speech: ProviderSettingsSnapshot;
}

const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
const DEFAULT_DEEPGRAM_MODEL = 'nova-3';
const DEFAULT_DEEPGRAM_LANGUAGE = 'de';

export function createDefaultLocalProviderSettings(): LocalProviderSettings {
  return {
    ai: {
      enabled: false,
      provider: 'openrouter',
      model: DEFAULT_OPENROUTER_MODEL,
    },
    speech: {
      enabled: false,
      provider: 'deepgram',
      model: DEFAULT_DEEPGRAM_MODEL,
      language: DEFAULT_DEEPGRAM_LANGUAGE,
    },
  };
}

export function buildProviderSettingsSnapshots(
  settings: LocalProviderSettings
): ProviderSettingsSnapshots {
  return {
    ai: buildAiProviderSettingsSnapshot(settings.ai),
    speech: buildSpeechProviderSettingsSnapshot(settings.speech),
  };
}

export function buildAiProviderSettingsSnapshot(
  settings: LocalAiProviderSettings
): ProviderSettingsSnapshot {
  return {
    kind: 'ai',
    providerName: getAiProviderName(settings.provider),
    enabled: settings.enabled,
    configured: isAiProviderConfigured(settings),
    model: settings.model,
  };
}

export function buildSpeechProviderSettingsSnapshot(
  settings: LocalSpeechProviderSettings
): ProviderSettingsSnapshot {
  return {
    kind: 'speech',
    providerName: getSpeechProviderName(settings.provider),
    enabled: settings.enabled,
    configured: isSpeechProviderConfigured(settings),
    model: settings.model,
    language: settings.language,
  };
}

export function createAiProviderFromSettings(
  settings: LocalAiProviderSettings,
  dependencies: ProviderFactoryDependencies = {}
): AiProvider | null {
  if (!settings.enabled || !isAiProviderConfigured(settings)) {
    return null;
  }

  if (settings.provider === 'gemini') {
    if (!dependencies.geminiClient) {
      return null;
    }

    return createGeminiAiProvider({
      client: dependencies.geminiClient,
      defaultJsonModel: settings.model,
      defaultTextModel: settings.model,
    });
  }

  return createOpenRouterProvider({
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
    appTitle: settings.appTitle,
    siteUrl: settings.siteUrl,
    fetchFn: dependencies.fetchFn,
  });
}

export function createSpeechProviderFromSettings(
  settings: LocalSpeechProviderSettings,
  dependencies: ProviderFactoryDependencies = {}
): SpeechProvider | null {
  if (!settings.enabled || !isSpeechProviderConfigured(settings)) {
    return null;
  }

  return createDeepgramSpeechProvider({
    apiKey: settings.apiKey,
    model: settings.model,
    language: settings.language,
    baseUrl: settings.baseUrl,
    fetchFn: dependencies.fetchFn,
    now: dependencies.now,
  });
}

export function isAiProviderConfigured(settings: LocalAiProviderSettings): boolean {
  if (settings.provider === 'gemini') {
    return settings.enabled;
  }

  return settings.enabled && hasValue(settings.apiKey);
}

export function isSpeechProviderConfigured(settings: LocalSpeechProviderSettings): boolean {
  return settings.enabled && hasValue(settings.apiKey);
}

function getAiProviderName(provider: AiProviderSetting): string {
  if (provider === 'gemini') {
    return 'Gemini';
  }

  return 'OpenRouter';
}

function getSpeechProviderName(provider: SpeechProviderSetting): string {
  return provider === 'deepgram' ? 'Deepgram' : provider;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
