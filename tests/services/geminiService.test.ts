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
    geminiMock.generateContent.mockReset();
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
        options: expect.objectContaining({
          model: 'gemini-2.5-pro',
        }),
      })
    );
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
        options: expect.objectContaining({
          model: 'gemini-2.5-pro',
        }),
      })
    );
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
        options: expect.objectContaining({
          model: 'gemini-2.5-pro',
        }),
      })
    );
    expect(geminiMock.generateContent).not.toHaveBeenCalled();
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
