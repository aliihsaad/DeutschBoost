export type TranscriptSpeaker = 'learner' | 'tutor' | 'system';

export interface TranscriptTurnInput {
  speaker: TranscriptSpeaker;
  text: string;
  occurredAt: string;
  confidence?: number;
  provider?: string;
}

export interface TranscriptTurn {
  speaker: TranscriptSpeaker;
  text: string;
  occurredAt: string;
  confidence?: number;
  provider?: string;
}

export const normalizeTranscriptText = (text: string): string => {
  return text.trim().replace(/\s+/g, ' ');
};

export const createTranscriptTurn = (input: TranscriptTurnInput): TranscriptTurn => {
  return {
    ...input,
    text: normalizeTranscriptText(input.text),
  };
};
