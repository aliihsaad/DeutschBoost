import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultLocalProviderSettings,
  type LocalProviderSettings,
} from '../../src/domain/settings/providerSettings';
import { createLocalProviderRuntime } from '../../src/application/providerRuntime';

describe('providerRuntime', () => {
  it('does not create runtime providers from disabled local settings', () => {
    const runtime = createLocalProviderRuntime(createDefaultLocalProviderSettings());

    expect(runtime.aiProvider).toBeNull();
    expect(runtime.speechProvider).toBeNull();
    expect(runtime.snapshots.ai.configured).toBe(false);
    expect(runtime.snapshots.speech.configured).toBe(false);
  });

  it('materializes OpenRouter and Deepgram providers from saved local settings', () => {
    const settings: LocalProviderSettings = {
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
      },
    };

    const runtime = createLocalProviderRuntime(settings, {
      fetchFn: vi.fn(),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    expect(runtime.aiProvider?.id).toBe('openrouter');
    expect(runtime.speechProvider?.id).toBe('deepgram');
    expect(runtime.snapshots.ai.configured).toBe(true);
    expect(runtime.snapshots.speech.configured).toBe(true);
  });
});
