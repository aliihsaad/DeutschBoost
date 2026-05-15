import type { CEFRLevel, ConversationMode } from '@/types';
import type { TranscriptTurn } from '../speech/transcriptTypes';
import type { LearnerId } from '../learning/types';

export interface ConversationCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface ConversationFeedbackRecord {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  grammarCorrections: ConversationCorrection[];
  vocabularySuggestions: string[];
  fluencyNotes: string;
  encouragement: string;
  level: CEFRLevel;
  language: string;
}

export interface ConversationSessionRecord {
  id: string;
  learnerId: LearnerId;
  mode: ConversationMode;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  transcript: TranscriptTurn[];
  feedback?: ConversationFeedbackRecord;
}

export interface ConversationRepository {
  startSession(input: Pick<ConversationSessionRecord, 'learnerId' | 'mode' | 'startedAt'>): Promise<string>;
  appendTranscript(sessionId: string, turn: TranscriptTurn): Promise<void>;
  endSession(session: ConversationSessionRecord): Promise<void>;
  loadRecentSessions(learnerId: LearnerId, limit: number): Promise<ConversationSessionRecord[]>;
  loadLastFeedback(learnerId: LearnerId): Promise<ConversationFeedbackRecord | null>;
}
