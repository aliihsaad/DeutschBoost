import type {
  LearnerId,
  LearningPlan,
  LearningPlanItemCompletion,
  PlacementResultRecord,
  SaveLearningPlanInput,
  SavedLearningPlan,
  TestResult,
} from './types';

export interface LearningPlanRepository {
  loadActive(learnerId: LearnerId): Promise<LearningPlan | null>;
  save(input: SaveLearningPlanInput): Promise<SavedLearningPlan>;
  markItemCompletion(input: LearningPlanItemCompletion): Promise<void>;
  recordPlacementResult(learnerId: LearnerId, result: TestResult): Promise<PlacementResultRecord>;
}
