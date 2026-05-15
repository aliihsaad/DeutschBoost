import { describe, expect, it } from 'vitest';
import { CEFRLevel, type LearningPlanItem } from '../../types';
import {
  advanceActivitySession,
  buildDailyLearningQueue,
  createActivitySession,
  createLearningMemoryEffects,
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

describe('learningWorkflowModel activity sessions', () => {
  it('moves through prepare, active, feedback, saving-memory, and complete states', () => {
    const session = createActivitySession({
      id: 'session-1',
      activityType: 'grammar',
      topic: 'Akkusativ articles',
      level: CEFRLevel.A2,
      startedAt: '2026-05-15T09:00:00.000Z',
    });

    const active = advanceActivitySession(session, { type: 'start' });
    const feedback = advanceActivitySession(active, {
      type: 'submit-result',
      result: {
        activity_type: 'grammar',
        score: 68,
        completed: true,
        time_spent_seconds: 420,
        data: {
          corrections: [
            {
              id: 'correction-1',
              skill: 'Grammar',
              original: 'Ich sehe der Mann.',
              corrected: 'Ich sehe den Mann.',
              explanation: 'Akkusativ masculine changes der to den.',
            },
          ],
        },
      },
    });
    const saving = advanceActivitySession(feedback, { type: 'save-memory' });
    const complete = advanceActivitySession(saving, { type: 'finish' });

    expect(session.state).toBe('prepare');
    expect(active.state).toBe('active');
    expect(feedback.state).toBe('feedback');
    expect(saving.state).toBe('saving-memory');
    expect(complete.state).toBe('complete');
    expect(complete.savedEffects.map(effect => effect.type)).toEqual(['mistake-note', 'review-card']);
  });

  it('throws a clear error for invalid session transitions', () => {
    const session = createActivitySession({
      id: 'session-2',
      activityType: 'writing',
      topic: 'Daily routine',
      level: CEFRLevel.A2,
    });

    expect(() => advanceActivitySession(session, { type: 'finish' })).toThrow(
      'Cannot finish activity session from prepare'
    );
  });

  it('converts corrections, vocabulary, and writing revisions into learning-memory effects', () => {
    const effects = createLearningMemoryEffects({
      activity_type: 'writing',
      score: 72,
      completed: true,
      time_spent_seconds: 600,
      data: {
        corrected_text: 'Ich gehe jeden Morgen zur Arbeit.',
        corrections: [
          {
            id: 'correction-2',
            skill: 'Writing',
            original: 'Ich gehe jede Morgen zu Arbeit.',
            corrected: 'Ich gehe jeden Morgen zur Arbeit.',
            explanation: 'Use accusative jeden Morgen and contraction zur.',
          },
        ],
        vocabulary: [
          {
            id: 'vocab-1',
            german: 'zur Arbeit',
            translation: 'to work',
            example: 'Ich fahre zur Arbeit.',
          },
        ],
      },
    });

    expect(effects).toEqual([
      {
        id: 'mistake-correction-2',
        type: 'mistake-note',
        title: 'Writing correction',
        skill: 'Writing',
        reviewPrompt: 'Ich gehe jede Morgen zu Arbeit.',
        reviewAnswer: 'Ich gehe jeden Morgen zur Arbeit.',
        explanation: 'Use accusative jeden Morgen and contraction zur.',
      },
      {
        id: 'vocabulary-vocab-1',
        type: 'vocabulary-card',
        title: 'zur Arbeit',
        skill: 'Vocabulary',
        reviewPrompt: 'zur Arbeit',
        reviewAnswer: 'to work',
        explanation: 'Ich fahre zur Arbeit.',
      },
      {
        id: 'writing-revision-writing',
        type: 'writing-revision',
        title: 'Saved writing revision',
        skill: 'Writing',
        reviewPrompt: 'Review the corrected version of your writing.',
        reviewAnswer: 'Ich gehe jeden Morgen zur Arbeit.',
        explanation: 'Saved from writing feedback.',
      },
      {
        id: 'review-writing-72',
        type: 'review-card',
        title: 'Review writing score 72%',
        skill: 'Writing',
        reviewPrompt: 'Practice the corrections from this writing session.',
        reviewAnswer: 'Open the saved feedback and rewrite the answer.',
        explanation: 'Scores below 80% return to review.',
      },
    ]);
  });
});
