import { describe, expect, it } from 'vitest';
import { createStorageExamAttemptRepository } from '../../../src/domain/exam/examAttemptRepository';
import { createMemoryKeyValueStorage } from '../../../src/domain/storage/keyValueStorage';
import { CEFRLevel } from '../../../types';

describe('exam attempt repository', () => {
  it('saves exam attempts locally and lists them newest first for the learner', async () => {
    const repository = createStorageExamAttemptRepository({
      storage: createMemoryKeyValueStorage(),
    });

    await repository.saveAttempt(createAttempt('old', '2026-05-17T10:00:00.000Z', 55));
    await repository.saveAttempt(createAttempt('new', '2026-05-18T10:00:00.000Z', 78));
    await repository.saveAttempt({
      ...createAttempt('other', '2026-05-19T10:00:00.000Z', 99),
      learnerId: 'other-learner',
    });

    const attempts = await repository.listAttempts('local-learner');

    expect(attempts.map(attempt => attempt.id)).toEqual(['new', 'old']);
    expect(attempts[0].result.percentage).toBe(78);
  });
});

function createAttempt(id: string, completedAt: string, percentage: number) {
  return {
    id,
    learnerId: 'local-learner',
    examId: 'exam-1',
    title: 'B1 simulated exam',
    level: CEFRLevel.B1,
    startedAt: '2026-05-18T09:00:00.000Z',
    completedAt,
    durationSeconds: 1800,
    answers: { objective: {}, productive: {} },
    result: {
      totalEarnedPoints: percentage,
      totalPossiblePoints: 100,
      percentage,
      passed: percentage >= 60,
      summary: 'Result',
      moduleResults: [],
    },
  };
}
