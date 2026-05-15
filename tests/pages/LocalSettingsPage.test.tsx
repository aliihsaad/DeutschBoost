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
    expect(screen.getByRole('combobox', { name: 'OpenRouter model' })).toHaveValue('openrouter/auto');
    expect(screen.getByRole('combobox', { name: 'Deepgram model' })).toHaveValue('nova-3');
    expect(screen.getByRole('combobox', { name: 'Deepgram language' })).toHaveValue('de');
    expect(screen.queryByRole('textbox', { name: 'Deepgram language' })).not.toBeInTheDocument();
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
          language: 'de',
        }),
      });
    });
    expect(screen.getByText('Settings saved locally')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter AI is ready')).toBeInTheDocument();
    expect(screen.getByText('Deepgram speech is ready')).toBeInTheDocument();
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
        speech: expect.objectContaining({ enabled: false, model: 'nova-3', language: 'de' }),
      });
    });
    expect(screen.getByText('Settings reset')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenRouter API key')).toHaveValue('');
  });
});
