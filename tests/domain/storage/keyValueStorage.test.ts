import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStorage } from '../../../src/domain/storage/keyValueStorage';

describe('createMemoryKeyValueStorage', () => {
  it('stores and removes string values with non-durable metadata', async () => {
    const storage = createMemoryKeyValueStorage();

    await expect(storage.getItem('profile')).resolves.toBeNull();

    await storage.setItem('profile', 'stored-value');
    await expect(storage.getItem('profile')).resolves.toBe('stored-value');

    await storage.removeItem('profile');
    await expect(storage.getItem('profile')).resolves.toBeNull();
    expect(storage.runtime).toBe('memory');
    expect(storage.durability).toBe('ephemeral');
  });

  it('keeps each memory storage instance isolated', async () => {
    const first = createMemoryKeyValueStorage({ profile: 'first' });
    const second = createMemoryKeyValueStorage({ profile: 'second' });

    await first.setItem('profile', 'updated-first');

    await expect(first.getItem('profile')).resolves.toBe('updated-first');
    await expect(second.getItem('profile')).resolves.toBe('second');
  });
});
