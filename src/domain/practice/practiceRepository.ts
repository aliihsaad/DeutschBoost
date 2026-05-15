import type {
  DailyPracticeSuggestion,
  PracticeSession,
  PracticeStats,
  SkillType,
  TestResult,
} from '@/types';
import type { CEFRLevel, LearnerId } from '../learning/types';

export interface PracticeSuggestionInput {
  learnerId: LearnerId;
  level: CEFRLevel;
  testResult?: TestResult;
}

export interface PracticeSessionResult {
  score?: number;
  durationMinutes: number;
  itemsCompleted?: number;
  feedback?: string;
  strengths?: string[];
  areasForImprovement?: string[];
  examSections?: Record<string, number>;
}

export interface PracticeRepository {
  loadDailySuggestions(learnerId: LearnerId, date: string): Promise<DailyPracticeSuggestion[]>;
  saveDailySuggestions(input: PracticeSuggestionInput, suggestions: DailyPracticeSuggestion[]): Promise<void>;
  markSuggestionCompleted(suggestionId: string): Promise<void>;
  dismissSuggestion(suggestionId: string): Promise<void>;
  createSession(learnerId: LearnerId, activityType: SkillType | 'Mock Exam', level: CEFRLevel, topic?: string): Promise<PracticeSession>;
  completeSession(sessionId: string, result: PracticeSessionResult): Promise<void>;
  loadStats(learnerId: LearnerId, days: number): Promise<PracticeStats>;
  loadRecentSessions(learnerId: LearnerId, limit: number): Promise<PracticeSession[]>;
}
