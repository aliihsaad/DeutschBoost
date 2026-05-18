import { describe, expect, it, vi } from 'vitest';
import { generateGoetheExam, scoreGoetheExam } from '../../../src/domain/exam/examGenerator';
import { createExamBlueprint } from '../../../src/domain/exam/examTemplates';
import { ExamGenerationError } from '../../../src/domain/exam/examGenerationError';
import type { GoetheExam } from '../../../src/domain/exam/examTypes';
import type { AiProvider } from '../../../src/domain/ai/aiProvider';
import { CEFRLevel } from '../../../types';

// Builds a fully valid exam (real-looking content) for scoring tests.
function buildScoredExamFixture(level: CEFRLevel): GoetheExam {
  const exam = createExamBlueprint({ level, idFactory: () => `exam-${level.toLowerCase()}` });
  exam.modules = exam.modules.map(module => {
    if (module.id === 'listening' || module.id === 'reading') {
      const questions = module.templateParts.flatMap(part =>
        Array.from({ length: Math.max(1, part.questionCount ?? part.maxPoints ?? 1) }, (_, i) => ({
          id: `${module.id}-${part.id}-${i}`,
          moduleId: module.id,
          partId: part.id,
          passage: `${module.id} ${part.id} ${i}: Die Veranstaltung beginnt um ${9 + i} Uhr im Raum ${part.id}.`,
          prompt: `${module.id} ${part.id} ${i}: Wann beginnt die Veranstaltung?`,
          options: [`um ${9 + i} Uhr`, `um 7 Uhr (${part.id}${i})`, `gar nicht (${part.id}${i})`],
          correctOptionIndex: 0,
          points: (part.maxPoints ?? 1) / Math.max(1, part.questionCount ?? part.maxPoints ?? 1),
          explanation: 'Steht im Text.',
        }))
      );
      return { ...module, objectiveQuestions: questions, productiveTasks: [] };
    }
    const tasks = module.templateParts.map((part, i) => ({
      id: `${module.id}-${part.id}`,
      moduleId: module.id === 'speaking' ? ('speaking' as const) : ('writing' as const),
      partId: part.id,
      prompt: `${module.id} ${part.id}: Bearbeiten Sie Aufgabe ${i + 1} ausfuehrlich und klar.`,
      points: part.maxPoints ?? 20,
      rubric: ['Inhalt', 'Sprache'],
    }));
    return { ...module, objectiveQuestions: [], productiveTasks: tasks };
  });
  return exam;
}

function moduleResponse(exam: GoetheExam, moduleId: string) {
  const module = exam.modules.find(m => m.id === moduleId)!;
  return module.objectiveQuestions.length > 0
    ? { objectiveQuestions: module.objectiveQuestions }
    : { productiveTasks: module.productiveTasks };
}

function moduleIdFromMessages(messages: { content: string }[]): string {
  return (
    ['listening', 'reading', 'writing', 'speaking'].find(id =>
      messages.some(m => m.content.includes(`module only: "${id}"`))
    ) ?? 'reading'
  );
}

function aiProviderFor(exam: GoetheExam): AiProvider {
  return {
    id: 'mock',
    displayName: 'Mock',
    generateText: vi.fn(),
    generateJson: vi.fn(async request =>
      moduleResponse(exam, moduleIdFromMessages(request.messages)) as never
    ),
  };
}

describe('generateGoetheExam (AI-only, loud failure)', () => {
  it('throws ExamGenerationError when no AI provider is configured', async () => {
    await expect(generateGoetheExam({ level: CEFRLevel.B1 })).rejects.toBeInstanceOf(
      ExamGenerationError
    );
  });

  it('generates a full valid exam per module from the AI provider', async () => {
    const fixture = buildScoredExamFixture(CEFRLevel.B1);
    const exam = await generateGoetheExam({ level: CEFRLevel.B1, aiProvider: aiProviderFor(fixture) });
    expect(exam.modules.map(m => m.id)).toEqual(['listening', 'reading', 'writing', 'speaking']);
    expect(exam.modules.find(m => m.id === 'reading')!.objectiveQuestions.length).toBeGreaterThan(0);
    expect(JSON.stringify(exam)).not.toMatch(/Option [abc] aus dem Text|originaler .*Lesetext im Stil/i);
  });

  it('retries a module then succeeds', async () => {
    const fixture = buildScoredExamFixture(CEFRLevel.B1);
    let readingCalls = 0;
    const provider: AiProvider = {
      id: 'mock',
      displayName: 'Mock',
      generateText: vi.fn(),
      generateJson: vi.fn(async request => {
        const moduleId = moduleIdFromMessages(request.messages);
        if (moduleId === 'reading') {
          readingCalls += 1;
          if (readingCalls === 1) return { objectiveQuestions: [] } as never;
          return { objectiveQuestions: fixture.modules.find(m => m.id === 'reading')!.objectiveQuestions } as never;
        }
        return moduleResponse(fixture, moduleId) as never;
      }),
    };
    const exam = await generateGoetheExam({ level: CEFRLevel.B1, aiProvider: provider });
    expect(readingCalls).toBeGreaterThanOrEqual(2);
    expect(exam.modules.find(m => m.id === 'reading')!.objectiveQuestions.length).toBeGreaterThan(0);
  });

  it('throws ExamGenerationError naming the module after exhausting attempts', async () => {
    const fixture = buildScoredExamFixture(CEFRLevel.B1);
    const provider: AiProvider = {
      id: 'mock',
      displayName: 'Mock',
      generateText: vi.fn(),
      generateJson: vi.fn(async request => {
        const moduleId = moduleIdFromMessages(request.messages);
        if (moduleId === 'writing') return { productiveTasks: [] } as never;
        return moduleResponse(fixture, moduleId) as never;
      }),
    };
    await expect(
      generateGoetheExam({ level: CEFRLevel.B1, aiProvider: provider })
    ).rejects.toMatchObject({ name: 'ExamGenerationError', moduleId: 'writing' });
  });
});

describe('scoreGoetheExam', () => {
  it('scores objective and productive exam answers into module results', () => {
    const exam = buildScoredExamFixture(CEFRLevel.B1);
    const objective: Record<string, number> = {};
    for (const module of exam.modules) {
      for (const q of module.objectiveQuestions) objective[q.id] = q.correctOptionIndex;
    }
    const productive: Record<string, string> = {};
    for (const module of exam.modules) {
      for (const t of module.productiveTasks) {
        productive[t.id] = Array.from(
          { length: 12 },
          (_, s) =>
            `Satz ${s + 1}: Ich moechte das Thema klar und ausfuehrlich behandeln, weil die Aufgabe das verlangt und ich genug Woerter schreiben kann.`
        ).join(' ');
      }
    }
    const result = scoreGoetheExam(exam, { objective, productive });
    expect(result.percentage).toBeGreaterThanOrEqual(60);
    expect(result.passed).toBe(true);
    expect(result.moduleResults).toHaveLength(4);
  });

  it('keeps B1 durations and certificate point conversion', () => {
    const exam = buildScoredExamFixture(CEFRLevel.B1);
    expect(exam.modules.map(m => m.durationMinutes)).toEqual([40, 65, 60, 15]);
    const result = scoreGoetheExam(exam, { objective: {}, productive: {} });
    const listening = result.moduleResults.find(m => m.moduleId === 'listening')!;
    expect(listening.possiblePoints).toBe(100);
  });
});
