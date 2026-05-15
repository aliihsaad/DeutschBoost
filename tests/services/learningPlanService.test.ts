import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CEFRLevel, type LearningPlan } from '../../types';
import { createDefaultLearnerProfile } from '../../src/domain/profile/profileRepository';

const learningPlanRepository = vi.hoisted(() => ({
  loadActive: vi.fn(),
  save: vi.fn(),
  markItemCompletion: vi.fn(),
  recordPlacementResult: vi.fn(),
}));

const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  updateProfile: vi.fn(),
  resetProfile: vi.fn(),
}));

vi.mock('../../src/infrastructure/browser/learningPlanStorage', () => ({
  browserLearningPlanRepository: learningPlanRepository,
}));

vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

const validPlan: LearningPlan = {
  level: CEFRLevel.B1,
  goals: ['Use verb-second word order'],
  weeks: [
    {
      week: 1,
      focus: 'Word order',
      items: [
        {
          topic: 'Main clauses',
          skill: 'Grammar',
          description: 'Practice verb position.',
          completed: false,
        },
      ],
    },
  ],
};

describe('learningPlanService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    learningPlanRepository.save.mockResolvedValue({ planId: 'plan-123', plan: validPlan });
    learningPlanRepository.loadActive.mockResolvedValue(validPlan);
    learningPlanRepository.markItemCompletion.mockResolvedValue(undefined);
    learningPlanRepository.recordPlacementResult.mockResolvedValue({
      id: 'placement-123',
      learnerId: 'local-learner',
      completedAt: '2026-05-15T12:00:00.000Z',
      level: CEFRLevel.A2,
      strengths: ['Reading'],
      weaknesses: ['Dative'],
      recommendations: 'Practice daily dialogs.',
    });
  });

  describe('saveLearningPlan', () => {
    it('validates plan has weeks before writing local storage', async () => {
      const { saveLearningPlan } = await import('../../services/learningPlanService');

      const result = await saveLearningPlan('local-learner', {
        level: CEFRLevel.A2,
        goals: ['Test goal'],
        weeks: [],
      });

      expect(result.error?.message).toContain('no weeks');
      expect(learningPlanRepository.save).not.toHaveBeenCalled();
    });

    it('validates plan has items before writing local storage', async () => {
      const { saveLearningPlan } = await import('../../services/learningPlanService');

      const result = await saveLearningPlan('local-learner', {
        level: CEFRLevel.A2,
        goals: ['Test goal'],
        weeks: [{ week: 1, focus: 'Test', items: [] }],
      });

      expect(result.error?.message).toContain('empty');
      expect(learningPlanRepository.save).not.toHaveBeenCalled();
    });

    it('normalizes skill names and saves through the local repository', async () => {
      const { saveLearningPlan } = await import('../../services/learningPlanService');
      const planWithLowercaseSkill: LearningPlan = {
        ...validPlan,
        weeks: [
          {
            ...validPlan.weeks[0]!,
            items: [
              {
                topic: 'Main clauses',
                skill: 'grammar' as LearningPlan['weeks'][number]['items'][number]['skill'],
                description: 'Practice verb position.',
                completed: false,
              },
            ],
          },
        ],
      };

      const result = await saveLearningPlan('local-learner', planWithLowercaseSkill, 'placement-123');

      expect(result).toEqual({ error: null, planId: 'plan-123' });
      expect(learningPlanRepository.save).toHaveBeenCalledWith({
        learnerId: 'local-learner',
        placementResultId: 'placement-123',
        plan: expect.objectContaining({
          weeks: [
            expect.objectContaining({
              items: [
                expect.objectContaining({
                  skill: 'Grammar',
                }),
              ],
            }),
          ],
        }),
      });
    });
  });

  it('loads the active local learning plan', async () => {
    const { loadActiveLearningPlan } = await import('../../services/learningPlanService');

    await expect(loadActiveLearningPlan('local-learner')).resolves.toEqual({
      plan: validPlan,
      error: null,
    });
    expect(learningPlanRepository.loadActive).toHaveBeenCalledWith('local-learner');
  });

  it('updates local plan item completion', async () => {
    const { updatePlanItemCompletion } = await import('../../services/learningPlanService');

    await expect(updatePlanItemCompletion('local-learner', 'item-1', true)).resolves.toEqual({
      error: null,
    });
    expect(learningPlanRepository.markItemCompletion).toHaveBeenCalledWith({
      learnerId: 'local-learner',
      itemId: 'item-1',
      completed: true,
      completedAt: expect.any(String),
    });
  });

  it('records local placement results', async () => {
    const { recordPlacementResult } = await import('../../services/learningPlanService');
    const result = {
      level: CEFRLevel.A2,
      strengths: ['Reading'],
      weaknesses: ['Dative'],
      recommendations: 'Practice daily dialogs.',
    };

    await expect(recordPlacementResult('local-learner', result)).resolves.toEqual({
      result: expect.objectContaining({ id: 'placement-123', level: CEFRLevel.A2 }),
      error: null,
    });
    expect(learningPlanRepository.recordPlacementResult).toHaveBeenCalledWith('local-learner', result);
  });

  it('updates local profile progress with study streak and total minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    profileRepository.updateProfile.mockImplementation(async (updater: ReturnType<typeof vi.fn>) =>
      updater(createDefaultLearnerProfile('2026-05-15T10:00:00.000Z'))
    );
    const { updateUserProgress } = await import('../../services/learningPlanService');

    const result = await updateUserProgress('local-learner', 'grammar', 125, 1);

    expect(result).toEqual({
      error: null,
      profile: expect.objectContaining({
        studyStreak: 1,
        totalStudyTimeMinutes: 2,
        lastStudyDate: '2026-05-15',
      }),
    });
    expect(profileRepository.updateProfile).toHaveBeenCalledWith(expect.any(Function));
  });
});
