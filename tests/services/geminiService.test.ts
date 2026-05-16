import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CEFRLevel, type LearningPlan, type TestResult } from '../../types';
import type { AiProvider } from '../../src/domain/ai/aiProvider';

const geminiMock = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: geminiMock.generateContent,
    };

  },
  Type: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    INTEGER: 'integer',
  },
}));

const testResult: TestResult = {
  level: CEFRLevel.A2,
  strengths: ['Understands everyday texts'],
  weaknesses: ['Verb placement'],
  recommendations: 'Practice subordinate clauses.',
};

const learningPlan: LearningPlan = {
  level: CEFRLevel.B1,
  goals: ['Improve word order'],
  weeks: [
    {
      week: 1,
      focus: 'Verb position',
      items: [
        {
          topic: 'Verb-second rule',
          skill: 'Grammar',
          description: 'Practice main-clause word order.',
          completed: false,
        },
      ],
    },
  ],
};

const createProvider = <T>(result: T): AiProvider => ({
  id: 'openrouter',
  displayName: 'OpenRouter',
  generateJson: vi.fn().mockResolvedValue(result),
  generateText: vi.fn(),
});

describe('geminiService provider boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('API_KEY', 'test-key');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    geminiMock.generateContent.mockReset();
  });

  it('does not require a Gemini API key at import time', async () => {
    vi.stubGlobal('process', { env: {} });
    vi.resetModules();

    const service = await import('../../services/geminiService');

    expect(service.generateLearningPlan).toEqual(expect.any(Function));
    await expect(service.generateLearningPlan(testResult)).rejects.toThrow(
      'No AI provider is configured'
    );
  });

  it('can evaluate comprehensive placement tests through an injected AI provider', async () => {
    const provider = createProvider(testResult);
    const { evaluateComprehensivePlacementTest } = await import('../../services/geminiService');

    const result = await evaluateComprehensivePlacementTest(
      3,
      4,
      'Ich habe gestern Deutsch gelernt.',
      'Beschreibe deinen Tag.',
      provider
    );

    expect(result).toEqual(testResult);
    expect(provider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'placement test evaluation',
        schemaName: 'TestResult',
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('READING COMPREHENSION: 3/5'),
          }),
        ],
      })
    );
    expect(vi.mocked(provider.generateJson).mock.calls[0][0].options?.model).toBeUndefined();
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('normalizes incomplete placement evaluation JSON from an injected AI provider', async () => {
    const provider = createProvider({
      level: CEFRLevel.B1,
      recommendations: 'Practice writing complete paragraphs.',
    });
    const { evaluateComprehensivePlacementTest } = await import('../../services/geminiService');

    const result = await evaluateComprehensivePlacementTest(
      4,
      3,
      'Ich habe letzte Woche Deutsch gelernt und moechte naechste Woche mehr sprechen.',
      'Beschreibe deine Woche.',
      provider
    );

    expect(result).toEqual({
      level: CEFRLevel.B1,
      strengths: ['Completed the reading, grammar, and writing placement sections.'],
      weaknesses: ['The AI examiner did not return specific improvement areas. Review the generated learning plan for targeted practice.'],
      recommendations: 'Practice writing complete paragraphs.',
    });
  });

  it('can generate placement reading questions through an injected AI provider', async () => {
    const readingQuestion = {
      text: 'Anna kauft Brot.',
      question: 'Was kauft Anna?',
      options: ['Brot', 'Milch', 'Kaffee', 'Tee'],
      correctOptionIndex: 0,
    };
    const provider = createProvider(readingQuestion);
    const { generateReadingQuestion } = await import('../../services/geminiService');

    const result = await generateReadingQuestion(CEFRLevel.A2, provider);

    expect(JSON.parse(result.text)).toEqual(readingQuestion);
    expect(provider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'placement reading question',
        schemaName: 'PlacementReadingQuestion',
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('A2 CEFR level'),
          }),
        ],
      })
    );
    expect(vi.mocked(provider.generateJson).mock.calls[0][0].options?.model).toBeUndefined();
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('can generate placement grammar questions through an injected AI provider', async () => {
    const grammarQuestion = {
      sentence: 'Ich gehe _____ Schule.',
      question: 'Was passt?',
      options: ['in die', 'im', 'an der', 'auf den'],
      correctOptionIndex: 0,
    };
    const provider = createProvider(grammarQuestion);
    const { generateGrammarQuestion } = await import('../../services/geminiService');

    const result = await generateGrammarQuestion(CEFRLevel.A2, provider);

    expect(JSON.parse(result.text)).toEqual(grammarQuestion);
    expect(provider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'placement grammar question',
        schemaName: 'PlacementGrammarQuestion',
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('A2 CEFR level'),
          }),
        ],
      })
    );
    expect(vi.mocked(provider.generateJson).mock.calls[0][0].options?.model).toBeUndefined();
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('can evaluate legacy writing samples through an injected AI provider', async () => {
    const provider = createProvider(testResult);
    const { evaluateWriting } = await import('../../services/geminiService');

    const result = await evaluateWriting(
      'Beschreibe deinen Tag.',
      'Ich gehe in die Schule.',
      provider
    );

    expect(result).toEqual(testResult);
    expect(provider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'writing evaluation',
        schemaName: 'TestResult',
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('As a certified German language examiner'),
          }),
        ],
      })
    );
    expect(vi.mocked(provider.generateJson).mock.calls[0][0].options?.model).toBeUndefined();
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('can generate learning plans through an injected AI provider and normalizes completion flags', async () => {
    const providerPlan = {
      ...learningPlan,
      weeks: [
        {
          ...learningPlan.weeks[0],
          items: [
            {
              topic: 'Verb-second rule',
              skill: 'Grammar',
              description: 'Practice main-clause word order.',
            },
          ],
        },
      ],
    };
    const provider = createProvider(providerPlan);
    const { generateLearningPlan } = await import('../../services/geminiService');

    const result = await generateLearningPlan(testResult, provider);

    expect(result.weeks[0]?.items[0]?.completed).toBe(false);
    expect(provider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'learning plan',
        schemaName: 'LearningPlan',
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('Current Level: A2'),
          }),
        ],
      })
    );
    expect(vi.mocked(provider.generateJson).mock.calls[0][0].options?.model).toBeUndefined();
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
  });

  it('normalizes incomplete learning plan JSON from an injected AI provider', async () => {
    const provider = createProvider({
      level: CEFRLevel.A2,
      goals: 'Improve grammar accuracy',
      weeks: [
        {
          week: 1,
          focus: 'Cases',
        },
      ],
    });
    const { generateLearningPlan } = await import('../../services/geminiService');

    const result = await generateLearningPlan(testResult, provider);

    expect(result).toEqual({
      level: CEFRLevel.A2,
      goals: ['Improve grammar accuracy'],
      weeks: [
        {
          week: 1,
          focus: 'Cases',
          items: [
            {
              topic: 'Cases',
              skill: 'Grammar',
              description: 'Practice Cases with short daily exercises.',
              completed: false,
            },
          ],
        },
      ],
    });
  });

  it('keeps Gemini as the default learning-plan provider', async () => {
    geminiMock.generateContent.mockResolvedValue({
      text: JSON.stringify(learningPlan),
    });
    const { generateLearningPlan } = await import('../../services/geminiService');

    const result = await generateLearningPlan(testResult);

    expect(result.weeks[0]?.items[0]?.completed).toBe(false);
    expect(geminiMock.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-pro',
        config: expect.objectContaining({
          responseMimeType: 'application/json',
        }),
      })
    );
  });
});
