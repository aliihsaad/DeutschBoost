import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LEARNER_PROFILE_STORAGE_KEY,
  createDefaultLearnerProfile,
  createStorageProfileRepository,
  type ProfileStorage,
} from '../../../src/domain/profile/profileRepository';

function createMemoryStorage(initial: Record<string, string> = {}): ProfileStorage {
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

describe('profileRepository', () => {
  it('loads local learner defaults when storage is empty', async () => {
    const repository = createStorageProfileRepository({
      storage: createMemoryStorage(),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    await expect(repository.loadProfile()).resolves.toEqual(
      createDefaultLearnerProfile('2026-05-15T12:00:00.000Z')
    );
  });

  it('saves and reloads a local learner profile', async () => {
    const storage = createMemoryStorage();
    const repository = createStorageProfileRepository({
      storage,
      now: () => '2026-05-15T12:00:00.000Z',
    });

    const saved = await repository.saveProfile({
      ...createDefaultLearnerProfile('2026-05-15T12:00:00.000Z'),
      currentLevel: 'A2',
      targetLevel: 'B1',
      motherLanguage: 'arabic',
      learningFocus: 'exam',
      targetExam: 'goethe-b1',
      dailyGoalMinutes: 45,
      reviewIntensity: 'steady',
      tutorStyle: 'direct',
      voicePreference: 'standard',
    });

    await expect(repository.loadProfile()).resolves.toEqual(saved);
    expect(storage.setItem).toHaveBeenCalledWith(
      DEFAULT_LEARNER_PROFILE_STORAGE_KEY,
      expect.any(String)
    );
  });

  it('normalizes invalid stored profile choices back to list defaults', async () => {
    const repository = createStorageProfileRepository({
      storage: createMemoryStorage({
        [DEFAULT_LEARNER_PROFILE_STORAGE_KEY]: JSON.stringify({
          id: 'local-learner',
          currentLevel: 'free text level',
          targetLevel: 'C3',
          motherLanguage: 'free text language',
          learningFocus: 'anything',
          targetExam: 'private exam',
          dailyGoalMinutes: 999,
          reviewIntensity: 'extreme',
          tutorStyle: 'random',
          voicePreference: 'unknown',
          updatedAt: '2026-05-14T00:00:00.000Z',
        }),
      }),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    await expect(repository.loadProfile()).resolves.toEqual(
      createDefaultLearnerProfile('2026-05-14T00:00:00.000Z')
    );
  });

  it('updates from the latest stored profile and resets to defaults', async () => {
    const repository = createStorageProfileRepository({
      storage: createMemoryStorage(),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    await repository.updateProfile(current => ({
      ...current,
      currentLevel: 'B1',
      dailyGoalMinutes: 60,
    }));

    await expect(repository.loadProfile()).resolves.toMatchObject({
      currentLevel: 'B1',
      dailyGoalMinutes: 60,
    });
    await expect(repository.resetProfile()).resolves.toEqual(
      createDefaultLearnerProfile('2026-05-15T12:00:00.000Z')
    );
  });
});
