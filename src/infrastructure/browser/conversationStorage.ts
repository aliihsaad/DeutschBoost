import type {
  ConversationFeedbackRecord,
  ConversationRepository,
  ConversationSessionRecord,
} from '../../domain/conversation/conversationRepository';
import type { TranscriptTurn } from '../../domain/speech/transcriptTypes';
import type { LearnerId } from '../../domain/learning/types';
import type { KeyValueStorage } from '../../domain/storage/keyValueStorage';
import {
  createBrowserKeyValueStorage,
  type BrowserStorageLike,
} from '../platform/keyValueStorage';

export type ConversationStorage = KeyValueStorage;

interface ConversationStore {
  sessions: ConversationSessionRecord[];
}

interface StorageConversationRepositoryOptions {
  storage?: ConversationStorage;
  storageKey?: string;
  idFactory?: () => string;
}

export const DEFAULT_CONVERSATION_STORAGE_KEY = 'deutschboost.local.conversations.v1';

export function createStorageConversationRepository(
  options: StorageConversationRepositoryOptions = {}
): ConversationRepository {
  const storage = options.storage ?? getDefaultStorage();
  const storageKey = options.storageKey ?? DEFAULT_CONVERSATION_STORAGE_KEY;
  const idFactory = options.idFactory ?? createConversationSessionId;

  const loadStore = (): Promise<ConversationStore> => readConversationStore(storage, storageKey);
  const saveStore = async (store: ConversationStore): Promise<void> => {
    await storage.setItem(storageKey, JSON.stringify(store));
  };

  return {
    async startSession(input) {
      const store = await loadStore();
      const id = idFactory();
      store.sessions.unshift({
        id,
        learnerId: input.learnerId,
        mode: input.mode,
        startedAt: input.startedAt,
        transcript: [],
      });
      await saveStore(store);
      return id;
    },

    async appendTranscript(sessionId: string, turn: TranscriptTurn) {
      const store = await loadStore();
      const session = findSession(store, sessionId);
      session.transcript = [...session.transcript, turn];
      await saveStore(store);
    },

    async endSession(session: ConversationSessionRecord) {
      const store = await loadStore();
      const existingIndex = store.sessions.findIndex(item => item.id === session.id);

      if (existingIndex >= 0) {
        store.sessions[existingIndex] = session;
      } else {
        store.sessions.unshift(session);
      }

      await saveStore(store);
    },

    async loadRecentSessions(learnerId: LearnerId, limit: number) {
      return (await loadStore()).sessions
        .filter(session => session.learnerId === learnerId)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
        .slice(0, limit);
    },

    async loadLastFeedback(learnerId: LearnerId): Promise<ConversationFeedbackRecord | null> {
      const session = (await loadStore()).sessions
        .filter(item => item.learnerId === learnerId && item.feedback)
        .sort((left, right) => {
          const rightDate = right.endedAt ?? right.startedAt;
          const leftDate = left.endedAt ?? left.startedAt;
          return rightDate.localeCompare(leftDate);
        })[0];

      return session?.feedback ?? null;
    },
  };
}

export const browserConversationRepository = createStorageConversationRepository();

export function createBrowserConversationStorage(
  storage?: BrowserStorageLike | null
): ConversationStorage {
  return createBrowserKeyValueStorage(storage);
}

async function readConversationStore(
  storage: ConversationStorage,
  storageKey: string
): Promise<ConversationStore> {
  const raw = await storage.getItem(storageKey);

  if (!raw) {
    return { sessions: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ConversationStore>;
    return Array.isArray(parsed.sessions) ? { sessions: parsed.sessions } : { sessions: [] };
  } catch {
    return { sessions: [] };
  }
}

function findSession(store: ConversationStore, sessionId: string): ConversationSessionRecord {
  const session = store.sessions.find(item => item.id === sessionId);

  if (!session) {
    throw new Error(`Conversation session not found: ${sessionId}`);
  }

  return session;
}

function createConversationSessionId(): string {
  return `local-conversation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultStorage(): ConversationStorage {
  return createBrowserConversationStorage();
}
