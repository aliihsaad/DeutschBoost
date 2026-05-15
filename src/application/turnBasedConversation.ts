import type { AiMessage, AiProvider } from '../domain/ai/aiProvider';
import type { SpeechProvider } from '../domain/speech/speechProvider';
import { createTranscriptTurn, type TranscriptTurn } from '../domain/speech/transcriptTypes';
import type { CEFRLevel, ConversationMode, Transcript } from '../../types';

export interface TurnBasedConversationInput {
  speechProvider: SpeechProvider;
  aiProvider: AiProvider;
  audio: Blob | ArrayBuffer | Uint8Array;
  mimeType: string;
  history: TranscriptTurn[];
  level: CEFRLevel;
  motherLanguage?: string;
  mode: ConversationMode;
  topic?: string;
  description?: string;
  now?: () => string;
}

export interface TurnBasedConversationResult {
  learnerTurn: TranscriptTurn;
  tutorTurn: TranscriptTurn;
  transcript: TranscriptTurn[];
  rawLearnerText: string;
}

const DEFAULT_MOTHER_LANGUAGE = 'English';

export async function runTurnBasedConversationTurn(
  input: TurnBasedConversationInput
): Promise<TurnBasedConversationResult> {
  const transcription = await input.speechProvider.transcribe({
    feature: 'conversation voice turn',
    audio: input.audio,
    mimeType: input.mimeType,
    options: {
      punctuation: true,
      smartFormat: true,
    },
  });

  const learnerTurn = transcription.transcript;

  if (learnerTurn.text.trim().length === 0) {
    throw new Error('No German speech was transcribed. Try recording the turn again.');
  }

  const tutorText = await input.aiProvider.generateText({
    feature: 'german conversation tutor turn',
    messages: buildTutorMessages({
      history: input.history,
      learnerTurn,
      level: input.level,
      motherLanguage: input.motherLanguage ?? DEFAULT_MOTHER_LANGUAGE,
      mode: input.mode,
      topic: input.topic,
      description: input.description,
    }),
    options: {
      temperature: 0.45,
      maxTokens: 260,
    },
  });

  const tutorTurn = createTranscriptTurn({
    speaker: 'tutor',
    text: tutorText,
    occurredAt: (input.now ?? (() => new Date().toISOString()))(),
    provider: input.aiProvider.id,
  });

  if (tutorTurn.text.length === 0) {
    throw new Error('The tutor returned an empty response. Try the turn again.');
  }

  return {
    learnerTurn,
    tutorTurn,
    transcript: [...input.history, learnerTurn, tutorTurn],
    rawLearnerText: transcription.rawText,
  };
}

export function transcriptTurnsToLegacyTranscripts(turns: TranscriptTurn[]): Transcript[] {
  const transcripts: Transcript[] = [];

  for (const turn of turns) {
    if (turn.speaker === 'learner') {
      transcripts.push({ id: transcripts.length, speaker: 'user', text: turn.text });
    }

    if (turn.speaker === 'tutor') {
      transcripts.push({ id: transcripts.length, speaker: 'model', text: turn.text });
    }
  }

  return transcripts;
}

interface TutorMessageInput {
  history: TranscriptTurn[];
  learnerTurn: TranscriptTurn;
  level: CEFRLevel;
  motherLanguage: string;
  mode: ConversationMode;
  topic?: string;
  description?: string;
}

function buildTutorMessages(input: TutorMessageInput): AiMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are Alex, a German conversation tutor inside DeutschBoost.',
        `The learner is CEFR ${input.level}.`,
        `The learner native language is ${input.motherLanguage}.`,
        'Tutor behavior: answer mostly in German, keep the turn concise, correct only the most useful mistake, then ask one natural follow-up question.',
        'Use short supportive explanations only when they help the learner continue speaking.',
        'Do not produce JSON, markdown tables, or long lesson notes.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Conversation mode: ${formatMode(input.mode)}`,
        input.topic ? `Topic: ${input.topic}` : null,
        input.description ? `Task: ${input.description}` : null,
        '',
        'Recent transcript:',
        formatTranscript([...input.history, input.learnerTurn]),
        '',
        'Respond now as the tutor. Keep it natural and useful for the next spoken turn.',
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
    },
  ];
}

function formatTranscript(turns: TranscriptTurn[]): string {
  const learnerAndTutorTurns = turns.filter(turn => turn.speaker !== 'system');

  if (learnerAndTutorTurns.length === 0) {
    return 'No prior transcript.';
  }

  return learnerAndTutorTurns
    .slice(-10)
    .map(turn => `${turn.speaker === 'learner' ? 'Learner' : 'Tutor'}: ${turn.text}`)
    .join('\n');
}

function formatMode(mode: ConversationMode): string {
  return mode
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
