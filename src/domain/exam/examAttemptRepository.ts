import type { ExamAttempt } from './examTypes';
import type { KeyValueStorage } from '../storage/keyValueStorage';

export const DEFAULT_EXAM_ATTEMPT_STORAGE_KEY = 'deutschboost.examAttempts.v1';

export interface ExamAttemptRepository {
  listAttempts(learnerId: string): Promise<ExamAttempt[]>;
  saveAttempt(attempt: ExamAttempt): Promise<void>;
}

interface ExamAttemptStore {
  attempts: ExamAttempt[];
}

interface StorageExamAttemptRepositoryOptions {
  storage: Pick<KeyValueStorage, 'getItem' | 'setItem' | 'removeItem'>;
  storageKey?: string;
}

export function createStorageExamAttemptRepository(
  options: StorageExamAttemptRepositoryOptions
): ExamAttemptRepository {
  const storageKey = options.storageKey ?? DEFAULT_EXAM_ATTEMPT_STORAGE_KEY;

  const loadStore = () => loadExamAttemptStore(options.storage, storageKey);
  const saveStore = (store: ExamAttemptStore) => options.storage.setItem(storageKey, JSON.stringify(store));

  return {
    async listAttempts(learnerId: string): Promise<ExamAttempt[]> {
      const store = await loadStore();
      return store.attempts
        .filter(attempt => attempt.learnerId === learnerId)
        .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
        .map(cloneAttempt);
    },

    async saveAttempt(attempt: ExamAttempt): Promise<void> {
      const store = await loadStore();
      store.attempts = [
        cloneAttempt(attempt),
        ...store.attempts.filter(storedAttempt => storedAttempt.id !== attempt.id),
      ];
      await saveStore(store);
    },
  };
}

async function loadExamAttemptStore(
  storage: Pick<KeyValueStorage, 'getItem' | 'removeItem'>,
  storageKey: string
): Promise<ExamAttemptStore> {
  const stored = await storage.getItem(storageKey);

  if (!stored) {
    return { attempts: [] };
  }

  try {
    return normalizeStore(JSON.parse(stored));
  } catch {
    await storage.removeItem(storageKey);
    return { attempts: [] };
  }
}

function normalizeStore(value: unknown): ExamAttemptStore {
  const root = asRecord(value);
  const attempts = Array.isArray(root.attempts)
    ? root.attempts.map(normalizeAttempt).filter(isAttempt)
    : [];

  return { attempts };
}

function normalizeAttempt(value: unknown): ExamAttempt | null {
  const root = asRecord(value);
  const id = normalizeString(root.id);
  const learnerId = normalizeString(root.learnerId);
  const examId = normalizeString(root.examId);
  const title = normalizeString(root.title);
  const level = normalizeString(root.level) as ExamAttempt['level'] | undefined;
  const startedAt = normalizeString(root.startedAt);
  const completedAt = normalizeString(root.completedAt);
  const result = asRecord(root.result) as ExamAttempt['result'];
  const answers = asRecord(root.answers) as ExamAttempt['answers'];

  if (!id || !learnerId || !examId || !title || !level || !startedAt || !completedAt || !result || !answers) {
    return null;
  }

  return {
    id,
    learnerId,
    examId,
    title,
    level,
    startedAt,
    completedAt,
    durationSeconds: typeof root.durationSeconds === 'number' ? root.durationSeconds : 0,
    answers,
    result,
  };
}

function cloneAttempt(attempt: ExamAttempt): ExamAttempt {
  return JSON.parse(JSON.stringify(attempt)) as ExamAttempt;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isAttempt(value: ExamAttempt | null): value is ExamAttempt {
  return value !== null;
}
