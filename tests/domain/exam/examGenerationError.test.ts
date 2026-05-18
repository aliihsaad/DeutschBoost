import { describe, expect, it } from 'vitest';
import { ExamGenerationError } from '../../../src/domain/exam/examGenerationError';

describe('ExamGenerationError', () => {
  it('carries the failed module id and reasons and is an Error', () => {
    const error = new ExamGenerationError('reading', ['no questions', 'duplicate prompt']);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ExamGenerationError');
    expect(error.moduleId).toBe('reading');
    expect(error.reasons).toEqual(['no questions', 'duplicate prompt']);
    expect(error.message).toContain('reading');
    expect(error.message).toContain('no questions');
  });

  it('supports a generic (no module) generation failure', () => {
    const error = new ExamGenerationError(null, ['no AI provider configured']);
    expect(error.moduleId).toBeNull();
    expect(error.message).toContain('no AI provider configured');
  });
});
