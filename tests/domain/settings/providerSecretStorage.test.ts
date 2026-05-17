import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStorage } from '../../../src/domain/storage/keyValueStorage';
import {
  DEFAULT_PROVIDER_SECRETS_STORAGE_KEY,
  createKeyValueProviderSecretStorage,
} from '../../../src/domain/settings/providerSecretStorage';

describe('providerSecretStorage', () => {
  it('saves and reloads provider API keys through key-value storage', async () => {
    const storage = createMemoryKeyValueStorage();
    const secrets = createKeyValueProviderSecretStorage({ storage });

    await secrets.setSecret('ai.apiKey', 'openrouter-key');
    await secrets.setSecret('speech.apiKey', 'deepgram-key');
    await secrets.setSecret('live.apiKey', 'gemini-key');

    await expect(secrets.getSecret('ai.apiKey')).resolves.toBe('openrouter-key');
    await expect(secrets.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');
    await expect(secrets.getSecret('live.apiKey')).resolves.toBe('gemini-key');
    await expect(storage.getItem(DEFAULT_PROVIDER_SECRETS_STORAGE_KEY)).resolves.toBe(
      JSON.stringify({
        'ai.apiKey': 'openrouter-key',
        'speech.apiKey': 'deepgram-key',
        'live.apiKey': 'gemini-key',
      })
    );
  });

  it('removes one provider secret without deleting the others', async () => {
    const storage = createMemoryKeyValueStorage();
    const secrets = createKeyValueProviderSecretStorage({ storage });

    await secrets.setSecret('ai.apiKey', 'openrouter-key');
    await secrets.setSecret('speech.apiKey', 'deepgram-key');
    await secrets.setSecret('live.apiKey', 'gemini-key');
    await secrets.removeSecret('ai.apiKey');

    await expect(secrets.getSecret('ai.apiKey')).resolves.toBeNull();
    await expect(secrets.getSecret('speech.apiKey')).resolves.toBe('deepgram-key');
    await expect(secrets.getSecret('live.apiKey')).resolves.toBe('gemini-key');
  });

  it('clears corrupt provider secret JSON and treats it as empty', async () => {
    const storage = createMemoryKeyValueStorage({
      [DEFAULT_PROVIDER_SECRETS_STORAGE_KEY]: '{not json',
    });
    const secrets = createKeyValueProviderSecretStorage({ storage });

    await expect(secrets.getSecret('ai.apiKey')).resolves.toBeNull();
    await expect(storage.getItem(DEFAULT_PROVIDER_SECRETS_STORAGE_KEY)).resolves.toBeNull();
  });
});
