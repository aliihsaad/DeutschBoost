import { describe, expect, it, vi } from 'vitest';
import { generateLocalConversationFeedback } from '../../src/application/conversationFeedback';
import type { AiProvider } from '../../src/domain/ai/aiProvider';
import type { TranscriptTurn } from '../../src/domain/speech/transcriptTypes';
import { CEFRLevel } from '../../types';

function createAiProvider(feedback: unknown): AiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    generateText: vi.fn(),
    generateJson: vi.fn().mockResolvedValue(feedback),
  };
}

describe('generateLocalConversationFeedback', () => {
  it('generates structured feedback from a local transcript through the AI provider', async () => {
    const turns: TranscriptTurn[] = [
      { speaker: 'learner', text: 'Ich mochte ein Kaffee.', occurredAt: '2026-05-15T15:00:00.000Z' },
      { speaker: 'tutor', text: 'Fast richtig: einen Kaffee.', occurredAt: '2026-05-15T15:00:05.000Z' },
      { speaker: 'learner', text: 'Ich trinke Kaffee gern.', occurredAt: '2026-05-15T15:01:00.000Z' },
      { speaker: 'tutor', text: 'Sehr gut. Was isst du dazu?', occurredAt: '2026-05-15T15:01:05.000Z' },
    ];
    const aiProvider = createAiProvider({
      overallScore: 78,
      strengths: ['Answered in complete sentences'],
      areasForImprovement: ['Accusative articles'],
      grammarCorrections: [
        {
          original: 'ein Kaffee',
          corrected: 'einen Kaffee',
          explanation: 'Kaffee is masculine and needs accusative here.',
        },
      ],
      vocabularySuggestions: ['dazu'],
      fluencyNotes: 'Good pacing for A2.',
      encouragement: 'Keep building longer answers.',
    });

    const feedback = await generateLocalConversationFeedback({
      aiProvider,
      turns,
      level: CEFRLevel.A2,
      motherLanguage: 'English',
    });

    expect(aiProvider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'local conversation feedback',
        schemaName: 'ConversationFeedbackRecord',
        options: {
          temperature: 0.3,
          maxTokens: 900,
        },
      })
    );
    const request = vi.mocked(aiProvider.generateJson).mock.calls[0][0];
    expect(request.messages[0].content).toContain('German language teacher');
    expect(request.messages[1].content).toContain('CEFR A2');
    expect(request.messages[1].content).toContain('Learner: Ich mochte ein Kaffee.');
    expect(feedback).toEqual({
      overallScore: 78,
      strengths: ['Answered in complete sentences'],
      areasForImprovement: ['Accusative articles'],
      grammarCorrections: [
        {
          original: 'ein Kaffee',
          corrected: 'einen Kaffee',
          explanation: 'Kaffee is masculine and needs accusative here.',
        },
      ],
      vocabularySuggestions: ['dazu'],
      fluencyNotes: 'Good pacing for A2.',
      encouragement: 'Keep building longer answers.',
      level: CEFRLevel.A2,
      language: 'English',
    });
  });

  it('returns a local short-session fallback without calling AI', async () => {
    const aiProvider = createAiProvider({});

    const feedback = await generateLocalConversationFeedback({
      aiProvider,
      turns: [{ speaker: 'learner', text: 'Hallo', occurredAt: '2026-05-15T15:00:00.000Z' }],
      level: CEFRLevel.A1,
      motherLanguage: 'English',
    });

    expect(aiProvider.generateJson).not.toHaveBeenCalled();
    expect(feedback.overallScore).toBe(0);
    expect(feedback.areasForImprovement[0]).toContain('at least two spoken turns');
  });
});
