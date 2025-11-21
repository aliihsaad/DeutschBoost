import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEFRLevel } from '../../types';

// Mock the AI module
vi.mock('../../services/geminiService', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

// Mock safeJsonParse
vi.mock('../../utils/safeJsonParse', () => ({
  parseAiJsonResponse: vi.fn((text) => JSON.parse(text)),
}));

describe('activityService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the parseAiJsonResponse mock to default behavior
    const { parseAiJsonResponse } = await import('../../utils/safeJsonParse');
    vi.mocked(parseAiJsonResponse).mockImplementation((text) => JSON.parse(text));
  });

  describe('generateGrammarActivity', () => {
    it('should generate grammar activity with correct structure', async () => {
      const { ai } = await import('../../services/geminiService');

      const mockResponse = {
        text: JSON.stringify({
          topic: 'Articles',
          level: 'A1',
          questions: [
            {
              sentence: 'Ich habe ___ Apfel.',
              blank_position: 2,
              options: ['ein', 'einen', 'eine', 'einer'],
              correct_option: 1,
              explanation: 'Masculine accusative requires "einen"',
            },
          ],
        }),
      };

      vi.mocked(ai.models.generateContent).mockResolvedValue(mockResponse as any);

      const { generateGrammarActivity } = await import('../../services/activityService');
      const result = await generateGrammarActivity('Articles', 'Learn articles', CEFRLevel.A1);

      expect(result.topic).toBe('Articles');
      expect(result.level).toBe('A1');
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].correct_option).toBe(1);
    });

    it('should throw error for invalid AI response', async () => {
      const { ai } = await import('../../services/geminiService');
      const { parseAiJsonResponse } = await import('../../utils/safeJsonParse');

      vi.mocked(ai.models.generateContent).mockResolvedValue({ text: 'invalid json' } as any);
      vi.mocked(parseAiJsonResponse).mockImplementation(() => {
        throw new Error('Failed to parse grammar activity response');
      });

      const { generateGrammarActivity } = await import('../../services/activityService');

      await expect(
        generateGrammarActivity('Test', 'Test', CEFRLevel.A1)
      ).rejects.toThrow('grammar activity');
    });
  });

  describe('generateVocabularyActivity', () => {
    it('should generate vocabulary cards', async () => {
      const { ai } = await import('../../services/geminiService');

      const mockResponse = {
        text: JSON.stringify({
          topic: 'Food',
          level: 'A2',
          cards: [
            {
              german: 'der Apfel',
              translation: 'the apple',
              example_sentence: 'Ich esse einen Apfel.',
            },
          ],
        }),
      };

      vi.mocked(ai.models.generateContent).mockResolvedValue(mockResponse as any);

      const { generateVocabularyActivity } = await import('../../services/activityService');
      const result = await generateVocabularyActivity('Food', 'Learn food vocabulary', CEFRLevel.A2);

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].german).toBe('der Apfel');
    });
  });

  describe('generateActivity', () => {
    it('should route to correct generator based on activity type', async () => {
      const { ai } = await import('../../services/geminiService');

      const mockResponse = {
        text: JSON.stringify({
          topic: 'Test',
          level: 'B1',
          questions: [],
        }),
      };

      vi.mocked(ai.models.generateContent).mockResolvedValue(mockResponse as any);

      const { generateActivity } = await import('../../services/activityService');

      // Test grammar routing
      await generateActivity('grammar', 'Test', 'Desc', CEFRLevel.B1);
      expect(ai.models.generateContent).toHaveBeenCalled();
    });

    it('should throw for unknown activity type', async () => {
      const { generateActivity } = await import('../../services/activityService');

      await expect(
        generateActivity('unknown' as any, 'Test', 'Desc', CEFRLevel.A1)
      ).rejects.toThrow('Unknown activity type');
    });
  });

  describe('evaluateWriting', () => {
    it('should evaluate writing with correct score structure', async () => {
      const { ai } = await import('../../services/geminiService');

      const mockResponse = {
        text: JSON.stringify({
          score: 75,
          strengths: ['Good vocabulary'],
          areas_for_improvement: ['Grammar needs work'],
          detailed_feedback: 'Overall good effort',
          corrected_text: 'Corrected version',
        }),
      };

      vi.mocked(ai.models.generateContent).mockResolvedValue(mockResponse as any);

      const { evaluateWriting } = await import('../../services/activityService');
      const result = await evaluateWriting(
        'Ich bin student',
        'Write about yourself',
        CEFRLevel.A1,
        ['Grammar', 'Vocabulary']
      );

      expect(result.score).toBe(75);
      expect(result.strengths).toContain('Good vocabulary');
    });
  });
});
