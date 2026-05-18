import { describe, expect, it } from 'vitest';
import { buildModuleMessages } from '../../../src/domain/exam/examModulePrompt';
import { createExamBlueprint } from '../../../src/domain/exam/examTemplates';
import { CEFRLevel } from '../../../types';

const reading = createExamBlueprint({ level: CEFRLevel.B1 }).modules.find(m => m.id === 'reading')!;

describe('buildModuleMessages', () => {
  it('builds system+user messages naming the module and forbidding placeholders', () => {
    const messages = buildModuleMessages(CEFRLevel.B1, reading);
    expect(messages[0].role).toBe('system');
    const all = messages.map(m => m.content).join('\n');
    expect(all).toContain('reading');
    expect(all).toMatch(/placeholder|do not/i);
    expect(all).toContain('objectiveQuestions');
  });

  it('adds a repair turn with the previous output and errors when repairing', () => {
    const messages = buildModuleMessages(CEFRLevel.B1, reading, {
      previousOutput: '{"objectiveQuestions":[]}',
      errors: ['module "reading" returned no objectiveQuestions'],
    });
    const all = messages.map(m => m.content).join('\n');
    expect(all).toContain('returned no objectiveQuestions');
    expect(all).toContain('{"objectiveQuestions":[]}');
  });
});
