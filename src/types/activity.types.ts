import { CEFRLevel } from '../../types';

export type ActivityType = 'grammar' | 'vocabulary' | 'listening' | 'writing' | 'speaking' | 'reading';

export interface ActivitySession {
  id: string;
  user_id: string;
  learning_plan_item_id: string;
  activity_type: ActivityType;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  data: any; // Activity-specific data (questions, answers, etc.)
}

// Grammar Activity
export interface GrammarQuestion {
  sentence: string;
  blank_position: number;
  options: string[];
  correct_option: number;
  explanation: string;
}

export interface GrammarActivity {
  topic: string;
  level: CEFRLevel;
  questions: GrammarQuestion[];
}

// Vocabulary Activity
export interface VocabularyCard {
  german: string;
  translation: string; // Translation in user's mother language
  example_sentence: string;
  audio_url?: string;
}

export interface VocabularyActivity {
  topic: string;
  level: CEFRLevel;
  cards: VocabularyCard[];
}

// Listening Activity
export interface ListeningQuestion {
  audio_text: string; // Text to be converted to speech
  question: string;
  options: string[];
  correct_option: number;
}

export interface ListeningActivity {
  topic: string;
  level: CEFRLevel;
  questions: ListeningQuestion[];
}

// Writing Activity
export interface WritingActivity {
  topic: string;
  level: CEFRLevel;
  prompt: string;
  min_words: number;
  evaluation_criteria: string[];
}

export interface WritingEvaluation {
  score: number; // 0-100
  strengths: string[];
  areas_for_improvement: string[];
  detailed_feedback: string;
  corrected_text?: string;
}

// Speaking Activity (uses existing conversation system)
export interface SpeakingActivity {
  topic: string;
  level: CEFRLevel;
  scenario: string;
  min_duration_seconds: number;
  conversation_starters: string[];
}

// Reading Activity
export interface ReadingQuestion {
  text: string; // The German text to read
  question: string;
  options: string[];
  correct_option: number;
  explanation?: string;
}

export interface ReadingActivity {
  topic: string;
  level: CEFRLevel;
  questions: ReadingQuestion[];
}

// Generic Activity Result
export interface ActivityResult {
  activity_type: ActivityType;
  score: number;
  completed: boolean;
  time_spent_seconds: number;
  data: any;
}
