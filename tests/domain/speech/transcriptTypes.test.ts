import { describe, expect, it } from 'vitest';
import { createTranscriptTurn, normalizeTranscriptText } from '../../../src/domain/speech/transcriptTypes';

describe('normalizeTranscriptText', () => {
  it('trims and collapses transcript whitespace', () => {
    expect(normalizeTranscriptText('  Ich   gehe\nheute\tins   Kino.  ')).toBe('Ich gehe heute ins Kino.');
  });

  it('returns an empty string for whitespace-only transcripts', () => {
    expect(normalizeTranscriptText('  \n\t  ')).toBe('');
  });
});

describe('createTranscriptTurn', () => {
  it('creates a normalized local transcript turn', () => {
    const turn = createTranscriptTurn({
      speaker: 'learner',
      text: '  Guten   Morgen  ',
      occurredAt: '2026-05-15T10:00:00.000Z',
      confidence: 0.94,
      provider: 'deepgram',
    });

    expect(turn).toEqual({
      speaker: 'learner',
      text: 'Guten Morgen',
      occurredAt: '2026-05-15T10:00:00.000Z',
      confidence: 0.94,
      provider: 'deepgram',
    });
  });
});
