import { describe, expect, it, vi } from 'vitest';
import {
  createFallbackGoetheExam,
  generateGoetheExam,
  scoreGoetheExam,
} from '../../../src/domain/exam/examGenerator';
import { CEFRLevel } from '../../../types';

describe('Goethe exam generation and scoring', () => {
  it('creates a full local B1 exam with official-style modules and timing', () => {
    const exam = createFallbackGoetheExam({
      level: CEFRLevel.B1,
      now: () => '2026-05-18T10:00:00.000Z',
      idFactory: () => 'exam-b1',
    });

    expect(exam.id).toBe('exam-b1');
    expect(exam.passThreshold).toBe(60);
    expect(exam.modules.map(module => module.id)).toEqual(['listening', 'reading', 'writing', 'speaking']);
    expect(exam.modules.map(module => module.durationMinutes)).toEqual([40, 65, 60, 15]);
    expect(exam.sourceNotes.join(' ')).toMatch(/Goethe/);
  });

  it('uses fixed Goethe public template metadata for every generated module', () => {
    const exam = createFallbackGoetheExam({
      level: CEFRLevel.B1,
      now: () => '2026-05-18T10:00:00.000Z',
      idFactory: () => 'exam-b1',
    });

    expect(exam.templateName).toBe('Goethe-Zertifikat B1 public model-test profile');
    expect(exam.officialSources.map(source => source.url)).toEqual(
      expect.arrayContaining([
        'https://www.goethe.de/ins/us/en/m/spr/prf/gzb1.cfm',
        'https://bfu.goethe.de/b1_mod/lesen.php',
      ])
    );
    expect(exam.modules.find(module => module.id === 'reading')?.templateParts).toEqual([
      expect.objectContaining({ title: 'Teil 1', taskFamily: 'Blog post / longer informational text' }),
      expect.objectContaining({ title: 'Teil 2', taskFamily: 'Press text with opinion/detail questions' }),
      expect.objectContaining({ title: 'Teil 3', taskFamily: 'Short notices and advertisements' }),
      expect.objectContaining({ title: 'Teil 4', taskFamily: 'Matching statements to opinions' }),
      expect.objectContaining({ title: 'Teil 5', taskFamily: 'Instructions or rules text' }),
    ]);
  });

  it('scores objective and productive exam answers into module results', () => {
    const exam = createFallbackGoetheExam({ level: CEFRLevel.B1 });
    const answers = {
      objective: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.objectiveQuestions.map(question => [question.id, question.correctOptionIndex])
        )
      ),
      productive: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.productiveTasks.map(task => [task.id, germanExamAnswer(90)])
        )
      ),
    };

    const result = scoreGoetheExam(exam, answers);

    expect(result.percentage).toBeGreaterThanOrEqual(60);
    expect(result.passed).toBe(true);
    expect(result.moduleResults).toHaveLength(4);
  });

  it('reports B1 module results using public Goethe-style raw points, certificate points, and deductions', () => {
    const exam = createFallbackGoetheExam({ level: CEFRLevel.B1 });
    const firstListeningQuestion = exam.modules
      .find(module => module.id === 'listening')!
      .objectiveQuestions[0];
    const answers = {
      objective: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.objectiveQuestions.map(question => [
            question.id,
            question.id === firstListeningQuestion.id
              ? (question.correctOptionIndex + 1) % question.options.length
              : question.correctOptionIndex,
          ])
        )
      ),
      productive: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.productiveTasks.map(task => [task.id, germanExamAnswer(90)])
        )
      ),
    };

    const result = scoreGoetheExam(exam, answers);
    const listening = result.moduleResults.find(module => module.moduleId === 'listening')!;
    const writing = result.moduleResults.find(module => module.moduleId === 'writing')!;
    const speaking = result.moduleResults.find(module => module.moduleId === 'speaking')!;

    expect(listening.rawPossiblePoints).toBe(30);
    expect(listening.possiblePoints).toBe(100);
    expect(listening.rawEarnedPoints).toBe(29);
    expect(listening.earnedPoints).toBe(97);
    expect(listening.partResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partId: 'teil-1',
          possiblePoints: 10,
          lostPoints: 1,
          scoringNote: '1 raw point per correct answer; wrong answers receive 0 points.',
        }),
      ])
    );
    expect(writing.possiblePoints).toBe(100);
    expect(writing.partResults[0].criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Erfuellung', possiblePoints: 10 }),
        expect.objectContaining({ label: 'Strukturen', possiblePoints: 10, band: 'A' }),
      ])
    );
    expect(speaking.partResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ partId: 'pronunciation', possiblePoints: 16 }),
      ])
    );
  });

  it('creates public non-B1 blueprints with real part counts and scoring totals', () => {
    const a1 = createFallbackGoetheExam({ level: CEFRLevel.A1 });
    expect(a1.modules.map(module => module.durationMinutes)).toEqual([20, 25, 20, 15]);
    expect(objectivePartPoints(a1, 'listening')).toEqual([6, 4, 5]);
    expect(objectivePartPoints(a1, 'reading')).toEqual([5, 5, 5]);
    expect(templatePartPoints(a1, 'writing')).toEqual([5, 10]);
    expect(templatePartPoints(a1, 'speaking')).toEqual([3, 6, 6]);

    const a2 = createFallbackGoetheExam({ level: CEFRLevel.A2 });
    expect(a2.modules.map(module => module.durationMinutes)).toEqual([30, 30, 30, 15]);
    expect(sumObjectiveQuestionPoints(a2, 'listening')).toBe(20);
    expect(sumObjectiveQuestionPoints(a2, 'reading')).toBe(20);
    expect(sumTemplatePartPoints(a2, 'writing')).toBe(20);
    expect(sumTemplatePartPoints(a2, 'speaking')).toBe(25);

    const b2 = createFallbackGoetheExam({ level: CEFRLevel.B2 });
    expect(objectivePartPoints(b2, 'listening')).toEqual([10, 6, 6, 8]);
    expect(objectivePartPoints(b2, 'reading')).toEqual([9, 6, 6, 6, 3]);
    expect(sumTemplatePartPoints(b2, 'writing')).toBe(100);
    expect(sumTemplatePartPoints(b2, 'speaking')).toBe(100);

    const c1 = createFallbackGoetheExam({ level: CEFRLevel.C1 });
    expect(objectivePartCounts(c1, 'listening')).toEqual([6, 9, 8, 7]);
    expect(objectivePartCounts(c1, 'reading')).toEqual([8, 7, 8, 7]);
    expect(sumObjectiveQuestionPoints(c1, 'listening')).toBe(30);
    expect(sumObjectiveQuestionPoints(c1, 'reading')).toBe(30);

    const c2 = createFallbackGoetheExam({ level: CEFRLevel.C2 });
    expect(objectivePartPoints(c2, 'listening')).toEqual([30, 20, 50]);
    expect(objectivePartPoints(c2, 'reading')).toEqual([40, 18, 18, 24]);
    expect(sumTemplatePartPoints(c2, 'writing')).toBe(100);
    expect(sumTemplatePartPoints(c2, 'speaking')).toBe(100);
  });

  it('scores A2 as a single 100-point exam with 25-point sections and written/oral gates', () => {
    const exam = createFallbackGoetheExam({ level: CEFRLevel.A2 });
    const answers = {
      objective: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.objectiveQuestions.map(question => [question.id, question.correctOptionIndex])
        )
      ),
      productive: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.productiveTasks.map(task => [task.id, germanExamAnswer(100)])
        )
      ),
    };

    const passingResult = scoreGoetheExam(exam, answers);

    expect(passingResult.totalPossiblePoints).toBe(100);
    expect(passingResult.percentage).toBe(100);
    expect(passingResult.passed).toBe(true);
    expect(passingResult.moduleResults.map(module => module.possiblePoints)).toEqual([25, 25, 25, 25]);

    const missingSpeaking = scoreGoetheExam(exam, {
      ...answers,
      productive: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.productiveTasks.map(task => [
            task.id,
            task.moduleId === 'speaking' ? '' : germanExamAnswer(100),
          ])
        )
      ),
    });

    expect(missingSpeaking.percentage).toBeGreaterThanOrEqual(60);
    expect(missingSpeaking.passed).toBe(false);
    expect(missingSpeaking.summary).toMatch(/oral/i);
  });

  it('converts C1 objective modules from 30 raw checkpoints to 100 certificate points', () => {
    const exam = createFallbackGoetheExam({ level: CEFRLevel.C1 });
    const firstReadingQuestion = exam.modules.find(module => module.id === 'reading')!.objectiveQuestions[0];
    const answers = {
      objective: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.objectiveQuestions.map(question => [
            question.id,
            question.id === firstReadingQuestion.id
              ? (question.correctOptionIndex + 1) % question.options.length
              : question.correctOptionIndex,
          ])
        )
      ),
      productive: Object.fromEntries(
        exam.modules.flatMap(module =>
          module.productiveTasks.map(task => [task.id, germanExamAnswer(120)])
        )
      ),
    };

    const reading = scoreGoetheExam(exam, answers).moduleResults.find(module => module.moduleId === 'reading')!;

    expect(reading.rawPossiblePoints).toBe(30);
    expect(reading.rawEarnedPoints).toBe(29);
    expect(reading.possiblePoints).toBe(100);
    expect(reading.earnedPoints).toBe(97);
  });

  it('asks the AI provider for original exam content and falls back safely when output is incomplete', async () => {
    const aiProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({ title: 'AI generated test', modules: [] }),
    };

    const exam = await generateGoetheExam({
      level: CEFRLevel.B2,
      aiProvider,
      idFactory: () => 'exam-ai',
    });

    expect(aiProvider.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'goethe-exam-simulator-generation',
      })
    );
    expect(exam.id).toBe('exam-ai');
    expect(exam.modules.map(module => module.id)).toEqual(['listening', 'reading', 'writing', 'speaking']);
  });

  it('passes the exact public exam blueprint to the AI provider', async () => {
    const aiProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({ title: 'AI generated test', modules: [] }),
    };

    await generateGoetheExam({
      level: CEFRLevel.A2,
      aiProvider,
      idFactory: () => 'exam-ai',
    });

    const request = aiProvider.generateJson.mock.calls[0][0];
    const prompt = JSON.parse(request.messages[1].content);

    expect(prompt.constraints.templateName).toBe('Goethe-Zertifikat A2 public model-test profile');
    expect(prompt.constraints.officialSourceUrls).toEqual(
      expect.arrayContaining([
        'https://www.goethe.de/ins/us/en/spr/prf/gzsd2.cfm',
        'https://bfu.goethe.de/a2_mod_2MX5/lesen.php',
      ])
    );
    expect(prompt.constraints.moduleBlueprints.find((module: { id: string }) => module.id === 'listening')).toEqual(
      expect.objectContaining({
        id: 'listening',
        durationMinutes: 30,
        parts: [
          expect.objectContaining({ title: 'Teil 1' }),
          expect.objectContaining({ title: 'Teil 2' }),
          expect.objectContaining({ title: 'Teil 3' }),
          expect.objectContaining({ title: 'Teil 4' }),
        ],
      })
    );
  });

  it('passes weighted C2 public scoring blueprints to the AI provider', async () => {
    const aiProvider = {
      id: 'openrouter',
      displayName: 'OpenRouter',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({ title: 'AI generated test', modules: [] }),
    };

    await generateGoetheExam({
      level: CEFRLevel.C2,
      aiProvider,
      idFactory: () => 'exam-ai',
    });

    const request = aiProvider.generateJson.mock.calls[0][0];
    const prompt = JSON.parse(request.messages[1].content);
    const listening = prompt.constraints.moduleBlueprints.find((module: { id: string }) => module.id === 'listening');
    const reading = prompt.constraints.moduleBlueprints.find((module: { id: string }) => module.id === 'reading');

    expect(listening.parts.map((part: { questionCount: number; maxPoints: number }) => ({
      questionCount: part.questionCount,
      maxPoints: part.maxPoints,
    }))).toEqual([
      { questionCount: 15, maxPoints: 30 },
      { questionCount: 5, maxPoints: 20 },
      { questionCount: 10, maxPoints: 50 },
    ]);
    expect(reading.parts.map((part: { questionCount: number; maxPoints: number }) => ({
      questionCount: part.questionCount,
      maxPoints: part.maxPoints,
    }))).toEqual([
      { questionCount: 10, maxPoints: 40 },
      { questionCount: 6, maxPoints: 18 },
      { questionCount: 6, maxPoints: 18 },
      { questionCount: 8, maxPoints: 24 },
    ]);
  });
});

