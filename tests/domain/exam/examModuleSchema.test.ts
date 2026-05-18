import { describe, expect, it } from 'vitest';
import { validateObjectiveModule, validateProductiveModule } from '../../../src/domain/exam/examModuleSchema';
import { createExamBlueprint } from '../../../src/domain/exam/examTemplates';
import { CEFRLevel } from '../../../types';

const blueprint = createExamBlueprint({ level: CEFRLevel.A1 });
const reading = blueprint.modules.find(m => m.id === 'reading')!;
const writing = blueprint.modules.find(m => m.id === 'writing')!;

function goodReadingQuestions() {
  return reading.templateParts.flatMap((part, p) =>
    Array.from({ length: part.questionCount ?? 1 }, (_, i) => ({
      id: `r-${p}-${i}`,
      partId: part.id,
      passage: `Aushang ${p}-${i}: Die Bibliothek hat am Samstag von 9 bis 13 Uhr geoeffnet.`,
      prompt: `Frage ${p}-${i}: Wann ist die Bibliothek am Samstag geoeffnet?`,
      options: [`9 bis 13 Uhr (${p}-${i})`, `nur sonntags (${p}-${i})`, `gar nicht (${p}-${i})`],
      correctOptionIndex: 0,
      points: 1,
      explanation: 'Steht direkt im Text.',
    }))
  );
}

describe('validateObjectiveModule', () => {
  it('accepts well-formed unique reading questions', () => {
    const result = validateObjectiveModule(reading, { objectiveQuestions: goodReadingQuestions() });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.questions.length).toBe(goodReadingQuestions().length);
  });

  it('rejects skeleton/prompt-leak content', () => {
    const result = validateObjectiveModule(reading, {
      objectiveQuestions: [{
        id: 'x', partId: 'teil-1',
        passage: 'Text Teil 1.1: Ein originaler A1-Lesetext im Stil "Short letters". Die Loesung ist im Text direkt oder indirekt enthalten.',
        prompt: 'Aussage 1: Die Aussage passt zum Text.',
        options: ['Option a aus dem Text', 'Option b aus dem Text'],
        correctOptionIndex: 0, points: 1,
      }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/placeholder|skeleton|leak/i);
  });

  it('rejects duplicate prompts within the module', () => {
    const dup = goodReadingQuestions();
    dup[1] = { ...dup[1], prompt: dup[0].prompt, passage: dup[0].passage, options: [...dup[0].options] };
    const result = validateObjectiveModule(reading, { objectiveQuestions: dup });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/duplicate/i);
  });

  it('rejects out-of-range correctOptionIndex', () => {
    const q = goodReadingQuestions();
    q[0] = { ...q[0], correctOptionIndex: 9 };
    const result = validateObjectiveModule(reading, { objectiveQuestions: q });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty module', () => {
    expect(validateObjectiveModule(reading, { objectiveQuestions: [] }).ok).toBe(false);
    expect(validateObjectiveModule(reading, {}).ok).toBe(false);
  });
});

describe('validateProductiveModule', () => {
  it('accepts unique productive tasks with prompts and rubric', () => {
    const tasks = writing.templateParts.map((part, i) => ({
      id: `w-${i}`, partId: part.id, moduleId: 'writing',
      prompt: `Aufgabe ${i}: Schreiben Sie eine kurze Nachricht an Ihre Nachbarin ueber das Treffen am ${i + 1}. Mai.`,
      minWords: 30, points: 10, rubric: ['Inhalt', 'Sprache'],
    }));
    const result = validateProductiveModule(writing, { productiveTasks: tasks });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tasks.length).toBe(writing.templateParts.length);
  });

  it('rejects duplicate or empty productive prompts', () => {
    expect(validateProductiveModule(writing, { productiveTasks: [] }).ok).toBe(false);
    const tasks = writing.templateParts.map((part) => ({
      id: `w-${part.id}`, partId: part.id, moduleId: 'writing',
      prompt: 'Schreiben Sie einen Text.', points: 10, rubric: ['Inhalt'],
    }));
    expect(validateProductiveModule(writing, { productiveTasks: tasks }).ok).toBe(false);
  });
});
