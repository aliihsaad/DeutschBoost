export type ProviderKind = 'ai' | 'speech';
export type ProviderState = 'configured' | 'disabled' | 'error';

export interface ProviderSettingsSnapshot {
  kind: ProviderKind;
  providerName: string;
  enabled: boolean;
  configured: boolean;
  model?: string;
  language?: string;
  lastError?: string;
}

export interface ProviderCapabilities {
  canGenerateTutorResponses: boolean;
  canGenerateActivities: boolean;
  canEvaluateWriting: boolean;
  canTranscribeSpeech: boolean;
}

export interface ProviderStatusDescription {
  kind: ProviderKind;
  providerName: string;
  state: ProviderState;
  headline: string;
  detail: string;
  actionLabel: string;
  capabilities: ProviderCapabilities;
}

export interface LearningCapabilities {
  aiTutorAvailable: boolean;
  activityGenerationAvailable: boolean;
  writingEvaluationAvailable: boolean;
  voiceInputAvailable: boolean;
  textConversationAvailable: boolean;
  fallbackReasons: string[];
}

export function describeProviderStatus(snapshot: ProviderSettingsSnapshot): ProviderStatusDescription {
  const state = getProviderState(snapshot);
  const capabilities = getProviderCapabilities(snapshot, state);

  if (state === 'disabled') {
    return {
      kind: snapshot.kind,
      providerName: snapshot.providerName,
      state,
      headline: snapshot.kind === 'ai' ? 'AI tutor is off' : 'Voice input is off',
      detail:
        snapshot.kind === 'ai'
          ? 'Local sample exercises remain available until an AI provider is configured.'
          : 'Text conversation remains available until a speech provider is configured.',
      actionLabel: snapshot.kind === 'ai' ? 'Configure AI' : 'Configure voice',
      capabilities,
    };
  }

  if (state === 'error') {
    return {
      kind: snapshot.kind,
      providerName: snapshot.providerName,
      state,
      headline: `${snapshot.providerName} needs attention`,
      detail: `Last provider error: ${snapshot.lastError}`,
      actionLabel: 'Review settings',
      capabilities,
    };
  }

  return {
    kind: snapshot.kind,
    providerName: snapshot.providerName,
    state,
    headline:
      snapshot.kind === 'ai'
        ? `${snapshot.providerName} AI is ready`
        : `${snapshot.providerName} speech is ready`,
    detail: describeConfiguredProvider(snapshot),
    actionLabel: 'Manage settings',
    capabilities,
  };
}

export function buildLearningCapabilities(
  aiSnapshot: ProviderSettingsSnapshot,
  speechSnapshot: ProviderSettingsSnapshot
): LearningCapabilities {
  const aiStatus = describeProviderStatus(aiSnapshot);
  const speechStatus = describeProviderStatus(speechSnapshot);
  const fallbackReasons: string[] = [];

  if (!aiStatus.capabilities.canGenerateTutorResponses) {
    fallbackReasons.push('AI tutor needs OpenRouter settings.');
  }

  if (!speechStatus.capabilities.canTranscribeSpeech) {
    fallbackReasons.push('Voice input needs Deepgram settings.');
  }

  return {
    aiTutorAvailable: aiStatus.capabilities.canGenerateTutorResponses,
    activityGenerationAvailable: aiStatus.capabilities.canGenerateActivities,
    writingEvaluationAvailable: aiStatus.capabilities.canEvaluateWriting,
    voiceInputAvailable: speechStatus.capabilities.canTranscribeSpeech,
    textConversationAvailable: true,
    fallbackReasons,
  };
}

function getProviderState(snapshot: ProviderSettingsSnapshot): ProviderState {
  if (!snapshot.enabled || !snapshot.configured) {
    return 'disabled';
  }

  if (snapshot.lastError) {
    return 'error';
  }

  return 'configured';
}

function getProviderCapabilities(
  snapshot: ProviderSettingsSnapshot,
  state: ProviderState
): ProviderCapabilities {
  const active = state === 'configured';

  return {
    canGenerateTutorResponses: active && snapshot.kind === 'ai',
    canGenerateActivities: active && snapshot.kind === 'ai',
    canEvaluateWriting: active && snapshot.kind === 'ai',
    canTranscribeSpeech: active && snapshot.kind === 'speech',
  };
}

function describeConfiguredProvider(snapshot: ProviderSettingsSnapshot): string {
  const parts = [snapshot.model, snapshot.language].filter(Boolean);

  if (parts.length === 0) {
    return `${snapshot.providerName} is configured.`;
  }

  return `${snapshot.providerName} is configured with ${parts.join(' / ')}.`;
}
