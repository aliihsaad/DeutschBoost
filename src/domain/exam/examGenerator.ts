import type { AiProvider } from '../ai/aiProvider';
import type {
  ExamAnswerSet,
  ExamCriterionDefinition,
  ExamCriterionScore,
  ExamModule,
  ExamModuleId,
  ExamModuleResult,
  ExamPartResult,
  ExamProductiveTask,
  ExamResult,
  GoetheExam,
} from './examTypes';
import { createExamBlueprint, type ExamBlueprintInput } from './examTemplates';
import { validateObjectiveModule, validateProductiveModule } from './examModuleSchema';
import { buildModuleMessages } from './examModulePrompt';
import { ExamGenerationError } from './examGenerationError';
import { CEFRLevel } from '../../../types';

interface GenerateGoetheExamInput extends ExamBlueprintInput {
  aiProvider?: AiProvider;
}

const MAX_MODULE_ATTEMPTS = 3;

const B1_OBJECTIVE_SCORE_POINTS = [
  0, 3, 7, 10, 13, 17, 20, 23, 27, 30, 33,
  37, 40, 43, 47, 50, 53, 57, 60, 63, 67,
  70, 73, 77, 80, 83, 87, 90, 93, 97, 100,
];

export async function generateGoetheExam(input: GenerateGoetheExamInput): Promise<GoetheExam> {
  const exam = createExamBlueprint(input);

  if (!input.aiProvider) {
    throw new ExamGenerationError(null, ['no AI provider configured — open Settings and enable AI']);
  }
  const aiProvider = input.aiProvider;

  const generatedModules = await Promise.all(
    exam.modules.map(module => generateModule(aiProvider, exam.level, module))
  );

  return { ...exam, modules: generatedModules };
}

async function generateModule(
  aiProvider: AiProvider,
  level: CEFRLevel,
  module: ExamModule
): Promise<ExamModule> {
  const isObjective = module.id === 'listening' || module.id === 'reading';
  let lastErrors: string[] = ['no attempts ran'];
  let previousOutput: string | undefined;

  for (let attempt = 1; attempt <= MAX_MODULE_ATTEMPTS; attempt += 1) {
    const repair =
      attempt > 1 && previousOutput ? { previousOutput, errors: lastErrors } : undefined;

    let raw: unknown;
    try {
      raw = await aiProvider.generateJson<unknown>({
        feature: `goethe-exam-${module.id}`,
        schemaName: `DeutschBoostExamModule_${module.id}`,
        options: { temperature: 0.5, maxTokens: 4000 },
        messages: buildModuleMessages(level, module, repair),
      });
    } catch (error) {
      lastErrors = [error instanceof Error ? error.message : 'AI call failed'];
      previousOutput = undefined;
      continue;
    }

    previousOutput = JSON.stringify(raw);

    if (isObjective) {
      const result = validateObjectiveModule(module, raw);
      if (result.ok) {
        return { ...module, objectiveQuestions: result.questions, productiveTasks: [] };
      }
      lastErrors = result.errors;
    } else {
      const result = validateProductiveModule(module, raw);
      if (result.ok) {
        return { ...module, objectiveQuestions: [], productiveTasks: result.tasks };
      }
      lastErrors = result.errors;
    }
  }

  throw new ExamGenerationError(module.id, lastErrors);
}

export function scoreGoetheExam(exam: GoetheExam, answers: ExamAnswerSet): ExamResult {
  const wholeExamScoring = usesWholeExamScoring(exam.level);
  const moduleResults = exam.modules.map(module => {
    const partResults = scoreModuleParts(module, answers);
    const rawEarnedPoints = partResults.reduce((sum, result) => sum + result.earnedPoints, 0);
    const rawPossiblePoints = partResults.reduce((sum, result) => sum + result.possiblePoints, 0);
    const earnedPoints = wholeExamScoring
      ? convertWholeExamSectionPoints(exam.level, module, rawEarnedPoints)
      : convertRawScoreToCertificatePoints(module, rawEarnedPoints, rawPossiblePoints);
    const possiblePoints = wholeExamScoring ? 25 : 100;
    const lostPoints = possiblePoints - earnedPoints;
    const percentage = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;

    return {
      moduleId: module.id,
      germanLabel: module.germanLabel,
      englishLabel: module.englishLabel,
      rawEarnedPoints,
      rawPossiblePoints,
      earnedPoints,
      possiblePoints,
      lostPoints,
      percentage,
      passed: percentage >= exam.passThreshold,
      rating: describeGoetheRating(percentage),
      partResults,
    };
  });

  const totalEarnedPoints = moduleResults.reduce((sum, result) => sum + result.earnedPoints, 0);
  const totalPossiblePoints = moduleResults.reduce((sum, result) => sum + result.possiblePoints, 0);
  const percentage = totalPossiblePoints > 0 ? Math.round((totalEarnedPoints / totalPossiblePoints) * 100) : 0;
  const passed = wholeExamScoring
    ? wholeExamPassed(exam.level, moduleResults, percentage)
    : moduleResults.every(result => result.passed);

  return {
    totalEarnedPoints,
    totalPossiblePoints,
    percentage,
    passed,
    moduleResults,
    summary: summarizeResult(exam.level, moduleResults, percentage, passed),
  };
}

