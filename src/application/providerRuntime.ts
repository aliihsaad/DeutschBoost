import type { AiProvider } from '../domain/ai/aiProvider';
import type { StreamingAiProvider } from '../domain/ai/streamingAiProvider';
import { createOpenRouterStreamingProvider } from '../domain/ai/openRouterStreamingProvider';
import type { SpeechProvider } from '../domain/speech/speechProvider';
import type { StreamingSpeechProvider } from '../domain/speech/streamingSpeechProvider';
import { createDeepgramStreamingSpeechProvider } from '../domain/speech/deepgramStreamingProvider';
import {
  buildProviderSettingsSnapshots,
  createAiProviderFromSettings,
  createSpeechProviderFromSettings,
  isAiProviderConfigured,
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
}

export function createLocalProviderRuntime(
  settings: LocalProviderSettings,
  dependencies: ProviderFactoryDependencies = {}
): LocalProviderRuntime {
  return {
    settings,
    snapshots: buildProviderSettingsSnapshots(settings),
    aiProvider: createAiProviderFromSettings(settings.ai, dependencies),
    speechProvider: createSpeechProviderFromSettings(settings.speech, dependencies),
    streamingAiProvider: createStreamingAiProvider(settings, dependencies),
    streamingSpeechProvider: createStreamingSpeechProvider(settings, dependencies),
  };
}

function createStreamingAiProvider(
  settings: LocalProviderSettings,
  dependencies: ProviderFactoryDependencies
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
  dependencies: ProviderFactoryDependencies
): StreamingSpeechProvider | null {
  if (!settings.speech.enabled || !isSpeechProviderConfigured(settings.speech)) {
    return null;
  }

  return createDeepgramStreamingSpeechProvider({
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
        throw new Error(`Deepgram temporary token request failed: HTTP ${response.status}`);
      }

      const body = (await response.json()) as { access_token?: string };

      if (!body.access_token) {
        throw new Error('Deepgram temporary token response did not include an access token');
      }

      return body.access_token;
    },
  });
}
