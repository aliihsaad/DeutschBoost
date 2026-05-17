import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocalSettingsPage from '../../pages/LocalSettingsPage';
import { DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY } from '../../src/domain/settings/providerSettingsRepository';
import {
  createStorageProviderSettingsRepository,
  type ProviderSettingsStorage,
} from '../../src/domain/settings/providerSettingsRepository';

function createMemoryStorage(initial: Record<string, string> = {}): ProviderSettingsStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('LocalSettingsPage', () => {
  it('loads local-first provider defaults', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage(),
    });

    render(<LocalSettingsPage repository={repository} />);

    expect(await screen.findByRole('heading', { name: 'Local Settings' })).toBeInTheDocument();
    expect(screen.getByText('OpenRouter AI is off')).toBeInTheDocument();
    expect(screen.getByText('Deepgram voice is off')).toBeInTheDocument();
    expect(screen.getByText('Gemini Live realtime is off')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'OpenRouter model' })).toHaveValue('openrouter/auto');
    expect(screen.getByRole('combobox', { name: 'Deepgram model' })).toHaveValue('nova-3');
    expect(screen.getByRole('combobox', { name: 'Deepgram TTS voice' })).toHaveValue('aura-2-viktoria-de');
    expect(screen.getByRole('combobox', { name: 'Deepgram language' })).toHaveValue('de');
    expect(screen.getByRole('combobox', { name: 'Gemini Live model' })).toHaveValue(
      'gemini-3.1-flash-live-preview'
    );
    expect(screen.getByRole('combobox', { name: 'Gemini Live voice' })).toHaveValue('Kore');
    expect(screen.queryByRole('textbox', { name: 'Deepgram language' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Gemini Live model' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('OpenRouter site URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Deepgram base URL')).not.toBeInTheDocument();
  });

  it('saves OpenRouter and Deepgram settings through the local repository', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage(),
    });
    const onSettingsChange = vi.fn();

    render(<LocalSettingsPage repository={repository} onSettingsChange={onSettingsChange} />);

    await screen.findByRole('heading', { name: 'Local Settings' });

    fireEvent.click(screen.getByLabelText('Enable OpenRouter'));
    fireEvent.change(screen.getByLabelText('OpenRouter API key'), {
      target: { value: 'openrouter-key' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'OpenRouter model' }), {
      target: { value: 'openai/gpt-4o-mini' },
    });
    fireEvent.click(screen.getByLabelText('Enable Deepgram'));
    fireEvent.change(screen.getByLabelText('Deepgram API key'), {
      target: { value: 'deepgram-key' },
    });
    fireEvent.click(screen.getByLabelText('Enable Gemini Live'));
    fireEvent.change(screen.getByLabelText('Gemini Live API key'), {
      target: { value: 'gemini-key' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Gemini Live model' }), {
      target: { value: 'gemini-2.5-flash-live-preview' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({
        ai: expect.objectContaining({
          enabled: true,
          provider: 'openrouter',
          apiKey: 'openrouter-key',
          model: 'openai/gpt-4o-mini',
        }),
        speech: expect.objectContaining({
          enabled: true,
          provider: 'deepgram',
          apiKey: 'deepgram-key',
          model: 'nova-3',
          ttsModel: 'aura-2-viktoria-de',
          language: 'de',
        }),
        live: expect.objectContaining({
          enabled: true,
          provider: 'gemini-live',
          apiKey: 'gemini-key',
          model: 'gemini-2.5-flash-live-preview',
          voiceName: 'Kore',
        }),
      });
    });
    expect(screen.getByText('Settings saved locally')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter AI is ready')).toBeInTheDocument();
    expect(screen.getByText('Deepgram speech is ready')).toBeInTheDocument();
    expect(screen.getByText('Gemini Live realtime is ready')).toBeInTheDocument();
  });

  it('does not render a saved Gemini Live API key as plaintext', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage({
        [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
          ai: {
            enabled: false,
            provider: 'openrouter',
            model: 'openrouter/auto',
          },
          speech: {
            enabled: false,
            provider: 'deepgram',
            model: 'nova-3',
            ttsModel: 'aura-2-viktoria-de',
            language: 'de',
          },
          live: {
            enabled: true,
            provider: 'gemini-live',
            apiKey: 'saved-gemini-key',
            model: 'gemini-3.1-flash-live-preview',
            voiceName: 'Kore',
          },
        }),
      }),
    });

    render(<LocalSettingsPage repository={repository} />);

    await screen.findByText('Gemini Live realtime is ready');

    expect(screen.getByLabelText('Gemini Live API key')).toHaveValue('');
    expect(screen.queryByDisplayValue('saved-gemini-key')).not.toBeInTheDocument();
    expect(screen.getByText('Saved key hidden')).toBeInTheDocument();
  });

  it('does not render saved API keys as plaintext', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage({
        [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
          ai: {
            enabled: true,
            provider: 'openrouter',
            apiKey: 'saved-openrouter-key',
            model: 'openrouter/auto',
          },
          speech: {
            enabled: true,
            provider: 'deepgram',
            apiKey: 'saved-deepgram-key',
            model: 'nova-3',
            ttsModel: 'aura-2-viktoria-de',
            language: 'de',
          },
        }),
      }),
    });

    render(<LocalSettingsPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getAllByText('Saved key hidden')).toHaveLength(2);
    });
    expect(screen.queryByDisplayValue('saved-openrouter-key')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('saved-deepgram-key')).not.toBeInTheDocument();
    expect(screen.getByLabelText('OpenRouter API key')).toHaveValue('');
    expect(screen.getByLabelText('Deepgram API key')).toHaveValue('');
  });

  it('tests a pasted Deepgram API key before saving settings', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage(),
    });
    const deepgramApiKeyTester = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Deepgram API key is valid',
      retryable: false,
      status: 200,
    });

    render(<LocalSettingsPage repository={repository} deepgramApiKeyTester={deepgramApiKeyTester} />);

    await screen.findByRole('heading', { name: 'Local Settings' });
    fireEvent.change(screen.getByLabelText('Deepgram API key'), {
      target: { value: 'deepgram-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test key' }));

    await waitFor(() => {
      expect(deepgramApiKeyTester).toHaveBeenCalledWith('deepgram-key');
    });
    expect(screen.getByText('Deepgram API key is valid')).toBeInTheDocument();
  });

  it('tests the hidden saved Deepgram API key', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage({
        [DEFAULT_PROVIDER_SETTINGS_STORAGE_KEY]: JSON.stringify({
          ai: {
            enabled: false,
            provider: 'openrouter',
            model: 'openrouter/auto',
          },
          speech: {
            enabled: true,
            provider: 'deepgram',
            apiKey: 'saved-deepgram-key',
            model: 'nova-3',
            ttsModel: 'aura-2-viktoria-de',
            language: 'de',
          },
        }),
      }),
    });
    const deepgramApiKeyTester = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Deepgram API key is valid',
      retryable: false,
      status: 200,
    });

    render(<LocalSettingsPage repository={repository} deepgramApiKeyTester={deepgramApiKeyTester} />);

    await screen.findByText('Saved key hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Test key' }));

    await waitFor(() => {
      expect(deepgramApiKeyTester).toHaveBeenCalledWith('saved-deepgram-key');
    });
    expect(screen.queryByDisplayValue('saved-deepgram-key')).not.toBeInTheDocument();
  });

  it('records, plays back, and transcribes a Deepgram test audio sample', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage(),
    });
    const audio = new Blob(['audio-bytes'], { type: 'audio/webm' });
    const deepgramAudioRecorder = vi.fn().mockResolvedValue({
      audio,
      mimeType: 'audio/webm',
      playbackUrl: 'blob:deepgram-test-sample',
    });
    const deepgramAudioTester = vi.fn().mockResolvedValue({
      rawText: 'Hallo, ich lerne Deutsch.',
      transcript: {
        speaker: 'learner',
        text: 'Hallo, ich lerne Deutsch.',
        occurredAt: '2026-05-15T12:00:00.000Z',
        provider: 'deepgram',
      },
    });

    render(
      <LocalSettingsPage
        repository={repository}
        deepgramAudioRecorder={deepgramAudioRecorder}
        deepgramAudioTester={deepgramAudioTester}
      />
    );

    await screen.findByRole('heading', { name: 'Local Settings' });
    fireEvent.change(screen.getByLabelText('Deepgram API key'), {
      target: { value: 'deepgram-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record test audio' }));

    await waitFor(() => {
      expect(deepgramAudioTester).toHaveBeenCalledWith({
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
        audio,
        mimeType: 'audio/webm',
      });
    });
    expect(screen.getByLabelText('Deepgram test sample playback')).toHaveAttribute(
      'src',
      'blob:deepgram-test-sample'
    );
    expect(screen.getByText('Transcript: Hallo, ich lerne Deutsch.')).toBeInTheDocument();
  });

  it('plays a Deepgram TTS sample with the selected voice', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:deepgram-tts-sample'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage(),
    });
    const deepgramTtsTester = vi.fn().mockResolvedValue({
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/mpeg',
      providerMetadata: {
        model: 'aura-2-julius-de',
      },
    });

    render(<LocalSettingsPage repository={repository} deepgramTtsTester={deepgramTtsTester} />);

    await screen.findByRole('heading', { name: 'Local Settings' });
    fireEvent.change(screen.getByLabelText('Deepgram API key'), {
      target: { value: 'deepgram-key' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Deepgram TTS voice' }), {
      target: { value: 'aura-2-julius-de' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play test voice' }));

    await waitFor(() => {
      expect(deepgramTtsTester).toHaveBeenCalledWith({
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-julius-de',
        language: 'de',
        text: 'Hallo. Ich bin deine DeutschBoost Stimme.',
      });
    });
    expect(screen.getByLabelText('Deepgram TTS test playback')).toHaveAttribute(
      'src',
      'blob:deepgram-tts-sample'
    );
    expect(screen.getByText('Deepgram voice sample is ready')).toBeInTheDocument();
  });

  it('resets saved provider settings back to local defaults', async () => {
    const repository = createStorageProviderSettingsRepository({
      storage: createMemoryStorage(),
    });
    const onSettingsChange = vi.fn();

    await repository.save({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openai/gpt-4o-mini',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
    });

    render(<LocalSettingsPage repository={repository} onSettingsChange={onSettingsChange} />);

    await waitFor(() => {
      expect(screen.getAllByText('Saved key hidden')).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({
        ai: expect.objectContaining({ enabled: false, model: 'openrouter/auto' }),
        speech: expect.objectContaining({
          enabled: false,
          model: 'nova-3',
          ttsModel: 'aura-2-viktoria-de',
          language: 'de',
        }),
        live: expect.objectContaining({
          enabled: false,
          model: 'gemini-3.1-flash-live-preview',
          voiceName: 'Kore',
        }),
      });
    });
    expect(screen.getByText('Settings reset')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenRouter API key')).toHaveValue('');
  });
});
