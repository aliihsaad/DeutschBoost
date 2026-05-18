import { describe, expect, it } from 'vitest';
import { createExamBlueprint, MODULE_ORDER } from '../../../src/domain/exam/examTemplates';
import { CEFRLevel } from '../../../types';

describe('createExamBlueprint', () => {
  it('builds the B1 structural blueprint with empty content arrays', () => {
    const exam = createExamBlueprint({
      level: CEFRLevel.B1,
      idFactory: () => 'exam-b1',
      now: () => '2026-05-18T00:00:00.000Z',
    });
    expect(exam.id).toBe('exam-b1');
    expect(exam.passThreshold).toBe(60);
    expect(exam.modules.map(m => m.id)).toEqual(MODULE_ORDER);
    expect(exam.modules.map(m => m.durationMinutes)).toEqual([40, 65, 60, 15]);
    expect(exam.templateName).toBe('Goethe-Zertifikat B1 public model-test profile');
    for (const module of exam.modules) {
      expect(module.objectiveQuestions).toEqual([]);
      expect(module.productiveTasks).toEqual([]);
      expect(module.templateParts.length).toBeGreaterThan(0);
    }
  });

  it('builds A1 and A2 blueprints with their real durations', () => {
    expect(
      createExamBlueprint({ level: CEFRLevel.A1 }).modules.map(m => m.durationMinutes)
    ).toEqual([20, 25, 20, 15]);
    expect(
      createExamBlueprint({ level: CEFRLevel.A2 }).modules.map(m => m.durationMinutes)
    ).toEqual([30, 30, 30, 15]);
  });
});
