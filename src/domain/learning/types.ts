import type {
  CEFRLevel,
  LearningPlan,
  LearningPlanItem,
  TestResult,
} from '@/types';

export type {
  CEFRLevel,
  LearningPlan,
  LearningPlanItem,
  TestResult,
} from '@/types';

export type LearnerId = string;
export type LearningPlanId = string;
export type LearningPlanItemId = string;
export type PlacementResultId = string;

export interface SaveLearningPlanInput {
  learnerId: LearnerId;
  plan: LearningPlan;
  placementResultId?: PlacementResultId;
}

export interface SavedLearningPlan {
  planId: LearningPlanId;
  plan: LearningPlan;
}

export interface PlacementResultRecord extends TestResult {
  id: PlacementResultId;
  learnerId: LearnerId;
  completedAt: string;
  level: CEFRLevel;
}

export interface LearningPlanItemCompletion {
  learnerId: LearnerId;
  itemId: LearningPlanItemId;
  completed: boolean;
  completedAt?: string;
  item?: LearningPlanItem;
}
