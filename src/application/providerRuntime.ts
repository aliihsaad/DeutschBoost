import type { AiProvider } from '../domain/ai/aiProvider';
import type { SpeechProvider } from '../domain/speech/speechProvider';
import {
  buildProviderSettingsSnapshots,
  createAiProviderFromSettings,
  createSpeechProviderFromSettings,
  type LocalProviderSettings,
  type ProviderFactoryDependencies,
  type ProviderSettingsSnapshots,
} from '../domain/settings/providerSettings';

export interface LocalProviderRuntime {
  settings: LocalProviderSettings;
  snapshots: ProviderSettingsSnapshots;
  aiProvider: AiProvider | null;
  speechProvider: SpeechProvider | null;
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
  };
}
