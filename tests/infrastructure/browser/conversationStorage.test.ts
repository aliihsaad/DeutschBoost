import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CONVERSATION_STORAGE_KEY,
  createStorageConversationRepository,
  type ConversationStorage,
} from '../../../src/infrastructure/browser/conversationStorage';
import { CEFRLevel, ConversationMode } from '../../../types';

function createMemoryStorage(initial: Record<string, string> = {}): ConversationStorage {
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

describe('createStorageConversationRepository', () => {
  it('starts a local session and appends transcript turns', async () => {
    const storage = createMemoryStorage();
    const repository = createStorageConversationRepository({
      storage,
      idFactory: () => 'local-session-1',
    });

    const sessionId = await repository.startSession({
      learnerId: 'local-learner',
      mode: ConversationMode.FREE_CONVERSATION,
      startedAt: '2026-05-15T15:00:00.000Z',
    });
    await repository.appendTranscript(sessionId, {
      speaker: 'learner',
      text: 'Hallo',
      occurredAt: '2026-05-15T15:00:10.000Z',
      provider: 'deepgram',
    });

    await expect(repository.loadRecentSessions('local-learner', 5)).resolves.toEqual([
      expect.objectContaining({
        id: 'local-session-1',
        learnerId: 'local-learner',
        transcript: [
          {
            speaker: 'learner',
            text: 'Hallo',
            occurredAt: '2026-05-15T15:00:10.000Z',
            provider: 'deepgram',
          },
        ],
      }),
    ]);
    expect(storage.setItem).toHaveBeenCalledWith(
      DEFAULT_CONVERSATION_STORAGE_KEY,
      expect.stringContaining('local-session-1')
    );
  });

  it('ends a session with feedback and returns the latest feedback for the learner', async () => {
    const repository = createStorageConversationRepository({
      storage: createMemoryStorage(),
      idFactory: () => 'local-session-2',
    });

    const sessionId = await repository.startSession({
      learnerId: 'learner-1',
      mode: ConversationMode.SPEAKING_ACTIVITY,
      startedAt: '2026-05-15T15:00:00.000Z',
    });
    await repository.endSession({
      id: sessionId,
      learnerId: 'learner-1',
      mode: ConversationMode.SPEAKING_ACTIVITY,
      startedAt: '2026-05-15T15:00:00.000Z',
      endedAt: '2026-05-15T15:04:00.000Z',
      durationSeconds: 240,
      transcript: [],
      feedback: {
        overallScore: 82,
        strengths: ['Clear answers'],
        areasForImprovement: ['Article endings'],
        grammarCorrections: [],
        vocabularySuggestions: ['gern'],
        fluencyNotes: 'Steady pace',
        encouragement: 'Keep speaking',
        level: CEFRLevel.A2,
        language: 'English',
      },
    });

    await expect(repository.loadLastFeedback('learner-1')).resolves.toEqual(
      expect.objectContaining({
        overallScore: 82,
        level: CEFRLevel.A2,
      })
    );
  });

  it('keeps recent sessions scoped to the learner and sorted newest first', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_CONVERSATION_STORAGE_KEY]: JSON.stringify({
        sessions: [
          {
            id: 'older',
            learnerId: 'learner-1',
            mode: ConversationMode.FREE_CONVERSATION,
            startedAt: '2026-05-15T14:00:00.000Z',
            transcript: [],
          },
          {
            id: 'other-learner',
            learnerId: 'learner-2',
            mode: ConversationMode.FREE_CONVERSATION,
            startedAt: '2026-05-15T16:00:00.000Z',
            transcript: [],
          },
          {
            id: 'newer',
            learnerId: 'learner-1',
            mode: ConversationMode.FREE_CONVERSATION,
            startedAt: '2026-05-15T15:00:00.000Z',
            transcript: [],
          },
        ],
      }),
    });
    const repository = createStorageConversationRepository({ storage });

    await expect(repository.loadRecentSessions('learner-1', 2)).resolves.toMatchObject([
      { id: 'newer' },
      { id: 'older' },
    ]);
  });
});
