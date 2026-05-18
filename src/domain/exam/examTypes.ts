import type { CEFRLevel } from '../../../types';

export type ExamModuleId = 'listening' | 'reading' | 'writing' | 'speaking';

export interface ExamObjectiveQuestion {
  id: string;
  moduleId: ExamModuleId;
  partId?: string;
  prompt: string;
  passage?: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
  explanation?: string;
}

export interface ExamProductiveTask {
  id: string;
  moduleId: Extract<ExamModuleId, 'writing' | 'speaking'>;
  partId?: string;
  prompt: string;
  context?: string;
  minWords?: number;
  points: number;
  rubric: string[];
}

export interface ExamTemplateSource {
  label: string;
  url: string;
  note: string;
}

export interface ExamModuleTemplatePart {
  id: string;
  title: string;
  taskFamily: string;
  answerFormat: string;
  questionCount?: number;
  maxPoints?: number;
  scoringNote?: string;
  criteria?: ExamCriterionDefinition[];
  promptGuidance: string;
}

export interface ExamCriterionDefinition {
  id: string;
  label: string;
  maxPoints: number;
}

export interface ExamModule {
  id: ExamModuleId;
  germanLabel: string;
  englishLabel: string;
  durationMinutes: number;
  parts: number;
  instructions: string;
  templateParts: ExamModuleTemplatePart[];
  objectiveQuestions: ExamObjectiveQuestion[];
  productiveTasks: ExamProductiveTask[];
}

export interface GoetheExam {
  id: string;
  title: string;
  templateName: string;
  level: CEFRLevel;
  generatedAt: string;
  totalMinutes: number;
  passThreshold: number;
  officialSources: ExamTemplateSource[];
  sourceNotes: string[];
  modules: ExamModule[];
}

export interface ExamAnswerSet {
  objective: Record<string, number>;
  productive: Record<string, string>;
}

export interface ExamModuleResult {
  moduleId: ExamModuleId;
  germanLabel: string;
  englishLabel: string;
  rawEarnedPoints: number;
  rawPossiblePoints: number;
  earnedPoints: number;
  possiblePoints: number;
  lostPoints: number;
  percentage: number;
  passed: boolean;
  rating: string;
  partResults: ExamPartResult[];
}

export interface ExamCriterionScore {
  criterionId: string;
  label: string;
  band: 'A' | 'B' | 'C' | 'D' | 'E';
  earnedPoints: number;
  possiblePoints: number;
  lostPoints: number;
}

export interface ExamPartResult {
  partId: string;
  title: string;
  earnedPoints: number;
  possiblePoints: number;
  lostPoints: number;
  percentage: number;
  scoringNote: string;
  criteria?: ExamCriterionScore[];
}

export interface ExamResult {
  totalEarnedPoints: number;
  totalPossiblePoints: number;
  percentage: number;
  passed: boolean;
  moduleResults: ExamModuleResult[];
  summary: string;
}

export interface ExamAttempt {
  id: string;
  learnerId: string;
  examId: string;
  title: string;
  level: CEFRLevel;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  answers: ExamAnswerSet;
  result: ExamResult;
}
