import { describe, expect, it } from 'vitest';
import {
  buildLearningCapabilities,
  describeProviderStatus,
  type ProviderSettingsSnapshot,
} from '../../src/ui/providerStatusModel';

describe('providerStatusModel', () => {
  it('marks AI as disabled when no provider key is configured', () => {
    const status = describeProviderStatus({
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: false,
      configured: false,
      model: 'openrouter/auto',
    });

    expect(status.state).toBe('disabled');
    expect(status.headline).toBe('AI tutor is off');
    expect(status.actionLabel).toBe('Configure AI');
    expect(status.capabilities.canGenerateTutorResponses).toBe(false);
  });

  it('marks speech as configured when Deepgram is enabled with a key', () => {
    const status = describeProviderStatus({
      kind: 'speech',
      providerName: 'Deepgram',
      enabled: true,
      configured: true,
      model: 'nova-3',
      language: 'de',
    });

    expect(status.state).toBe('configured');
    expect(status.headline).toBe('Deepgram speech is ready');
    expect(status.detail).toContain('nova-3');
    expect(status.capabilities.canTranscribeSpeech).toBe(true);
  });

  it('keeps the provider visible when the last call failed', () => {
    const status = describeProviderStatus({
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: true,
      configured: true,
      model: 'openrouter/auto',
      lastError: '401 Unauthorized',
    });

    expect(status.state).toBe('error');
    expect(status.headline).toBe('OpenRouter needs attention');
    expect(status.detail).toContain('401 Unauthorized');
    expect(status.actionLabel).toBe('Review settings');
  });

  it('builds learner-facing capability flags from AI and speech states', () => {
    const ai: ProviderSettingsSnapshot = {
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: true,
      configured: true,
      model: 'openrouter/auto',
    };
    const speech: ProviderSettingsSnapshot = {
      kind: 'speech',
      providerName: 'Deepgram',
      enabled: false,
      configured: false,
      model: 'nova-3',
      language: 'de',
    };

    const capabilities = buildLearningCapabilities(ai, speech);

    expect(capabilities.aiTutorAvailable).toBe(true);
    expect(capabilities.voiceInputAvailable).toBe(false);
    expect(capabilities.textConversationAvailable).toBe(true);
    expect(capabilities.fallbackReasons).toEqual(['Voice input needs Deepgram settings.']);
  });
});
