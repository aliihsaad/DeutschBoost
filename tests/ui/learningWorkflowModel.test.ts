import { describe, expect, it } from 'vitest';
import { CEFRLevel, type LearningPlanItem } from '../../types';
import {
  buildDailyLearningQueue,
  type DailyLearningQueueInput,
} from '../../src/ui/learningWorkflowModel';

const planItem: LearningPlanItem = {
  id: 'plan-grammar-1',
  topic: 'Akkusativ articles',
  skill: 'Grammar',
  description: 'Practice definite and indefinite articles in Akkusativ.',
  completed: false,
};

function createQueueInput(): DailyLearningQueueInput {
  return {
    level: CEFRLevel.A2,
    targetLevel: CEFRLevel.B1,
    dailyTargetMinutes: 25,
    dueReviews: [
      {
        id: 'review-1',
        title: 'der, die, das corrections',
        skill: 'Grammar',
        level: CEFRLevel.A1,
        dueAt: '2026-05-15T08:00:00.000Z',
        priority: 1,
      },
    ],
    activePlanItems: [planItem],
    weakAreas: [
      {
        id: 'weak-speaking-1',
        skill: 'Speaking',
        topic: 'Ordering food',
        level: CEFRLevel.A2,
        score: 54,
        reason: 'Recent speaking sessions show missing verb-second word order.',
      },
    ],
    preferences: {
      includeConversation: true,
      includeWriting: true,
      examGoal: 'Goethe B1',
    },
  };
}

describe('learningWorkflowModel queue', () => {
  it('orders due reviews before plan work and weak-area practice', () => {
    const queue = buildDailyLearningQueue(createQueueInput());

    expect(queue.map(item => item.source)).toEqual([
      'review',
      'plan',
      'weak-area',
      'conversation',
      'writing',
      'exam',
    ]);
  });

  it('creates learner-facing reasons for each queue item', () => {
    const queue = buildDailyLearningQueue(createQueueInput());

    expect(queue[0]).toMatchObject({
      title: 'Review: der, die, das corrections',
      route: '/review',
      reason: 'Due now from your saved corrections.',
    });
    expect(queue[1]).toMatchObject({
      title: 'Akkusativ articles',
      route: '/practice',
      reason: 'Next item from your A2 to B1 plan.',
    });
    expect(queue[2].reason).toContain('Recent speaking sessions');
  });

  it('omits optional conversation, writing, and exam items when disabled', () => {
    const queue = buildDailyLearningQueue({
      ...createQueueInput(),
      preferences: {
        includeConversation: false,
        includeWriting: false,
      },
    });

    expect(queue.map(item => item.source)).toEqual(['review', 'plan', 'weak-area']);
  });

  it('limits the queue to the daily target without dropping due reviews', () => {
    const queue = buildDailyLearningQueue({
      ...createQueueInput(),
      dailyTargetMinutes: 10,
    });

    expect(queue.map(item => item.source)).toEqual(['review', 'plan']);
    expect(queue.reduce((minutes, item) => minutes + item.estimatedMinutes, 0)).toBe(18);
  });
});