function germanExamAnswer(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, index) =>
    index % 10 === 0 ? 'Ich' : 'lerne'
  ).join(' ') + '.';
}

type Exam = ReturnType<typeof createFallbackGoetheExam>;
type ModuleId = Exam['modules'][number]['id'];

function findModule(exam: Exam, moduleId: ModuleId) {
  return exam.modules.find(module => module.id === moduleId)!;
}

function objectivePartCounts(exam: Exam, moduleId: ModuleId): number[] {
  const module = findModule(exam, moduleId);

  return module.templateParts.map(part =>
    module.objectiveQuestions.filter(question => question.partId === part.id).length
  );
}

function objectivePartPoints(exam: Exam, moduleId: ModuleId): number[] {
  const module = findModule(exam, moduleId);

  return module.templateParts.map(part =>
    module.objectiveQuestions
      .filter(question => question.partId === part.id)
      .reduce((sum, question) => sum + question.points, 0)
  );
}

function templatePartPoints(exam: Exam, moduleId: ModuleId): number[] {
  return findModule(exam, moduleId).templateParts.map(part => part.maxPoints ?? 0);
}

function sumObjectiveQuestionPoints(exam: Exam, moduleId: ModuleId): number {
  return findModule(exam, moduleId).objectiveQuestions.reduce((sum, question) => sum + question.points, 0);
}

function sumTemplatePartPoints(exam: Exam, moduleId: ModuleId): number {
  return findModule(exam, moduleId).templateParts.reduce((sum, part) => sum + (part.maxPoints ?? 0), 0);
}
