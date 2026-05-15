import type { CEFRLevel, LearnerId } from '../learning/types';

export interface LearnerProfile {
  id: LearnerId;
  fullName?: string;
  currentLevel: CEFRLevel;
  targetLevel?: CEFRLevel;
  motherLanguage: string;
  dailyGoalMinutes: number;
  studyStreak: number;
  totalStudyTimeMinutes: number;
  updatedAt: string;
}

export interface ProfileRepository {
  loadProfile(): Promise<LearnerProfile | null>;
  saveProfile(profile: LearnerProfile): Promise<LearnerProfile>;
  updateProfile(updates: Partial<LearnerProfile>): Promise<LearnerProfile>;
}
