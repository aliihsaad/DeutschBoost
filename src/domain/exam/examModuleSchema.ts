import type { ExamModule, ExamObjectiveQuestion, ExamProductiveTask } from './examTypes';

export type ObjectiveValidation =
  | { ok: true; questions: ExamObjectiveQuestion[] }
  | { ok: false; errors: string[] };

export type ProductiveValidation =
  | { ok: true; tasks: ExamProductiveTask[] }
  | { ok: false; errors: string[] };

// Patterns that mean the model echoed our scaffolding instead of real content.
const SKELETON_PATTERNS: RegExp[] = [
  /Option\s+[a-d]\s+aus dem (Text|Hoertext)/i,
  /originaler\s+\S+[- ]?Lesetext im Stil/i,
  /Die Loesung ist im Text direkt oder indirekt enthalten/i,
  /Aussage\s+\d+:\s*Die Aussage passt zum Text/i,
  /Die gehoerte Information passt zur Situation/i,
  /\b(Audio script|Hoertext|Hörtext)\b/i,
  /kurze .*Situation|wichtige Information/i,
  /\bplaceholder\b/i,
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function looksLikeSkeleton(text: string): boolean {
  return SKELETON_PATTERNS.some(pattern => pattern.test(text));
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function validateObjectiveModule(blueprint: ExamModule, raw: unknown): ObjectiveValidation {
  const errors: string[] = [];
  const root = asRecord(raw);
  const list = Array.isArray(root.objectiveQuestions) ? root.objectiveQuestions : [];
  const expected = blueprint.templateParts.reduce(
    (sum, part) => sum + Math.max(1, part.questionCount ?? part.maxPoints ?? 1),
    0
  );

  if (list.length === 0) {
    return { ok: false, errors: [`module "${blueprint.id}" returned no objectiveQuestions`] };
  }
  if (list.length < expected) {
    errors.push(`module "${blueprint.id}" returned ${list.length} questions, expected ${expected}`);
  }

  const questions: ExamObjectiveQuestion[] = [];
  const seenPrompts = new Set<string>();
  const seenPassages = new Set<string>();

  list.forEach((item, index) => {
    const record = asRecord(item);
    const prompt = str(record.prompt);
    const passage = str(record.passage);
    const options = Array.isArray(record.options)
      ? record.options
          .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
          .map(o => o.trim())
      : [];
    const correctOptionIndex =
      typeof record.correctOptionIndex === 'number' ? Math.round(record.correctOptionIndex) : -1;

    if (!prompt) {
      errors.push(`question ${index + 1}: missing prompt`);
      return;
    }
    if (options.length < 2) {
      errors.push(`question ${index + 1}: needs >=2 options`);
      return;
    }
    if (new Set(options.map(norm)).size !== options.length) {
      errors.push(`question ${index + 1}: duplicate options`);
      return;
    }
    if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      errors.push(`question ${index + 1}: correctOptionIndex ${correctOptionIndex} out of range`);
      return;
    }
    if (blueprint.id === 'listening' && !passage) {
      errors.push(`question ${index + 1}: listening item needs a hidden audio passage`);
      return;
    }
    const leakText = `${prompt} ${passage ?? ''} ${options.join(' ')}`;
    if (looksLikeSkeleton(leakText)) {
      errors.push(`question ${index + 1}: placeholder/skeleton leak detected`);
      return;
    }

    const promptKey = norm(prompt);
    if (seenPrompts.has(promptKey)) {
      errors.push(`question ${index + 1}: duplicate prompt within module`);
      return;
    }
    seenPrompts.add(promptKey);
    if (passage) {
      const passageKey = norm(passage);
      if (seenPassages.has(passageKey)) {
        errors.push(`question ${index + 1}: duplicate passage within module`);
        return;
      }
      seenPassages.add(passageKey);
    }

    const cappedOptions = options.slice(0, 4);
    questions.push({
      id: str(record.id) ?? `${blueprint.id}-${index + 1}`,
      moduleId: blueprint.id,
      partId: str(record.partId),
      passage,
      prompt,
      options: cappedOptions,
      correctOptionIndex: Math.min(correctOptionIndex, cappedOptions.length - 1),
      points: typeof record.points === 'number' && record.points > 0 ? record.points : 1,
      explanation: str(record.explanation),
    });
  });

  if (errors.length > 0 || questions.length === 0) {
    return {
      ok: false,
      errors: errors.length ? errors : [`module "${blueprint.id}" produced no valid questions`],
    };
  }
  return { ok: true, questions };
}

export function validateProductiveModule(blueprint: ExamModule, raw: unknown): ProductiveValidation {
  const errors: string[] = [];
  const root = asRecord(raw);
  const list = Array.isArray(root.productiveTasks) ? root.productiveTasks : [];
  const moduleId = blueprint.id === 'speaking' ? 'speaking' : 'writing';

  if (list.length === 0) {
    return { ok: false, errors: [`module "${blueprint.id}" returned no productiveTasks`] };
  }

  const tasks: ExamProductiveTask[] = [];
  const seen = new Set<string>();

  list.forEach((item, index) => {
    const record = asRecord(item);
    const prompt = str(record.prompt);
    if (!prompt) {
      errors.push(`task ${index + 1}: missing prompt`);
      return;
    }
    if (looksLikeSkeleton(prompt)) {
      errors.push(`task ${index + 1}: placeholder/skeleton leak detected`);
      return;
    }
    const key = norm(prompt);
    if (seen.has(key)) {
      errors.push(`task ${index + 1}: duplicate prompt within module`);
      return;
    }
    seen.add(key);

    const rubric = Array.isArray(record.rubric)
      ? record.rubric
          .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
          .map(r => r.trim())
      : [];

    tasks.push({
      id: str(record.id) ?? `${moduleId}-${index + 1}`,
      moduleId,
      partId: str(record.partId),
      prompt,
      context: str(record.context),
      minWords: typeof record.minWords === 'number' ? record.minWords : undefined,
      points: typeof record.points === 'number' && record.points > 0 ? record.points : 20,
      rubric: rubric.length > 0 ? rubric : ['Inhalt', 'Sprache'],
    });
  });

  if (errors.length > 0 || tasks.length === 0) {
    return {
      ok: false,
      errors: errors.length ? errors : [`module "${blueprint.id}" produced no valid tasks`],
    };
  }
  return { ok: true, tasks };
}
