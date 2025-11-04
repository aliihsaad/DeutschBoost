
export enum CEFRLevel {
  A1 = "A1",
  A2 = "A2",
  B1 = "B1",
  B2 = "B2",
  C1 = "C1",
  C2 = "C2",
}

export enum Page {
  Home = "Home",
  PlacementTest = "PlacementTest",
  LearningPlan = "LearningPlan",
  Practice = "Practice",
  Conversation = "Conversation",
  Profile = "Profile",
}

export interface TestQuestion {
  id: number;
  type: 'Lesen' | 'Hören' | 'Schreiben';
  questionText: string;
  audioText?: string; // For Hören
  options?: string[];
  correctOption?: number;
}

export interface TestResult {
  level: CEFRLevel;
  strengths: string[];
  weaknesses: string[];
  recommendations: string;
}

export interface LearningPlanItem {
  id?: string;  // Database ID for the learning_plan_items record
  topic: string;
  skill: 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking' | 'Reading';
  description: string;
  completed: boolean;
}

export interface LearningPlan {
  level: CEFRLevel;
  goals: string[];
  weeks: {
    week: number;
    focus: string;
    items: LearningPlanItem[];
  }[];
}

export interface Transcript {
    id: number;
    speaker: 'user' | 'model';
    text: string;
}

export enum ConversationMode {
  FREE_CONVERSATION = "FREE_CONVERSATION",
  READING_PRACTICE = "READING_PRACTICE",
  VOCABULARY_BUILDER = "VOCABULARY_BUILDER",
  GRAMMAR_DRILL = "GRAMMAR_DRILL",
  LISTENING_COMPREHENSION = "LISTENING_COMPREHENSION",
  SPEAKING_ACTIVITY = "SPEAKING_ACTIVITY",
}

export interface ConversationModeInfo {
  mode: ConversationMode;
  name: string;
  description: string;
  icon: string;
}

// Practice-related types
export type SkillType = 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking' | 'Reading';
export type ActivityTypeExtended = SkillType | 'Mock Exam';

export interface PracticeSession {
  id: string;
  user_id: string;
  activity_type: ActivityTypeExtended;
  topic?: string;
  level: CEFRLevel;
  score?: number;
  duration_minutes: number;
  items_completed?: number;
  is_mock_exam: boolean;
  exam_sections?: {
    reading?: number;
    writing?: number;
    listening?: number;
    speaking?: number;
  };
  feedback?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  started_at: string;
  completed_at: string;
}

export interface DailyPracticeSuggestion {
  id: string;
  user_id: string;
  skill_type: SkillType;
  topic: string;
  reason: string;
  level: CEFRLevel;
  priority: number; // 1-5, 1 being highest
  is_completed: boolean;
  is_dismissed: boolean;
  suggested_date: string;
  completed_at?: string;
  created_at: string;
}

export interface PracticeStats {
  total_sessions: number;
  total_minutes: number;
  average_score: number;
  skills_practiced: Record<ActivityTypeExtended, number>;
  recent_sessions: Array<{
    id: string;
    activity_type: ActivityTypeExtended;
    topic?: string;
    score?: number;
    completed_at: string;
  }>;
}

export interface ExamSection {
  name: 'Lesen' | 'Hören' | 'Schreiben' | 'Sprechen';
  description: string;
  duration_minutes: number;
  score?: number;
  feedback?: string;
}

export interface MockExam {
  level: CEFRLevel;
  sections: ExamSection[];
  total_duration_minutes: number;
  started_at?: string;
  completed_at?: string;
}
