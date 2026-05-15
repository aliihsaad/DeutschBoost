import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEFRLevel } from '../../types';
import type { AiProvider } from '../../src/domain/ai/aiProvider';

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

  const createProvider = <T>(result: T): AiProvider => ({
    id: 'openrouter',
    displayName: 'OpenRouter',
    generateJson: vi.fn().mockResolvedValue(result),
    generateText: vi.fn(),
  });

  describe('generateGrammarActivity', () => {
    it('can generate grammar activity through an injected AI provider', async () => {
      const provider = createProvider({
        topic: 'Articles',
        level: 'A1',
        questions: [
          {
            sentence: 'Ich habe ___ Apfel.',
            blank_position: 2,
            options: ['ein', 'einen', 'eine', 'einer'],
            correct_option: 1,
            explanation: 'Masculine accusative requires "einen".',
          },
        ],
      });

      const { generateGrammarActivity } = await import('../../services/activityService');
      const result = await generateGrammarActivity(
        'Articles',
        'Learn articles',
        CEFRLevel.A1,
        'English',
        provider
      );

      expect(result.questions).toHaveLength(1);
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'grammar activity',
          messages: [
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Create a grammar exercise'),
            }),
          ],
        })
      );
    });

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
      expect(result.questions[0]?.correct_option).toBe(1);
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
    it('can generate vocabulary cards through an injected AI provider', async () => {
      const provider = createProvider({
        topic: 'Food',
        level: 'A2',
        cards: [
          {
            german: 'der Apfel',
            translation: 'the apple',
            example_sentence: 'Ich esse einen Apfel.',
          },
        ],
      });

      const { generateVocabularyActivity } = await import('../../services/activityService');
      const result = await generateVocabularyActivity(
        'Food',
        'Learn food vocabulary',
        CEFRLevel.A2,
        'English',
        provider
      );

      expect(result.cards[0]?.german).toBe('der Apfel');
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'vocabulary activity',
          schemaName: 'VocabularyActivity',
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Create vocabulary flashcards'),
            }),
          ],
        })
      );
    });

    it('throws a clear error when AI response text is missing', async () => {
      const { ai } = await import('../../services/geminiService');

      vi.mocked(ai.models.generateContent).mockResolvedValue({} as any);

      const { generateVocabularyActivity } = await import('../../services/activityService');

      await expect(
        generateVocabularyActivity('Food', 'Learn food vocabulary', CEFRLevel.A2)
      ).rejects.toThrow('Missing vocabulary activity response text');
    });

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
      expect(result.cards[0]?.german).toBe('der Apfel');
    });
  });

  describe('generateListeningActivity', () => {
    it('can generate listening questions through an injected AI provider', async () => {
      const provider = createProvider({
        topic: 'Weather',
        level: 'A2',
        questions: [
          {
            audio_text: 'Heute scheint die Sonne.',
            question: 'Wie ist das Wetter?',
            options: ['Sonnig', 'Kalt', 'Regnerisch', 'Windig'],
            correct_option: 0,
          },
        ],
      });

      const { generateListeningActivity } = await import('../../services/activityService');
      const result = await generateListeningActivity(
        'Weather',
        'Understand weather reports',
        CEFRLevel.A2,
        'English',
        provider
      );

      expect(result.questions[0]?.audio_text).toBe('Heute scheint die Sonne.');
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'listening activity', schemaName: 'ListeningActivity' })
      );
    });
  });

  describe('generateWritingActivity', () => {
    it('can generate writing prompts through an injected AI provider', async () => {
      const provider = createProvider({
        topic: 'Travel',
        level: 'B1',
        prompt: 'Schreiben Sie über eine Reise.',
        min_words: 80,
        evaluation_criteria: ['Past tense', 'Connectors'],
      });

      const { generateWritingActivity } = await import('../../services/activityService');
      const result = await generateWritingActivity(
        'Travel',
        'Practice travel writing',
        CEFRLevel.B1,
        'English',
        provider
      );

      expect(result.min_words).toBe(80);
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'writing activity', schemaName: 'WritingActivity' })
      );
    });
  });

  describe('generateSpeakingActivity', () => {
    it('can generate speaking scenarios through an injected AI provider', async () => {
      const provider = createProvider({
        topic: 'Restaurant',
        level: 'A2',
        scenario: 'Order food at a cafe.',
        min_duration_seconds: 90,
        conversation_starters: ['Was möchten Sie bestellen?'],
      });

      const { generateSpeakingActivity } = await import('../../services/activityService');
      const result = await generateSpeakingActivity(
        'Restaurant',
        'Practice ordering food',
        CEFRLevel.A2,
        'English',
        provider
      );

      expect(result.conversation_starters).toContain('Was möchten Sie bestellen?');
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'speaking activity', schemaName: 'SpeakingActivity' })
      );
    });
  });

  describe('generateReadingActivity', () => {
    it('can generate reading comprehension through an injected AI provider', async () => {
      const provider = createProvider({
        topic: 'Berlin',
        level: 'B1',
        questions: [
          {
            text: 'Maria wohnt in Berlin.',
            question: 'Wo wohnt Maria?',
            options: ['Berlin', 'Wien', 'Bern', 'Hamburg'],
            correct_option: 0,
            explanation: 'The text says Berlin.',
          },
        ],
      });

      const { generateReadingActivity } = await import('../../services/activityService');
      const result = await generateReadingActivity(
        'Berlin',
        'Read about cities',
        CEFRLevel.B1,
        'English',
        provider
      );

      expect(result.questions[0]?.text).toBe('Maria wohnt in Berlin.');
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'reading activity', schemaName: 'ReadingActivity' })
      );
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

    it('passes an injected AI provider to the routed generator', async () => {
      const { ai } = await import('../../services/geminiService');
      const provider = createProvider({
        topic: 'Food',
        level: 'A2',
        cards: [],
      });

      const { generateActivity } = await import('../../services/activityService');
      await generateActivity('vocabulary', 'Food', 'Learn words', CEFRLevel.A2, 'English', provider);

      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'vocabulary activity' })
      );
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });

    it('should throw for unknown activity type', async () => {
      const { generateActivity } = await import('../../services/activityService');

      await expect(
        generateActivity('unknown' as any, 'Test', 'Desc', CEFRLevel.A1)
      ).rejects.toThrow('Unknown activity type');
    });
  });

  describe('evaluateWriting', () => {
    it('can evaluate writing through an injected AI provider', async () => {
      const provider = createProvider({
        score: 82,
        strengths: ['Clear structure'],
        areas_for_improvement: ['Article endings'],
        detailed_feedback: 'Good work.',
        corrected_text: 'Ich bin Student.',
      });

      const { evaluateWriting } = await import('../../services/activityService');
      const result = await evaluateWriting(
        'Ich bin student',
        'Write about yourself',
        CEFRLevel.A1,
        ['Grammar', 'Vocabulary'],
        'English',
        provider
      );

      expect(result.score).toBe(82);
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'writing evaluation',
          schemaName: 'WritingEvaluation',
          options: expect.objectContaining({ model: 'gemini-2.5-pro' }),
        })
      );
    });

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
