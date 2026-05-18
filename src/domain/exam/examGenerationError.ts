import type { ExamModuleId } from './examTypes';

export class ExamGenerationError extends Error {
  readonly moduleId: ExamModuleId | null;
  readonly reasons: string[];

  constructor(moduleId: ExamModuleId | null, reasons: string[]) {
    const scope = moduleId ? `module "${moduleId}"` : 'exam';
    super(`Exam generation failed for ${scope}: ${reasons.join('; ')}`);
    this.name = 'ExamGenerationError';
    this.moduleId = moduleId;
    this.reasons = reasons;
  }
}

export const isExamGenerationError = (value: unknown): value is ExamGenerationError =>
  value instanceof ExamGenerationError;
