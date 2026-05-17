import type { AiProvider } from '../ai/aiProvider';
import { createGeminiAiProvider, type GeminiClientLike } from '../ai/geminiProvider';
import { createOpenRouterProvider } from '../ai/openRouterProvider';
import type { SpeechProvider } from '../speech/speechProvider';
import { createDeepgramSpeechProvider } from '../speech/deepgramProvider';
import type { LiveConversationProvider } from '../conversation/liveConversationProvider';
import {
  createGeminiLiveConversationProvider,
  type GeminiLiveWebSocketCtor,
} from '../conversation/geminiLiveProvider';
import type { ProviderSettingsSnapshot } from '../../ui/providerStatusModel';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type AiProviderSetting = 'gemini' | 'openrouter';
export type SpeechProviderSetting = 'deepgram';
export type LiveConversationProviderSetting = 'gemini-live';

export interface LocalAiProviderSettings {
  enabled: boolean;
  provider: AiProviderSetting;
  apiKey?: string;
  model: string;
}

export interface LocalSpeechProviderSettings {
  enabled: boolean;
  provider: SpeechProviderSetting;
  apiKey?: string;
  model: string;
  ttsModel: string;
  language: string;
}

export interface LocalLiveConversationProviderSettings {
  enabled: boolean;
  provider: LiveConversationProviderSetting;
  apiKey?: string;
  model: string;
  voiceName: string;
}

export interface LocalProviderSettings {
  ai: LocalAiProviderSettings;
  speech: LocalSpeechProviderSettings;
  live?: LocalLiveConversationProviderSettings;
}

export interface ProviderFactoryDependencies {
  geminiClient?: GeminiClientLike;
  fetchFn?: FetchLike;
  now?: () => string;
  WebSocketCtor?: GeminiLiveWebSocketCtor;
}

export interface ProviderSettingsSnapshots {
  ai: ProviderSettingsSnapshot;
  speech: ProviderSettingsSnapshot;
  live: ProviderSettingsSnapshot;
}

export interface ProviderModelOption {
  value: string;
  label: string;
}

const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
const DEFAULT_DEEPGRAM_MODEL = 'nova-3';
const DEFAULT_DEEPGRAM_TTS_MODEL = 'aura-2-viktoria-de';
const DEFAULT_DEEPGRAM_LANGUAGE = 'de';
const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const DEFAULT_GEMINI_LIVE_VOICE = 'Kore';
const FIXED_OPENROUTER_APP_TITLE = 'DeutschBoost';
const FIXED_OPENROUTER_SITE_URL = 'app://deutschboost';

export const OPENROUTER_MODEL_OPTIONS: ProviderModelOption[] = [
  { value: 'openrouter/auto', label: 'Auto router' },
  { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
];

export const DEEPGRAM_MODEL_OPTIONS: ProviderModelOption[] = [
  { value: 'nova-3', label: 'Nova-3' },
  { value: 'nova-2', label: 'Nova-2' },
];

export const DEEPGRAM_TTS_MODEL_OPTIONS: ProviderModelOption[] = [
  { value: 'aura-2-viktoria-de', label: 'Viktoria (German)' },
  { value: 'aura-2-julius-de', label: 'Julius (German)' },
  { value: 'aura-2-elara-de', label: 'Elara (German)' },
  { value: 'aura-2-fabian-de', label: 'Fabian (German)' },
];

export const DEEPGRAM_LANGUAGE_OPTIONS: ProviderModelOption[] = [
  { value: 'de', label: 'German (de)' },
];

export const GEMINI_LIVE_MODEL_OPTIONS: ProviderModelOption[] = [
  { value: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live' },
  { value: 'gemini-2.5-flash-live-preview', label: 'Gemini 2.5 Flash Live' },
];

export const GEMINI_LIVE_VOICE_OPTIONS: ProviderModelOption[] = [
  { value: 'Kore', label: 'Kore' },
  { value: 'Puck', label: 'Puck' },
  { value: 'Charon', label: 'Charon' },
  { value: 'Fenrir', label: 'Fenrir' },
];

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
      ttsModel: DEFAULT_DEEPGRAM_TTS_MODEL,
      language: DEFAULT_DEEPGRAM_LANGUAGE,
    },
    live: {
      enabled: false,
      provider: 'gemini-live',
      model: DEFAULT_GEMINI_LIVE_MODEL,
      voiceName: DEFAULT_GEMINI_LIVE_VOICE,
    },
  };
}

export function buildProviderSettingsSnapshots(
  settings: LocalProviderSettings
): ProviderSettingsSnapshots {
  const defaults = createDefaultLocalProviderSettings();

  return {
    ai: buildAiProviderSettingsSnapshot(settings.ai),
    speech: buildSpeechProviderSettingsSnapshot(settings.speech),
    live: buildLiveConversationProviderSettingsSnapshot(settings.live ?? defaults.live!),
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

export function buildLiveConversationProviderSettingsSnapshot(
  settings: LocalLiveConversationProviderSettings
): ProviderSettingsSnapshot {
  return {
    kind: 'live',
    providerName: getLiveConversationProviderName(settings.provider),
    enabled: settings.enabled,
    configured: isLiveConversationProviderConfigured(settings),
    model: settings.model,
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
    appTitle: FIXED_OPENROUTER_APP_TITLE,
    siteUrl: FIXED_OPENROUTER_SITE_URL,
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
    ttsModel: settings.ttsModel,
    language: settings.language,
    fetchFn: dependencies.fetchFn,
    now: dependencies.now,
  });
}

export function createLiveConversationProviderFromSettings(
  settings: LocalLiveConversationProviderSettings,
  dependencies: ProviderFactoryDependencies = {}
): LiveConversationProvider | null {
  if (!settings.enabled || !isLiveConversationProviderConfigured(settings)) {
    return null;
  }

  return createGeminiLiveConversationProvider({
    apiKey: settings.apiKey ?? '',
    model: settings.model,
    voiceName: settings.voiceName,
    WebSocketCtor: dependencies.WebSocketCtor,
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

export function isLiveConversationProviderConfigured(
  settings: LocalLiveConversationProviderSettings
): boolean {
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

function getLiveConversationProviderName(provider: LiveConversationProviderSetting): string {
  return provider === 'gemini-live' ? 'Gemini Live' : provider;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
