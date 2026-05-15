import { browserLearningPlanRepository } from '../src/infrastructure/browser/learningPlanStorage';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { LearningPlan, LearningPlanItem, TestResult } from '../types';

type ActivityProgressType =
  | 'conversation'
  | 'flashcards'
  | 'listening'
  | 'reading'
  | 'writing'
  | 'grammar';

const normalizeSkill = (skill: string): LearningPlanItem['skill'] => {
  const skillLower = skill.toLowerCase().trim();
  const skillMap: Record<string, LearningPlanItem['skill']> = {
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    listening: 'Listening',
    writing: 'Writing',
    speaking: 'Speaking',
    reading: 'Reading',
  };

  return skillMap[skillLower] ?? (skill as LearningPlanItem['skill']);
};

export const saveLearningPlan = async (
  userId: string,
  plan: LearningPlan,
  testResultId?: string
): Promise<{ error: Error | null; planId: string | null }> => {
  try {
    const validationError = validateLearningPlan(plan);

    if (validationError) {
      return { error: validationError, planId: null };
    }

    const normalizedPlan = normalizeLearningPlan(plan);
    const saved = await browserLearningPlanRepository.save({
      learnerId: userId,
      plan: normalizedPlan,
      placementResultId: testResultId,
    });

    return { error: null, planId: saved.planId };
  } catch (err) {
    console.error('Unexpected error saving learning plan:', err);
    return { error: err as Error, planId: null };
  }
};

export const loadActiveLearningPlan = async (
  userId: string
): Promise<{ plan: LearningPlan | null; error: Error | null }> => {
  try {
    const plan = await browserLearningPlanRepository.loadActive(userId);
    return { plan, error: null };
  } catch (err) {
    console.error('Unexpected error loading learning plan:', err);
    return { plan: null, error: err as Error };
  }
};

export const updatePlanItemCompletion = async (
  userId: string,
  itemId: string,
  completed: boolean
): Promise<{ error: Error | null }> => {
  try {
    await browserLearningPlanRepository.markItemCompletion({
      learnerId: userId,
      itemId,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    });

    return { error: null };
  } catch (err) {
    console.error('Unexpected error updating plan item:', err);
    return { error: err as Error };
  }
};

export const recordPlacementResult = async (
  userId: string,
  result: TestResult
): Promise<{ result: Awaited<ReturnType<typeof browserLearningPlanRepository.recordPlacementResult>> | null; error: Error | null }> => {
  try {
    const record = await browserLearningPlanRepository.recordPlacementResult(userId, result);
    return { result: record, error: null };
  } catch (err) {
    console.error('Unexpected error recording placement result:', err);
    return { result: null, error: err as Error };
  }
};

export const updateUserProgress = async (
  userId: string,
  activityType: ActivityProgressType,
  durationSeconds: number,
  itemsCompleted: number = 1
): Promise<{ error: Error | null; profile?: any }> => {
  void userId;
  void activityType;
  void itemsCompleted;

  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = getDateOffset(-1);
    const durationMinutes = Math.max(0, Math.round(durationSeconds / 60));
    const updatedProfile = await browserProfileRepository.updateProfile(profile => {
      const lastStudyDate = profile.lastStudyDate;
      const studyStreak =
        lastStudyDate === today
          ? profile.studyStreak
          : lastStudyDate === yesterday
            ? profile.studyStreak + 1
            : 1;

      return {
        ...profile,
        studyStreak,
        totalStudyTimeMinutes: profile.totalStudyTimeMinutes + durationMinutes,
        lastStudyDate: today,
      };
    });

    return {
      error: null,
      profile: updatedProfile,
    };
  } catch (err) {
    console.error('Unexpected error updating user progress:', err);
    return { error: err as Error };
  }
};

function validateLearningPlan(plan: LearningPlan): Error | null {
  if (!plan.weeks || plan.weeks.length === 0) {
    return new Error('Plan has no weeks');
  }

  const hasItems = plan.weeks.some(week => week.items && week.items.length > 0);

  if (!hasItems) {
    return new Error('No plan items to insert - all weeks are empty');
  }

  return null;
}

function normalizeLearningPlan(plan: LearningPlan): LearningPlan {
  return {
    ...plan,
    goals: [...plan.goals],
    weeks: plan.weeks.map(week => ({
      ...week,
      items: week.items.map(item => ({
        ...item,
        skill: normalizeSkill(item.skill),
        completed: item.completed === true,
      })),
    })),
  };
}

function getDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
