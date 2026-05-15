import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CEFRLevel, type Transcript } from '../../types';
import type { AiProvider } from '../../src/domain/ai/aiProvider';

vi.mock('../../services/geminiService', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const meaningfulTranscripts = (): Transcript[] => [
  { id: 1, speaker: 'user', text: 'Ich wohne in Berlin.' },
  { id: 2, speaker: 'model', text: 'Sehr gut. Was machst du gern?' },
  { id: 3, speaker: 'user', text: 'Ich spiele gern Fussball.' },
  { id: 4, speaker: 'model', text: 'Wie oft spielst du?' },
  { id: 5, speaker: 'user', text: 'Ich spiele jeden Samstag.' },
  { id: 6, speaker: 'model', text: 'Das klingt gut.' },
];

const providerFeedback = {
  overall_score: 76,
  strengths: ['Good sentence structure'],
  areas_for_improvement: ['Article endings'],
  grammar_corrections: [
    {
      original: 'Ich spiele jeden Samstag.',
      corrected: 'Ich spiele jeden Samstag Fussball.',
      explanation: 'The object makes the meaning clearer.',
    },
  ],
  vocabulary_suggestions: ['regelmaessig', 'Mannschaft'],
  fluency_notes: 'Clear and understandable.',
  encouragement: 'Keep building longer answers.',
};

const createProvider = (): AiProvider => ({
  id: 'openrouter',
  displayName: 'OpenRouter',
  generateJson: vi.fn().mockResolvedValue(providerFeedback),
  generateText: vi.fn(),
});

describe('conversationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateConversationFeedback', () => {
    it('can generate feedback through an injected AI provider', async () => {
      const provider = createProvider();
      const { ai } = await import('../../services/geminiService');
      const { generateConversationFeedback } = await import('../../services/conversationService');

      const result = await generateConversationFeedback(
        meaningfulTranscripts(),
        CEFRLevel.A2,
        'English',
        provider
      );

      expect(result.error).toBeNull();
      expect(result.feedback?.overall_score).toBe(76);
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'conversation feedback',
          schemaName: 'ConversationFeedback',
          messages: [
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('CONVERSATION TRANSCRIPT'),
            }),
          ],
          options: expect.objectContaining({
            model: 'gemini-2.5-pro',
            temperature: 0.7,
          }),
        })
      );
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });

    it('keeps Gemini as the default provider for meaningful transcripts', async () => {
      const { ai } = await import('../../services/geminiService');
      vi.mocked(ai.models.generateContent).mockResolvedValue({
        text: JSON.stringify(providerFeedback),
      });

      const { generateConversationFeedback } = await import('../../services/conversationService');

      const result = await generateConversationFeedback(meaningfulTranscripts(), CEFRLevel.A2);

      expect(result.error).toBeNull();
      expect(result.feedback?.overall_score).toBe(76);
      expect(ai.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro',
          config: expect.objectContaining({
            responseMimeType: 'application/json',
            temperature: 0.7,
          }),
        })
      );
    });

    it('returns localized fallback without calling AI for short conversations', async () => {
      const provider = createProvider();
      const { ai } = await import('../../services/geminiService');
      const { generateConversationFeedback } = await import('../../services/conversationService');

      const result = await generateConversationFeedback(
        [{ id: 1, speaker: 'user', text: 'Hallo' }],
        CEFRLevel.A1,
        'English',
        provider
      );

      expect(result.error).toBeNull();
      expect(result.feedback?.overall_score).toBe(0);
      expect(result.feedback?.areas_for_improvement).toContain('Try to have a longer conversation next time');
      expect(provider.generateJson).not.toHaveBeenCalled();
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('endConversationSession', () => {
    it('passes an injected AI provider through feedback generation before saving', async () => {
      const provider = createProvider();
      const { ai } = await import('../../services/geminiService');
      const { supabase } = await import('../../src/lib/supabase');
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as any);

      const { endConversationSession } = await import('../../services/conversationService');

      const result = await endConversationSession(
        'session-1',
        meaningfulTranscripts(),
        new Date('2026-05-15T10:00:00.000Z'),
        CEFRLevel.A2,
        'English',
        provider
      );

      expect(result.error).toBeNull();
      expect(provider.generateJson).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'conversation feedback' })
      );
      expect(ai.models.generateContent).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: JSON.stringify(providerFeedback),
          transcript: expect.arrayContaining([
            expect.objectContaining({
              speaker: 'user',
              text: 'Ich wohne in Berlin.',
              timestamp: 1,
            }),
          ]),
        })
      );
      expect(eq).toHaveBeenCalledWith('id', 'session-1');
    });
  });
});
