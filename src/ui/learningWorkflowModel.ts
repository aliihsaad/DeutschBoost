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

export type ActivitySessionState = 'prepare' | 'active' | 'feedback' | 'saving-memory' | 'complete';

export interface ActivitySessionModel {
  id: string;
  activityType: ActivityType;
  topic: string;
  level: CEFRLevel;
  state: ActivitySessionState;
  startedAt?: string;
  result?: ActivityResult;
  savedEffects: LearningMemoryEffect[];
}

export type ActivitySessionEvent =
  | { type: 'start' }
  | { type: 'submit-result'; result: ActivityResult }
  | { type: 'save-memory' }
  | { type: 'finish' };

export type LearningMemoryEffectType =
  | 'mistake-note'
  | 'vocabulary-card'
  | 'review-card'
  | 'writing-revision';

export interface LearningMemoryEffect {
  id: string;
  type: LearningMemoryEffectType;
  title: string;
  skill: SkillType;
  reviewPrompt: string;
  reviewAnswer: string;
  explanation: string;
}

interface ActivityCorrection {
  id: string;
  skill: SkillType;
  original: string;
  corrected: string;
  explanation: string;
}

interface ActivityVocabularyCapture {
  id: string;
  german: string;
  translation: string;
  example: string;
}

interface ActivityResultData {
  corrections?: ActivityCorrection[];
  vocabulary?: ActivityVocabularyCapture[];
  corrected_text?: string;
}

export function createActivitySession(input: {
  id: string;
  activityType: ActivityType;
  topic: string;
  level: CEFRLevel;
  startedAt?: string;
}): ActivitySessionModel {
  return {
    id: input.id,
    activityType: input.activityType,
    topic: input.topic,
    level: input.level,
    state: 'prepare',
    startedAt: input.startedAt,
    savedEffects: [],
  };
}

export function advanceActivitySession(
  session: ActivitySessionModel,
  event: ActivitySessionEvent
): ActivitySessionModel {
  if (event.type === 'start' && session.state === 'prepare') {
    return {
      ...session,
      state: 'active',
      startedAt: session.startedAt ?? new Date().toISOString(),
    };
  }

  if (event.type === 'submit-result' && session.state === 'active') {
    return {
      ...session,
      state: 'feedback',
      result: event.result,
    };
  }

  if (event.type === 'save-memory' && session.state === 'feedback') {
    return {
      ...session,
      state: 'saving-memory',
      savedEffects: session.result ? createLearningMemoryEffects(session.result) : [],
    };
  }

  if (event.type === 'finish' && session.state === 'saving-memory') {
    return {
      ...session,
      state: 'complete',
    };
  }

  throw new Error(`Cannot ${event.type.replace('-', ' ')} activity session from ${session.state}`);
}

export function createLearningMemoryEffects(result: ActivityResult): LearningMemoryEffect[] {
  const data = (result.data ?? {}) as ActivityResultData;
  const effects: LearningMemoryEffect[] = [];

  for (const correction of data.corrections ?? []) {
    effects.push({
      id: `mistake-${correction.id}`,
      type: 'mistake-note',
      title: `${correction.skill} correction`,
      skill: correction.skill,
      reviewPrompt: correction.original,
      reviewAnswer: correction.corrected,
      explanation: correction.explanation,
    });
  }

  for (const vocabulary of data.vocabulary ?? []) {
    effects.push({
      id: `vocabulary-${vocabulary.id}`,
      type: 'vocabulary-card',
      title: vocabulary.german,
      skill: 'Vocabulary',
      reviewPrompt: vocabulary.german,
      reviewAnswer: vocabulary.translation,
      explanation: vocabulary.example,
    });
  }

  if (result.activity_type === 'writing' && data.corrected_text) {
    effects.push({
      id: 'writing-revision-writing',
      type: 'writing-revision',
      title: 'Saved writing revision',
      skill: 'Writing',
      reviewPrompt: 'Review the corrected version of your writing.',
      reviewAnswer: data.corrected_text,
      explanation: 'Saved from writing feedback.',
    });
  }

  if (result.score < 80) {
    const skill = activityTypeToSkill(result.activity_type);
    effects.push({
      id: `review-${result.activity_type}-${result.score}`,
      type: 'review-card',
      title: `Review ${result.activity_type} score ${result.score}%`,
      skill,
      reviewPrompt: `Practice the corrections from this ${result.activity_type} session.`,
      reviewAnswer: 'Open the saved feedback and rewrite the answer.',
      explanation: 'Scores below 80% return to review.',
    });
  }

  return effects;
}

function activityTypeToSkill(activityType: ActivityType): SkillType {
  const map: Record<ActivityType, SkillType> = {
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    listening: 'Listening',
    writing: 'Writing',
    speaking: 'Speaking',
    reading: 'Reading',
  };

  return map[activityType];
}
