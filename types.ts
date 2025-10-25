
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
  topic: string;
  skill: 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking';
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
}

export interface ConversationModeInfo {
  mode: ConversationMode;
  name: string;
  description: string;
  icon: string;
}
