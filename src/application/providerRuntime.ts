import type { AiProvider } from '../domain/ai/aiProvider';
import type { StreamingAiProvider } from '../domain/ai/streamingAiProvider';
import { createOpenRouterStreamingProvider } from '../domain/ai/openRouterStreamingProvider';
import type { SpeechProvider } from '../domain/speech/speechProvider';
import type { StreamingSpeechProvider } from '../domain/speech/streamingSpeechProvider';
import type { LiveConversationProvider } from '../domain/conversation/liveConversationProvider';
import {
  createDeepgramStreamingSpeechProvider,
  type DeepgramStreamingWebSocketCtor,
} from '../domain/speech/deepgramStreamingProvider';
import {
  buildProviderSettingsSnapshots,
  createDefaultLocalProviderSettings,
  createAiProviderFromSettings,
  createLiveConversationProviderFromSettings,
  createSpeechProviderFromSettings,
  isAiProviderConfigured,
  isLiveConversationProviderConfigured,
  isSpeechProviderConfigured,
  type LocalProviderSettings,
  type ProviderFactoryDependencies,
  type ProviderSettingsSnapshots,
} from '../domain/settings/providerSettings';

export interface LocalProviderRuntime {
  settings: LocalProviderSettings;
  snapshots: ProviderSettingsSnapshots;
  aiProvider: AiProvider | null;
  speechProvider: SpeechProvider | null;
  streamingAiProvider: StreamingAiProvider | null;
  streamingSpeechProvider: StreamingSpeechProvider | null;
  liveConversationProvider: LiveConversationProvider | null;
}

export interface LocalProviderRuntimeDependencies extends ProviderFactoryDependencies {
  WebSocketCtor?: DeepgramStreamingWebSocketCtor;
}

class DeepgramTemporaryTokenError extends Error {
  constructor(readonly status: number) {
    super(`Deepgram temporary token request failed: HTTP ${status}`);
    this.name = 'DeepgramTemporaryTokenError';
  }
}

export function createLocalProviderRuntime(
  settings: LocalProviderSettings,
  dependencies: LocalProviderRuntimeDependencies = {}
): LocalProviderRuntime {
  return {
    settings,
    snapshots: buildProviderSettingsSnapshots(settings),
    aiProvider: createAiProviderFromSettings(settings.ai, dependencies),
    speechProvider: createSpeechProviderFromSettings(settings.speech, dependencies),
    streamingAiProvider: createStreamingAiProvider(settings, dependencies),
    streamingSpeechProvider: createStreamingSpeechProvider(settings, dependencies),
    liveConversationProvider: createLiveConversationProvider(settings, dependencies),
  };
}

function createLiveConversationProvider(
  settings: LocalProviderSettings,
  dependencies: LocalProviderRuntimeDependencies
): LiveConversationProvider | null {
  const liveSettings = settings.live ?? createDefaultLocalProviderSettings().live!;

  if (!liveSettings.enabled || !isLiveConversationProviderConfigured(liveSettings)) {
    return null;
  }

  return createLiveConversationProviderFromSettings(liveSettings, dependencies);
}

function createStreamingAiProvider(
  settings: LocalProviderSettings,
  dependencies: LocalProviderRuntimeDependencies
): StreamingAiProvider | null {
  if (
    settings.ai.provider !== 'openrouter' ||
    !settings.ai.enabled ||
    !isAiProviderConfigured(settings.ai)
  ) {
    return null;
  }

  return createOpenRouterStreamingProvider({
    apiKey: settings.ai.apiKey,
    model: settings.ai.model,
    appTitle: 'DeutschBoost',
    siteUrl: 'app://deutschboost',
    fetchFn: dependencies.fetchFn,
  });
}

function createStreamingSpeechProvider(
  settings: LocalProviderSettings,
  dependencies: LocalProviderRuntimeDependencies
): StreamingSpeechProvider | null {
  if (!settings.speech.enabled || !isSpeechProviderConfigured(settings.speech)) {
    return null;
  }

  return createDeepgramStreamingSpeechProvider({
    apiKey: settings.speech.apiKey,
    WebSocketCtor: dependencies.WebSocketCtor,
    shouldFallbackToApiKey: error =>
      error instanceof DeepgramTemporaryTokenError && error.status === 403,
    tokenProvider: async () => {
      const fetchFn = dependencies.fetchFn ?? fetch;
      const response = await fetchFn('/api/deepgram/v1/auth/grant', {
        method: 'POST',
        headers: {
          Authorization: `Token ${settings.speech.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });

      if (!response.ok) {
        throw new DeepgramTemporaryTokenError(response.status);
      }

      const body = (await response.json()) as { access_token?: string };

      if (!body.access_token) {
        throw new Error('Deepgram temporary token response did not include an access token');
      }

      return body.access_token;
    },
  });
}