function scoreModuleParts(module: ExamModule, answers: ExamAnswerSet): ExamPartResult[] {
  const templateResults = module.templateParts.map(partSpec => {
    const questions = module.objectiveQuestions.filter(question => question.partId === partSpec.id);
    const tasks = module.productiveTasks.filter(task => task.partId === partSpec.id);

    if (questions.length > 0) {
      const earnedPoints = questions.reduce(
        (sum, question) => sum + (answers.objective[question.id] === question.correctOptionIndex ? question.points : 0),
        0
      );
      const possiblePoints = partSpec.maxPoints ?? questions.reduce((sum, question) => sum + question.points, 0);

      return {
        partId: partSpec.id,
        title: partSpec.title,
        earnedPoints,
        possiblePoints,
        lostPoints: Math.max(0, possiblePoints - earnedPoints),
        percentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
        scoringNote: partSpec.scoringNote ?? '1 raw point per correct answer; wrong answers receive 0 points.',
      };
    }

    if (tasks.length > 0 || partSpec.criteria?.length) {
      const scoringTasks = tasks.length > 0 ? tasks : [{
        id: `${module.id}-${partSpec.id}`,
        moduleId: module.id as Extract<ExamModuleId, 'writing' | 'speaking'>,
        partId: partSpec.id,
        prompt: partSpec.promptGuidance,
        points: partSpec.maxPoints ?? 0,
        rubric: partSpec.criteria?.map(criterion => criterion.label) ?? [],
      }];
      const productiveAnswer = partSpec.id === 'pronunciation'
        ? module.productiveTasks.map(task => answers.productive[task.id] ?? '').join('\n\n')
        : scoringTasks.map(task => answers.productive[task.id] ?? '').join('\n\n');
      const criteria = scoreProductiveCriteria(
        productiveAnswer,
        partSpec.criteria,
        partSpec.maxPoints ?? scoringTasks.reduce((sum, task) => sum + task.points, 0),
        scoringTasks.reduce((minWords, task) => Math.max(minWords, task.minWords ?? 60), 60)
      );
      const earnedPoints = criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0);
      const possiblePoints = criteria.reduce((sum, criterion) => sum + criterion.possiblePoints, 0);

      return {
        partId: partSpec.id,
        title: partSpec.title,
        earnedPoints,
        possiblePoints,
        lostPoints: Math.max(0, possiblePoints - earnedPoints),
        percentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
        scoringNote: partSpec.scoringNote ?? 'Simulator rubric score; official exams use trained examiners and designated point values.',
        criteria,
      };
    }

    return null;
  });

  const results = templateResults.filter((result): result is ExamPartResult => result !== null);

  if (results.length > 0) {
    return results;
  }

  return scoreLegacyModuleParts(module, answers);
}

function convertRawScoreToCertificatePoints(
  module: ExamModule,
  rawEarnedPoints: number,
  rawPossiblePoints: number
): number {
  if (rawPossiblePoints <= 0) {
    return 0;
  }

  if (
    (module.id === 'reading' || module.id === 'listening') &&
    rawPossiblePoints === 30 &&
    rawEarnedPoints >= 0 &&
    rawEarnedPoints <= 30
  ) {
    return B1_OBJECTIVE_SCORE_POINTS[Math.round(rawEarnedPoints)] ?? 0;
  }

  return Math.round((rawEarnedPoints / rawPossiblePoints) * 100);
}

function usesWholeExamScoring(level: CEFRLevel): boolean {
  return level === CEFRLevel.A1 || level === CEFRLevel.A2;
}

function convertWholeExamSectionPoints(
  level: CEFRLevel,
  module: ExamModule,
  rawEarnedPoints: number
): number {
  if (level === CEFRLevel.A1) {
    return Math.min(25, Math.round(rawEarnedPoints * 1.66));
  }

  if (module.id === 'speaking') {
    return Math.min(25, Math.round(rawEarnedPoints));
  }

  return Math.min(25, Math.round(rawEarnedPoints * 1.25));
}

function wholeExamPassed(
  level: CEFRLevel,
  moduleResults: ExamModuleResult[],
  percentage: number
): boolean {
  if (percentage < 60) {
    return false;
  }

  if (level === CEFRLevel.A2) {
    const writtenPoints = modulePoints(moduleResults, 'listening')
      + modulePoints(moduleResults, 'reading')
      + modulePoints(moduleResults, 'writing');
    const oralPoints = modulePoints(moduleResults, 'speaking');

    return writtenPoints >= 45 && oralPoints >= 15;
  }

  return moduleResults.every(result => result.rawEarnedPoints > 0);
}

