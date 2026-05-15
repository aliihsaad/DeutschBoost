import { describe, expect, it, vi } from 'vitest';
import { CEFRLevel, type LearningPlan } from '../../../types';
import {
  DEFAULT_LEARNING_PLAN_STORAGE_KEY,
  createStorageLearningPlanRepository,
  type LearningPlanStorage,
} from '../../../src/domain/learning/learningPlanRepository';

function createMemoryStorage(initial: Record<string, string> = {}): LearningPlanStorage {
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

const learningPlan: LearningPlan = {
  level: CEFRLevel.B1,
  goals: ['Use correct word order', 'Build everyday vocabulary'],
  weeks: [
    {
      week: 1,
      focus: 'Sentence structure',
      items: [
        {
          topic: 'Verb second',
          skill: 'Grammar',
          description: 'Practice main-clause verb placement.',
          completed: false,
        },
        {
          topic: 'Daily phrases',
          skill: 'Vocabulary',
          description: 'Activate common phrases in short answers.',
          completed: false,
        },
      ],
    },
  ],
};

function createRepository(storage = createMemoryStorage()) {
  return createStorageLearningPlanRepository({
    storage,
    now: () => '2026-05-15T12:00:00.000Z',
    idFactory: () => 'plan-1',
    itemIdFactory: (planId, week, index) => `${planId}-w${week}-i${index}`,
    placementIdFactory: () => 'placement-1',
  });
}

describe('learningPlanRepository', () => {
  it('loads null when no active local plan exists', async () => {
    const storage = createMemoryStorage();
    const repository = createRepository(storage);

    await expect(repository.loadActive('local-learner')).resolves.toBeNull();
    expect(storage.getItem).toHaveBeenCalledWith(DEFAULT_LEARNING_PLAN_STORAGE_KEY);
  });

  it('saves and reloads an active local learning plan with generated item ids', async () => {
    const storage = createMemoryStorage();
    const repository = createRepository(storage);

    const saved = await repository.save({
      learnerId: 'local-learner',
      plan: learningPlan,
      placementResultId: 'placement-1',
    });

    expect(saved.planId).toBe('plan-1');
    expect(saved.plan.weeks[0]?.items.map(item => item.id)).toEqual([
      'plan-1-w1-i0',
      'plan-1-w1-i1',
    ]);
    await expect(repository.loadActive('local-learner')).resolves.toEqual(saved.plan);
  });

  it('replaces the active plan for the same learner when a new plan is saved', async () => {
    let planCounter = 0;
    const repository = createStorageLearningPlanRepository({
      storage: createMemoryStorage(),
      now: () => '2026-05-15T12:00:00.000Z',
      idFactory: () => `plan-${++planCounter}`,
      itemIdFactory: (planId, week, index) => `${planId}-w${week}-i${index}`,
      placementIdFactory: () => 'placement-1',
    });

    await repository.save({ learnerId: 'local-learner', plan: learningPlan });
    const secondPlan = {
      ...learningPlan,
      level: CEFRLevel.B2,
      goals: ['Discuss opinions clearly'],
    };
    await repository.save({ learnerId: 'local-learner', plan: secondPlan });

    await expect(repository.loadActive('local-learner')).resolves.toMatchObject({
      level: CEFRLevel.B2,
      goals: ['Discuss opinions clearly'],
    });
  });

  it('marks a local plan item as complete', async () => {
    const repository = createRepository();
    await repository.save({ learnerId: 'local-learner', plan: learningPlan });

    await repository.markItemCompletion({
      learnerId: 'local-learner',
      itemId: 'plan-1-w1-i0',
      completed: true,
      completedAt: '2026-05-15T12:10:00.000Z',
    });

    const active = await repository.loadActive('local-learner');
    expect(active?.weeks[0]?.items[0]).toMatchObject({
      id: 'plan-1-w1-i0',
      completed: true,
    });
  });

  it('records a local placement result', async () => {
    const repository = createRepository();

    const result = await repository.recordPlacementResult('local-learner', {
      level: CEFRLevel.A2,
      strengths: ['Understands short texts'],
      weaknesses: ['Dative endings'],
      recommendations: 'Practice short daily dialogs.',
    });

    expect(result).toEqual({
      id: 'placement-1',
      learnerId: 'local-learner',
      completedAt: '2026-05-15T12:00:00.000Z',
      level: CEFRLevel.A2,
      strengths: ['Understands short texts'],
      weaknesses: ['Dative endings'],
      recommendations: 'Practice short daily dialogs.',
    });
  });

  it('clears corrupt local learning-plan storage and starts empty', async () => {
    const storage = createMemoryStorage({
      [DEFAULT_LEARNING_PLAN_STORAGE_KEY]: '{bad json',
    });
    const repository = createRepository(storage);

    await expect(repository.loadActive('local-learner')).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(DEFAULT_LEARNING_PLAN_STORAGE_KEY);
  });
});
