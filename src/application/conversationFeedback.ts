import type { AiProvider } from '../domain/ai/aiProvider';
import type {
  ConversationCorrection,
  ConversationFeedbackRecord,
} from '../domain/conversation/conversationRepository';
import type { TranscriptTurn } from '../domain/speech/transcriptTypes';
import type { CEFRLevel } from '../../types';

export interface LocalConversationFeedbackInput {
  aiProvider: AiProvider;
  turns: TranscriptTurn[];
  level: CEFRLevel;
  motherLanguage: string;
}

type FeedbackResponse = Partial<Omit<ConversationFeedbackRecord, 'level' | 'language'>>;

export async function generateLocalConversationFeedback(
  input: LocalConversationFeedbackInput
): Promise<ConversationFeedbackRecord> {
  const learnerTurns = input.turns.filter(turn => turn.speaker === 'learner' && turn.text.trim().length > 0);
  const tutorTurns = input.turns.filter(turn => turn.speaker === 'tutor' && turn.text.trim().length > 0);

  if (learnerTurns.length < 2 || tutorTurns.length < 1) {
    return buildShortSessionFeedback(input.level, input.motherLanguage);
  }

  const response = await input.aiProvider.generateJson<FeedbackResponse>({
    feature: 'local conversation feedback',
    schemaName: 'ConversationFeedbackRecord',
    messages: [
      {
        role: 'system',
        content: [
          'You are an experienced German language teacher.',
          'Review the learner transcript and return only valid JSON.',
          'Be specific, practical, and encouraging.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Learner level: CEFR ${input.level}`,
          `Feedback language: ${input.motherLanguage}`,
          '',
          'Transcript:',
          formatTranscript(input.turns),
          '',
          'Return JSON with this shape:',
          '{',
          '  "overallScore": number,',
          '  "strengths": string[],',
          '  "areasForImprovement": string[],',
          '  "grammarCorrections": [{"original": string, "corrected": string, "explanation": string}],',
          '  "vocabularySuggestions": string[],',
          '  "fluencyNotes": string,',
          '  "encouragement": string',
          '}',
        ].join('\n'),
      },
    ],
    options: {
      temperature: 0.3,
      maxTokens: 900,
    },
  });

  return normalizeFeedbackResponse(response, input.level, input.motherLanguage);
}

function buildShortSessionFeedback(level: CEFRLevel, language: string): ConversationFeedbackRecord {
  return {
    overallScore: 0,
    strengths: ['You started the session and captured a first spoken turn.'],
    areasForImprovement: ['Record at least two spoken turns before ending the session to get useful feedback.'],
    grammarCorrections: [],
    vocabularySuggestions: [],
    fluencyNotes: 'The session is too short for a reliable fluency review.',
    encouragement: 'Try one more answer and let the tutor ask a follow-up question.',
    level,
    language,
  };
}

function normalizeFeedbackResponse(
  response: FeedbackResponse,
  level: CEFRLevel,
  language: string
): ConversationFeedbackRecord {
  return {
    overallScore: clampScore(response.overallScore),
    strengths: normalizeStringList(response.strengths),
    areasForImprovement: normalizeStringList(response.areasForImprovement),
    grammarCorrections: normalizeCorrections(response.grammarCorrections),
    vocabularySuggestions: normalizeStringList(response.vocabularySuggestions),
    fluencyNotes: normalizeText(response.fluencyNotes),
    encouragement: normalizeText(response.encouragement),
    level,
    language,
  };
}

function formatTranscript(turns: TranscriptTurn[]): string {
  return turns
    .filter(turn => turn.speaker !== 'system')
    .map(turn => `${turn.speaker === 'learner' ? 'Learner' : 'Tutor'}: ${turn.text}`)
    .join('\n');
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeCorrections(value: unknown): ConversationCorrection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ConversationCorrection => {
      return (
        item &&
        typeof item === 'object' &&
        typeof (item as ConversationCorrection).original === 'string' &&
        typeof (item as ConversationCorrection).corrected === 'string' &&
        typeof (item as ConversationCorrection).explanation === 'string'
      );
    })
    .map(item => ({
      original: item.original,
      corrected: item.corrected,
      explanation: item.explanation,
    }));
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}
