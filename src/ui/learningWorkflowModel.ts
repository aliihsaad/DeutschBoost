import { CEFRLevel, type LearningPlanItem, type SkillType } from '../../types';
import type { ActivityResult, ActivityType } from '../types/activity.types';

export type QueueSource =
  | 'review'
  | 'plan'
  | 'weak-area'
  | 'conversation'
  | 'writing'
  | 'exam';

export interface DueReviewItem {
  id: string;
  title: string;
  skill: SkillType;
  level: CEFRLevel;
  dueAt: string;
  priority: number;
}

export interface WeakAreaItem {
  id: string;
  skill: SkillType;
  topic: string;
  level: CEFRLevel;
  score: number;
  reason: string;
}

export interface DailyLearningPreferences {
  includeConversation: boolean;
  includeWriting: boolean;
  examGoal?: string;
}

export interface DailyLearningQueueInput {
  level: CEFRLevel;
  targetLevel: CEFRLevel;
  dailyTargetMinutes: number;
  dueReviews: DueReviewItem[];
  activePlanItems: LearningPlanItem[];
  weakAreas: WeakAreaItem[];
  preferences: DailyLearningPreferences;
}

export interface DailyLearningQueueItem {
  id: string;
  title: string;
  skill: SkillType | 'Mixed';
  level: CEFRLevel;
  estimatedMinutes: number;
  source: QueueSource;
  reason: string;
  route: string;
  priority: number;
  intent:
    | { type: 'review'; reviewId: string }
    | { type: 'activity'; activityType: ActivityType; planItemId?: string; topic: string }
    | { type: 'conversation'; mode: 'free-talk' | 'roleplay' | 'pronunciation-check' }
    | { type: 'writing'; promptSource: 'daily' }
    | { type: 'exam'; examGoal: string };
  completionEffect: 'review-card' | 'plan-progress' | 'mistake-capture' | 'transcript' | 'writing-revision' | 'exam-report';
}

export function buildDailyLearningQueue(input: DailyLearningQueueInput): DailyLearningQueueItem[] {
  const dueReviewItems = input.dueReviews
    .slice()
    .sort((left, right) => left.priority - right.priority || left.dueAt.localeCompare(right.dueAt))
    .map(mapReviewToQueueItem);

  const planQueueItem = input.activePlanItems.find(item => !item.completed);
  const weakestArea = input.weakAreas.slice().sort((left, right) => left.score - right.score)[0];
  const queue: DailyLearningQueueItem[] = [...dueReviewItems];

  if (planQueueItem) {
    queue.push(mapPlanItemToQueueItem(planQueueItem, input.level, input.targetLevel));
  }

  if (weakestArea) {
    queue.push(mapWeakAreaToQueueItem(weakestArea));
  }

  if (input.preferences.includeConversation) {
    queue.push({
      id: 'conversation-daily',
      title: 'Speak for 5 minutes',
      skill: 'Speaking',
      level: input.level,
      estimatedMinutes: 5,
      source: 'conversation',
      reason: 'Short speaking turns keep active recall fresh.',
      route: '/conversation',
      priority: 40,
      intent: { type: 'conversation', mode: 'free-talk' },
      completionEffect: 'transcript',
    });
  }

  if (input.preferences.includeWriting) {
    queue.push({
      id: 'writing-daily',
      title: 'Write a short answer',
      skill: 'Writing',
      level: input.level,
      estimatedMinutes: 8,
      source: 'writing',
      reason: 'Writing turns passive grammar into production practice.',
      route: '/writing',
      priority: 50,
      intent: { type: 'writing', promptSource: 'daily' },
      completionEffect: 'writing-revision',
    });
  }

  if (input.preferences.examGoal) {
    queue.push({
      id: 'exam-daily',
      title: `${input.preferences.examGoal} exam drill`,
      skill: 'Mixed',
      level: input.level,
      estimatedMinutes: 12,
      source: 'exam',
      reason: `Your goal includes ${input.preferences.examGoal}.`,
      route: '/exam',
      priority: 60,
      intent: { type: 'exam', examGoal: input.preferences.examGoal },
      completionEffect: 'exam-report',
    });
  }

  return limitQueueToDailyTarget(queue, input.dailyTargetMinutes);
}

function mapReviewToQueueItem(review: DueReviewItem): DailyLearningQueueItem {
  return {
    id: `queue-${review.id}`,
    title: `Review: ${review.title}`,
    skill: review.skill,
    level: review.level,
    estimatedMinutes: 6,
    source: 'review',
    reason: 'Due now from your saved corrections.',
    route: '/review',
    priority: review.priority,
    intent: { type: 'review', reviewId: review.id },
    completionEffect: 'review-card',
  };
}

function mapPlanItemToQueueItem(
  item: LearningPlanItem,
  currentLevel: CEFRLevel,
  targetLevel: CEFRLevel
): DailyLearningQueueItem {
  return {
    id: `queue-${item.id ?? item.topic}`,
    title: item.topic,
    skill: item.skill,
    level: currentLevel,
    estimatedMinutes: 12,
    source: 'plan',
    reason: `Next item from your ${currentLevel} to ${targetLevel} plan.`,
    route: '/practice',
    priority: 20,
    intent: {
      type: 'activity',
      activityType: skillToActivityType(item.skill),
      planItemId: item.id,
      topic: item.topic,
    },
    completionEffect: 'plan-progress',
  };
}

function mapWeakAreaToQueueItem(weakArea: WeakAreaItem): DailyLearningQueueItem {
  return {
    id: `queue-${weakArea.id}`,
    title: `${weakArea.topic} repair`,
    skill: weakArea.skill,
    level: weakArea.level,
    estimatedMinutes: 10,
    source: 'weak-area',
    reason: weakArea.reason,
    route: weakArea.skill === 'Speaking' ? '/conversation' : '/practice',
    priority: 30,
    intent:
      weakArea.skill === 'Speaking'
        ? { type: 'conversation', mode: 'pronunciation-check' }
        : {
            type: 'activity',
            activityType: skillToActivityType(weakArea.skill),
            topic: weakArea.topic,
          },
    completionEffect: 'mistake-capture',
  };
}

function limitQueueToDailyTarget(
  queue: DailyLearningQueueItem[],
  dailyTargetMinutes: number
): DailyLearningQueueItem[] {
  if (dailyTargetMinutes >= 20) {
    return queue;
  }

  const requiredReviews = queue.filter(item => item.source === 'review');
  const optionalItems = queue.filter(item => item.source !== 'review');
  const selected = [...requiredReviews];
  let selectedMinutes = selected.reduce((total, item) => total + item.estimatedMinutes, 0);

  for (const item of optionalItems) {
    if (selected.length === requiredReviews.length || selectedMinutes + item.estimatedMinutes <= dailyTargetMinutes) {
      selected.push(item);
      selectedMinutes += item.estimatedMinutes;
    }
  }

  return selected;
}

function skillToActivityType(skill: SkillType): ActivityType {
  const map: Record<SkillType, ActivityType> = {
    Grammar: 'grammar',
    Vocabulary: 'vocabulary',
    Listening: 'listening',
    Writing: 'writing',
    Speaking: 'speaking',
    Reading: 'reading',
  };

  return map[skill];
}