function summarizeResult(
  level: CEFRLevel,
  moduleResults: ExamModuleResult[],
  percentage: number,
  passed: boolean
): string {
  if (passed) {
    return `Passed the simulated ${level} exam.`;
  }

  if (level === CEFRLevel.A2 && percentage >= 60) {
    const writtenPoints = modulePoints(moduleResults, 'listening')
      + modulePoints(moduleResults, 'reading')
      + modulePoints(moduleResults, 'writing');
    const oralPoints = modulePoints(moduleResults, 'speaking');

    if (oralPoints < 15) {
      return 'Needs at least 15 points in the oral section before the simulated A2 pass threshold is met.';
    }
    if (writtenPoints < 45) {
      return 'Needs at least 45 points across the written sections before the simulated A2 pass threshold is met.';
    }
  }

  return `Needs more work before the simulated ${level} pass threshold.`;
}

function modulePoints(moduleResults: ExamModuleResult[], moduleId: ExamModuleId): number {
  return moduleResults.find(result => result.moduleId === moduleId)?.earnedPoints ?? 0;
}

function scoreLegacyModuleParts(module: ExamModule, answers: ExamAnswerSet): ExamPartResult[] {
  const earnedObjective = module.objectiveQuestions.reduce(
    (sum, question) => sum + (answers.objective[question.id] === question.correctOptionIndex ? question.points : 0),
    0
  );
  const possibleObjective = module.objectiveQuestions.reduce((sum, question) => sum + question.points, 0);
  const earnedProductive = module.productiveTasks.reduce(
    (sum, task) => sum + scoreProductiveAnswer(answers.productive[task.id] ?? '', task),
    0
  );
  const possibleProductive = module.productiveTasks.reduce((sum, task) => sum + task.points, 0);
  const possiblePoints = possibleObjective + possibleProductive;
  const earnedPoints = earnedObjective + earnedProductive;

  return [{
    partId: module.id,
    title: module.germanLabel,
    earnedPoints,
    possiblePoints,
    lostPoints: Math.max(0, possiblePoints - earnedPoints),
    percentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
    scoringNote: 'Simulator score.',
  }];
}

function scoreProductiveCriteria(
  answer: string,
  criteria: ExamCriterionDefinition[] | undefined,
  fallbackPossiblePoints: number,
  minWords = 60
): ExamCriterionScore[] {
  const definitions = criteria && criteria.length > 0
    ? criteria
    : [{ id: 'response', label: 'Response', maxPoints: fallbackPossiblePoints }];
  const band = scoreProductiveBand(answer, minWords);

  return definitions.map(criterion => {
    const earnedPoints = pointsForBand(criterion.maxPoints, band);

    return {
      criterionId: criterion.id,
      label: criterion.label,
      band,
      earnedPoints,
      possiblePoints: criterion.maxPoints,
      lostPoints: Math.max(0, criterion.maxPoints - earnedPoints),
    };
  });
}

function scoreProductiveAnswer(answer: string, task: ExamProductiveTask): number {
  return scoreProductiveAnswerByMax(answer, task.points, task.minWords);
}

function scoreProductiveAnswerByMax(answer: string, maxPoints: number, minWords = 60): number {
  return pointsForBand(maxPoints, scoreProductiveBand(answer, minWords));
}

function scoreProductiveBand(answer: string, minWords = 60): ExamCriterionScore['band'] {
  const normalized = answer.trim();
  if (!normalized) {
    return 'E';
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const enoughLength = Math.min(1, words.length / minWords);
  const germanSignal = /\b(ich|wir|sie|der|die|das|und|weil|dass|nicht|mit|fuer|moechte|kann|habe|bin)\b/i.test(normalized)
    ? 1
    : 0.35;
  const sentenceShape = /[.!?]/.test(normalized) ? 1 : 0.5;
  const scoreRatio = (enoughLength * 0.5) + (germanSignal * 0.3) + (sentenceShape * 0.2);

  if (scoreRatio >= 0.88) {
    return 'A';
  }
  if (scoreRatio >= 0.68) {
    return 'B';
  }
  if (scoreRatio >= 0.45) {
    return 'C';
  }
  if (scoreRatio >= 0.2) {
    return 'D';
  }
  return 'E';
}

function pointsForBand(maxPoints: number, band: ExamCriterionScore['band']): number {
  const ratioByBand: Record<ExamCriterionScore['band'], number> = {
    A: 1,
    B: 0.75,
    C: 0.5,
    D: 0.25,
    E: 0,
  };

  return maxPoints * ratioByBand[band];
}

function describeGoetheRating(points: number): string {
  if (points >= 90) {
    return 'very good';
  }
  if (points >= 80) {
    return 'good';
  }
  if (points >= 70) {
    return 'satisfactory';
  }
  if (points >= 60) {
    return 'pass';
  }
  return 'fail';
}
