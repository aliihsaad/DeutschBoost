# Robust Goethe Exam Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the silent skeleton-fallback exam generator with per-module AI generation, strict validation, retry/repair, and loud failure so the exam simulator always shows real content or a clear error.

**Architecture:** Split `examGenerator.ts` into a structural blueprint module, per-module schema validators, a typed error, and a thin orchestrator. The orchestrator generates each module with its own AI call (in parallel), validates the result, retries with a repair pass on failure, and throws `ExamGenerationError` instead of returning fake content. `scoreGoetheExam` and the per-level templates are preserved.

**Tech Stack:** TypeScript, React 19, Vitest, jsdom. AI via `AiProvider.generateJson<T>()`.

---

## Spec

`docs/superpowers/specs/2026-05-18-robust-goethe-exam-generator-design.md`

## File Structure

- **Create** `src/domain/exam/examGenerationError.ts` — typed `ExamGenerationError`.
- **Create** `src/domain/exam/examTemplates.ts` — per-level structural blueprint (`EXAM_TEMPLATES`, `MODULE_ORDER`, `LEVELS`, helper builders) and `createExamBlueprint(input)` returning a `GoetheExam` whose modules have **empty** `objectiveQuestions`/`productiveTasks`. Moved verbatim from `examGenerator.ts` (no behavior change to structure).
- **Create** `src/domain/exam/examModuleSchema.ts` — pure validators that turn raw AI JSON into validated `ExamObjectiveQuestion[]` / `ExamProductiveTask[]` or a list of error strings. Rejects skeleton/prompt-leak text and intra-module duplicates.
- **Modify** `src/domain/exam/examGenerator.ts` — keep `scoreGoetheExam` and all scoring helpers; **delete** every content-skeleton generator and the index-aligned normalizers; replace `generateGoetheExam`/`createFallbackGoetheExam` with the new orchestrator + `createExamBlueprint` re-export.
- **Modify** `pages/ExamSimulatorPage.tsx` — update setup copy to reflect "AI required, no fake fallback"; retry path already exists (`status === 'error'` re-renders `ExamSetup` with the start button).
- **Create** `tests/domain/exam/examModuleSchema.test.ts` — validator unit tests.
- **Modify** `tests/domain/exam/examGenerator.test.ts` — replace fallback-content tests with blueprint + generation/retry/repair/fail tests; keep scoring tests using a small valid fixture builder.
- **Modify** `tests/pages/ExamSimulatorPage.test.tsx` — give the two skeleton-dependent tests a mock `aiProvider`; add a loud-failure test.

## Key Type Reference (already exist in `src/domain/exam/examTypes.ts`)

```ts
type ExamModuleId = 'listening' | 'reading' | 'writing' | 'speaking';
interface ExamObjectiveQuestion { id: string; moduleId: ExamModuleId; partId?: string; prompt: string; passage?: string; options: string[]; correctOptionIndex: number; points: number; explanation?: string; }
interface ExamProductiveTask { id: string; moduleId: 'writing' | 'speaking'; partId?: string; prompt: string; context?: string; minWords?: number; points: number; rubric: string[]; }
interface ExamModule { id: ExamModuleId; germanLabel: string; englishLabel: string; durationMinutes: number; parts: number; instructions: string; templateParts: ExamModuleTemplatePart[]; objectiveQuestions: ExamObjectiveQuestion[]; productiveTasks: ExamProductiveTask[]; }
interface GoetheExam { id: string; title: string; templateName: string; level: CEFRLevel; generatedAt: string; totalMinutes: number; passThreshold: number; officialSources: ExamTemplateSource[]; sourceNotes: string[]; modules: ExamModule[]; }
```

`AiProvider` (in `src/domain/ai/aiProvider.ts`): `generateJson<T>(request: { feature: string; messages: { role; content }[]; schemaName?: string; options?: { temperature?; maxTokens? } }): Promise<T>`.

---

## Task 1: Typed `ExamGenerationError`

**Files:**
- Create: `src/domain/exam/examGenerationError.ts`
- Test: `tests/domain/exam/examGenerationError.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/exam/examGenerationError.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/exam/examGenerationError.test.ts`
Expected: FAIL — cannot find module `examGenerationError`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/exam/examGenerationError.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/exam/examGenerationError.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/exam/examGenerationError.ts tests/domain/exam/examGenerationError.test.ts
git commit -m "feat: add typed ExamGenerationError"
```

---

## Task 2: Extract structural blueprint into `examTemplates.ts`

This is a pure move + one new function. The blueprint code (lines ~25–301 and the
`template`/`spec`/`part`/`source`/`singleCriterion`/`productiveCriteria`/`speakingCriteria`
helpers around lines ~1290–1383 of `examGenerator.ts`) moves unchanged. Add
`createExamBlueprint` which builds modules with **empty** content arrays.

**Files:**
- Create: `src/domain/exam/examTemplates.ts`
- Modify: `src/domain/exam/examGenerator.ts` (remove moved code, import from new module)
- Test: `tests/domain/exam/examTemplates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/exam/examTemplates.test.ts
import { describe, expect, it } from 'vitest';
import { createExamBlueprint, MODULE_ORDER } from '../../../src/domain/exam/examTemplates';
import { CEFRLevel } from '../../../types';

describe('createExamBlueprint', () => {
  it('builds the B1 structural blueprint with empty content arrays', () => {
    const exam = createExamBlueprint({ level: CEFRLevel.B1, idFactory: () => 'exam-b1', now: () => '2026-05-18T00:00:00.000Z' });
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
    expect(createExamBlueprint({ level: CEFRLevel.A1 }).modules.map(m => m.durationMinutes)).toEqual([20, 25, 20, 15]);
    expect(createExamBlueprint({ level: CEFRLevel.A2 }).modules.map(m => m.durationMinutes)).toEqual([30, 30, 30, 15]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/exam/examTemplates.test.ts`
Expected: FAIL — cannot find module `examTemplates`.

- [ ] **Step 3: Create `examTemplates.ts`**

Move the following from `src/domain/exam/examGenerator.ts` into the new file **unchanged**:
- Constants: `LEVELS`, `MODULE_ORDER`, `B1_OBJECTIVE_SCORE_POINTS` stays in examGenerator (scoring); move `GOETHE_INFO_BASE`, `SHARED_SOURCE_NOTES`, `EXAM_TEMPLATES`.
- Types: `ExamModuleTemplateSpec`, `GoetheExamTemplate`.
- Builder helpers: `template`, `spec`, `part`, `source`, `singleCriterion`, `productiveCriteria`, `speakingCriteria` (the functions referenced inside `EXAM_TEMPLATES`).

Export `LEVELS`, `MODULE_ORDER`, `EXAM_TEMPLATES`, `GoetheExamTemplate`, `ExamModuleTemplateSpec`. Add the input type and `createExamBlueprint`:

```ts
// appended to src/domain/exam/examTemplates.ts
import type { GoetheExam } from './examTypes';
import { CEFRLevel } from '../../../types';

export interface ExamBlueprintInput {
  level: CEFRLevel;
  now?: () => string;
  idFactory?: () => string;
}

export function createExamBlueprint(input: ExamBlueprintInput): GoetheExam {
  const level = LEVELS.includes(input.level) ? input.level : CEFRLevel.B1;
  const now = input.now ?? (() => new Date().toISOString());
  const idFactory = input.idFactory ?? (() => `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const examTemplate = EXAM_TEMPLATES[level];
  const modules = examTemplate.modules.map(moduleSpec => ({
    ...moduleSpec,
    objectiveQuestions: [],
    productiveTasks: [],
  }));

  return {
    id: idFactory(),
    title: `DeutschBoost Goethe-style ${level} Simulator`,
    templateName: examTemplate.templateName,
    level,
    generatedAt: now(),
    totalMinutes: modules.reduce((sum, module) => sum + module.durationMinutes, 0),
    passThreshold: 60,
    officialSources: [...examTemplate.officialSources],
    sourceNotes: [...examTemplate.sourceNotes],
    modules,
  };
}
```

In `examGenerator.ts`: delete the moved constants/types/helpers and add at top:

```ts
import {
  EXAM_TEMPLATES,
  LEVELS,
  MODULE_ORDER,
  createExamBlueprint,
  type ExamBlueprintInput,
  type GoetheExamTemplate,
} from './examTemplates';
```

Remove the now-unused `ExamModuleTemplateSpec`/`GoetheExamTemplate` local declarations and any now-unused imports. Keep `B1_OBJECTIVE_SCORE_POINTS` and all scoring code in `examGenerator.ts`.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/domain/exam/examTemplates.test.ts && npx tsc --noEmit`
Expected: blueprint tests PASS; tsc may report errors in `examGenerator.ts` for symbols deleted in Task 3 — that is expected and fixed in Task 5. If tsc errors are **only** about `createFallbackGoetheExam`/`generateGoetheExam` internals, proceed; otherwise fix import breakage now.

- [ ] **Step 5: Commit**

```bash
git add src/domain/exam/examTemplates.ts tests/domain/exam/examTemplates.test.ts src/domain/exam/examGenerator.ts
git commit -m "refactor: extract exam structural blueprint into examTemplates"
```

---

## Task 3: Module schema validators

Validators take the raw module object from AI JSON plus the matching blueprint
`ExamModule` and return either validated content or error strings. They reject
skeleton/prompt-leak text and intra-module duplicates.

**Files:**
- Create: `src/domain/exam/examModuleSchema.ts`
- Test: `tests/domain/exam/examModuleSchema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/exam/examModuleSchema.test.ts
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
    const tasks = writing.templateParts.map((part, i) => ({
      id: `w-${i}`, partId: part.id, moduleId: 'writing',
      prompt: 'Schreiben Sie einen Text.', points: 10, rubric: ['Inhalt'],
    }));
    expect(validateProductiveModule(writing, { productiveTasks: tasks }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/exam/examModuleSchema.test.ts`
Expected: FAIL — cannot find module `examModuleSchema`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/exam/examModuleSchema.ts
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
  /originaler\s+\w+[- ]?Lesetext im Stil/i,
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
      ? record.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map(o => o.trim())
      : [];
    const correctOptionIndex = typeof record.correctOptionIndex === 'number' ? Math.round(record.correctOptionIndex) : -1;

    if (!prompt) { errors.push(`question ${index + 1}: missing prompt`); return; }
    if (options.length < 2) { errors.push(`question ${index + 1}: needs >=2 options`); return; }
    if (new Set(options.map(norm)).size !== options.length) { errors.push(`question ${index + 1}: duplicate options`); return; }
    if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      errors.push(`question ${index + 1}: correctOptionIndex ${correctOptionIndex} out of range`); return;
    }
    if (blueprint.id === 'listening' && !passage) {
      errors.push(`question ${index + 1}: listening item needs a hidden audio passage`); return;
    }
    const leakText = `${prompt} ${passage ?? ''} ${options.join(' ')}`;
    if (looksLikeSkeleton(leakText)) { errors.push(`question ${index + 1}: placeholder/skeleton leak detected`); return; }

    const promptKey = norm(prompt);
    if (seenPrompts.has(promptKey)) { errors.push(`question ${index + 1}: duplicate prompt within module`); return; }
    seenPrompts.add(promptKey);
    if (passage) {
      const passageKey = norm(passage);
      if (seenPassages.has(passageKey)) { errors.push(`question ${index + 1}: duplicate passage within module`); return; }
      seenPassages.add(passageKey);
    }

    questions.push({
      id: str(record.id) ?? `${blueprint.id}-${index + 1}`,
      moduleId: blueprint.id,
      partId: str(record.partId),
      passage,
      prompt,
      options: options.slice(0, 4),
      correctOptionIndex: Math.min(correctOptionIndex, Math.min(options.length, 4) - 1),
      points: typeof record.points === 'number' && record.points > 0 ? record.points : 1,
      explanation: str(record.explanation),
    });
  });

  if (errors.length > 0 || questions.length === 0) {
    return { ok: false, errors: errors.length ? errors : [`module "${blueprint.id}" produced no valid questions`] };
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
    if (!prompt) { errors.push(`task ${index + 1}: missing prompt`); return; }
    if (looksLikeSkeleton(prompt)) { errors.push(`task ${index + 1}: placeholder/skeleton leak detected`); return; }
    const key = norm(prompt);
    if (seen.has(key)) { errors.push(`task ${index + 1}: duplicate prompt within module`); return; }
    seen.add(key);

    const rubric = Array.isArray(record.rubric)
      ? record.rubric.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map(r => r.trim())
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
    return { ok: false, errors: errors.length ? errors : [`module "${blueprint.id}" produced no valid tasks`] };
  }
  return { ok: true, tasks };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/exam/examModuleSchema.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/exam/examModuleSchema.ts tests/domain/exam/examModuleSchema.test.ts
git commit -m "feat: add strict per-module exam schema validators"
```

---

## Task 4: Per-module prompt builder

A focused prompt per module, embedding the blueprint parts and the required JSON
shape, plus a repair instruction variant.

**Files:**
- Create: `src/domain/exam/examModulePrompt.ts`
- Test: `tests/domain/exam/examModulePrompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/exam/examModulePrompt.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/exam/examModulePrompt.test.ts`
Expected: FAIL — cannot find module `examModulePrompt`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/exam/examModulePrompt.ts
import type { AiMessage } from '../ai/aiProvider';
import type { ExamModule } from './examTypes';
import type { CEFRLevel } from '../../../types';

export interface ModuleRepairContext {
  previousOutput: string;
  errors: string[];
}

const OBJECTIVE_SHAPE = {
  objectiveQuestions: [
    { id: 'string', partId: 'string', passage: 'string', prompt: 'string', options: ['string', 'string', 'string'], correctOptionIndex: 0, points: 1, explanation: 'string' },
  ],
};

const PRODUCTIVE_SHAPE = {
  productiveTasks: [
    { id: 'string', partId: 'string', moduleId: 'writing | speaking', prompt: 'string', context: 'string', minWords: 80, points: 20, rubric: ['string'] },
  ],
};

export function buildModuleMessages(
  level: CEFRLevel,
  module: ExamModule,
  repair?: ModuleRepairContext
): AiMessage[] {
  const isObjective = module.id === 'listening' || module.id === 'reading';
  const blueprint = {
    moduleId: module.id,
    germanLabel: module.germanLabel,
    durationMinutes: module.durationMinutes,
    parts: module.templateParts.map(part => ({
      id: part.id,
      title: part.title,
      taskFamily: part.taskFamily,
      answerFormat: part.answerFormat,
      questionCount: part.questionCount,
      maxPoints: part.maxPoints,
      criteria: part.criteria,
      promptGuidance: part.promptGuidance,
    })),
  };

  const rules = [
    `You generate original Goethe-Zertifikat ${level} simulator content for ONE module only: "${module.id}".`,
    'Create fresh content in the public exam task style. Never copy official model-test text verbatim.',
    'Every item must be unique within the module: no repeated prompts, passages, options, or tasks.',
    'Never output placeholder/scaffolding text such as "Option a aus dem Text", "Ein originaler ... Lesetext im Stil", "Aussage N: Die Aussage passt zum Text", "Audio script", or "Hoertext".',
    module.id === 'listening'
      ? 'For listening, "passage" is the hidden German audio script read aloud by TTS; the learner never sees it. The visible prompt and options must be concrete answers about that script.'
      : '',
    `Use exactly the part questionCount values from the blueprint. Return ONLY JSON of this shape: ${JSON.stringify(isObjective ? OBJECTIVE_SHAPE : PRODUCTIVE_SHAPE)}.`,
  ].filter(Boolean).join('\n');

  const messages: AiMessage[] = [
    { role: 'system', content: rules },
    { role: 'user', content: JSON.stringify({ level, module: blueprint }) },
  ];

  if (repair) {
    messages.push({
      role: 'user',
      content: [
        'Your previous output was invalid. Fix ONLY these problems and return corrected JSON of the same shape:',
        ...repair.errors.map(error => `- ${error}`),
        'Previous output:',
        repair.previousOutput,
      ].join('\n'),
    });
  }

  return messages;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/exam/examModulePrompt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/exam/examModulePrompt.ts tests/domain/exam/examModulePrompt.test.ts
git commit -m "feat: add per-module exam generation prompt builder"
```

---

## Task 5: Rewrite the generator orchestrator

Replace `generateGoetheExam` and delete all skeleton/normalizer code. Keep
`scoreGoetheExam` and its helpers. Re-export `createExamBlueprint` as
`createFallbackGoetheExam` is removed; update its only consumers in Task 6/7.

**Files:**
- Modify: `src/domain/exam/examGenerator.ts`
- Test: `tests/domain/exam/examGenerator.test.ts` (rewritten in this task)

- [ ] **Step 1: Rewrite the generation tests (failing)**

Replace the three fallback-content tests (`creates a full local B1 exam...`,
`uses fixed Goethe public template metadata...`, `creates natural Hoeren
fallback items...`, lines ~10–61) and the AI test, with the block below. **Keep**
the scoring tests (`scores objective...`, `reports B1 module results...`,
`creates public non-B1 blueprints...`) but change their `createFallbackGoetheExam`
calls to the new `buildScoredExamFixture` helper added here. Full new test file
content:

```ts
// tests/domain/exam/examGenerator.test.ts
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
      moduleId: module.id === 'speaking' ? 'speaking' as const : 'writing' as const,
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

function aiProviderFor(exam: GoetheExam): AiProvider {
  return {
    id: 'mock', displayName: 'Mock',
    generateText: vi.fn(),
    generateJson: vi.fn(async (request) => {
      const moduleId = ['listening', 'reading', 'writing', 'speaking'].find(id =>
        request.messages.some(m => m.content.includes(`"${id}"`) || m.content.includes(`"moduleId":"${id}"`) || m.content.includes(`module only: "${id}"`))
      ) ?? 'reading';
      return moduleResponse(exam, moduleId) as never;
    }),
  };
}

describe('generateGoetheExam (AI-only, loud failure)', () => {
  it('throws ExamGenerationError when no AI provider is configured', async () => {
    await expect(generateGoetheExam({ level: CEFRLevel.B1 })).rejects.toBeInstanceOf(ExamGenerationError);
  });

  it('generates a full valid exam per module from the AI provider', async () => {
    const fixture = buildScoredExamFixture(CEFRLevel.B1);
    const exam = await generateGoetheExam({ level: CEFRLevel.B1, aiProvider: aiProviderFor(fixture) });
    expect(exam.modules.map(m => m.id)).toEqual(['listening', 'reading', 'writing', 'speaking']);
    const reading = exam.modules.find(m => m.id === 'reading')!;
    expect(reading.objectiveQuestions.length).toBeGreaterThan(0);
    const allText = JSON.stringify(exam);
    expect(allText).not.toMatch(/Option [abc] aus dem Text|originaler .*Lesetext im Stil/i);
  });

  it('retries a module then succeeds', async () => {
    const fixture = buildScoredExamFixture(CEFRLevel.B1);
    let readingCalls = 0;
    const provider: AiProvider = {
      id: 'mock', displayName: 'Mock', generateText: vi.fn(),
      generateJson: vi.fn(async (request) => {
        const isReading = request.messages.some(m => m.content.includes('module only: "reading"'));
        if (isReading) {
          readingCalls += 1;
          if (readingCalls === 1) return { objectiveQuestions: [] } as never; // invalid first
          return { objectiveQuestions: fixture.modules.find(m => m.id === 'reading')!.objectiveQuestions } as never;
        }
        const moduleId = ['listening', 'writing', 'speaking'].find(id => request.messages.some(m => m.content.includes(`module only: "${id}"`)))!;
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
      id: 'mock', displayName: 'Mock', generateText: vi.fn(),
      generateJson: vi.fn(async (request) => {
        if (request.messages.some(m => m.content.includes('module only: "writing"'))) {
          return { productiveTasks: [] } as never; // always invalid
        }
        const moduleId = ['listening', 'reading', 'speaking'].find(id => request.messages.some(m => m.content.includes(`module only: "${id}"`)))!;
        return moduleResponse(fixture, moduleId) as never;
      }),
    };
    await expect(generateGoetheExam({ level: CEFRLevel.B1, aiProvider: provider }))
      .rejects.toMatchObject({ name: 'ExamGenerationError', moduleId: 'writing' });
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
      for (const t of module.productiveTasks) productive[t.id] = 'Dies ist eine ausreichend lange und klare Antwort auf die Aufgabe mit genug Woertern.';
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/domain/exam/examGenerator.test.ts`
Expected: FAIL — `generateGoetheExam` still returns fallback (no throw); `createExamBlueprint` import may already pass. Failures confirm old behavior.

- [ ] **Step 3: Rewrite `generateGoetheExam` and delete skeleton code**

In `src/domain/exam/examGenerator.ts`:

1. **Delete** these functions entirely: `createFallbackGoetheExam`, `createFallbackModule`, `createObjectiveQuestions`, `createObjectiveFallbackContent`, `createListeningFallbackContent`, `LISTENING_SCENARIOS`, `hashString`, `createProductiveTasks`, `createObjectivePassage`, `createObjectivePrompt`, `createObjectiveOptions`, `createWritingPrompt`, `createSpeakingPrompt`, `getWritingWordGuide`, `buildGenerationPrompt`, `normalizeGeneratedExam`, `normalizeModule`, `normalizeObjectiveQuestion`, `isValidListeningQuestion`, `normalizeProductiveTask`, and the now-unused `asRecord`/`normalizeString`/`normalizeStringArray`/`normalizeModuleId`/`isModule`/`isObjectiveQuestion`/`isProductiveTask` helpers **only if** they are not referenced by scoring code (grep first; keep any the scoring path still uses).
2. Add imports:

```ts
import { createExamBlueprint, type ExamBlueprintInput } from './examTemplates';
import { validateObjectiveModule, validateProductiveModule } from './examModuleSchema';
import { buildModuleMessages } from './examModulePrompt';
import { ExamGenerationError } from './examGenerationError';
```

3. Replace `generateGoetheExam` with:

```ts
const MAX_MODULE_ATTEMPTS = 3;

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
    const repair = attempt > 1 && previousOutput
      ? { previousOutput, errors: lastErrors }
      : undefined;

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
```

4. Ensure `AiProvider`, `ExamModule`, `CEFRLevel`, `GoetheExam`, `GenerateGoetheExamInput` are imported/declared (they already are). Keep `GenerateGoetheExamInput` but make it extend the blueprint input:

```ts
interface GenerateGoetheExamInput extends ExamBlueprintInput {
  aiProvider?: AiProvider;
}
```

5. Remove now-dead imports flagged by tsc.

- [ ] **Step 4: Run tests + typecheck + full suite**

Run: `npx vitest run tests/domain/exam/examGenerator.test.ts && npx tsc --noEmit`
Expected: examGenerator tests PASS. tsc PASS except possible errors in `pages/ExamSimulatorPage.tsx`/its test referencing removed `createFallbackGoetheExam` — fixed in Task 6/7.

- [ ] **Step 5: Commit**

```bash
git add src/domain/exam/examGenerator.ts tests/domain/exam/examGenerator.test.ts
git commit -m "feat: AI-only per-module exam generation with retry and loud failure"
```

---

## Task 6: Update ExamSimulatorPage copy and verify retry path

The page already catches generation errors (`handleStartExam` try/catch →
`setStatus('error')`) and re-renders `ExamSetup` (with the start button as
retry) when `status === 'error'`. Only the setup copy implies a local fallback;
fix that. No new control needed.

**Files:**
- Modify: `pages/ExamSimulatorPage.tsx:493-499`

- [ ] **Step 1: Update the ExamSetup source box copy**

Replace lines ~493–500 (`<div className="db-exam-source-box">` block) with:

```tsx
    <div className="db-exam-source-box">
      <strong>{aiReady ? 'AI generation enabled' : 'AI provider required'}</strong>
      <span>
        {aiReady
          ? 'OpenRouter generates fresh, original exam content per module. If a module cannot be generated you will see an error and can retry.'
          : 'Open Settings and enable an AI provider. The exam only runs with AI-generated content — no offline practice exam is shown.'}
      </span>
    </div>
```

- [ ] **Step 2: Verify the retry button label still reads as retry on error**

Confirm lines ~502–505 render the start button regardless of `errorMessage`
(they do). No change needed. If `errorMessage` is set, it shows above the button
via line ~501.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors from `ExamSimulatorPage.tsx` (its `createFallbackGoetheExam`
import, if any, is in the test only — verified in Task 7). If the page imports
`createFallbackGoetheExam`, replace that import with `createExamBlueprint` from
`../src/domain/exam/examTemplates` and update usages (there should be none in the
page; it only calls `generateGoetheExam`).

- [ ] **Step 4: Commit**

```bash
git add pages/ExamSimulatorPage.tsx
git commit -m "feat: exam setup copy reflects AI-only generation and retry"
```

---

## Task 7: Update ExamSimulatorPage tests for AI-only behavior

The current suite has tests that relied on the skeleton (no `aiProvider` passed):
`runs a full timed Goethe-style exam...` and `plays Hoeren questions through
Deepgram TTS...`. Give them a mock provider returning valid module content, and
add a loud-failure test.

**Files:**
- Modify: `tests/pages/ExamSimulatorPage.test.tsx`

- [ ] **Step 1: Add a shared mock provider helper**

At the top of the test file (after imports, before `describe`), add:

```ts
import { createExamBlueprint } from '../../src/domain/exam/examTemplates';
import { CEFRLevel } from '../../types';

function validModuleResponse(level: CEFRLevel, moduleId: string) {
  const module = createExamBlueprint({ level }).modules.find(m => m.id === moduleId)!;
  if (moduleId === 'listening' || moduleId === 'reading') {
    return {
      objectiveQuestions: module.templateParts.flatMap(part =>
        Array.from({ length: Math.max(1, part.questionCount ?? part.maxPoints ?? 1) }, (_, i) => ({
          id: `${moduleId}-${part.id}-${i}`,
          partId: part.id,
          passage: `${moduleId} ${part.id} ${i}: Der Termin ist am ${i + 1}. Mai um ${9 + i} Uhr im Raum ${part.id}.`,
          prompt: `${moduleId} ${part.id} ${i}: Wann ist der Termin?`,
          options: [`am ${i + 1}. Mai um ${9 + i} Uhr`, `nie (${part.id}${i})`, `gestern (${part.id}${i})`],
          correctOptionIndex: 0,
          points: 1,
          explanation: 'Steht im Text.',
        }))
      ),
    };
  }
  return {
    productiveTasks: module.templateParts.map((part, i) => ({
      id: `${moduleId}-${part.id}`,
      partId: part.id,
      moduleId: moduleId === 'speaking' ? 'speaking' : 'writing',
      prompt: `${moduleId} ${part.id}: Bearbeiten Sie Aufgabe ${i + 1} klar und vollstaendig.`,
      points: part.maxPoints ?? 20,
      rubric: ['Inhalt', 'Sprache'],
    })),
  };
}

function mockExamAiProvider(level: CEFRLevel) {
  return {
    id: 'mock', displayName: 'Mock', generateText: vi.fn(),
    generateJson: vi.fn(async (request: { messages: { content: string }[] }) => {
      const moduleId = ['listening', 'reading', 'writing', 'speaking'].find(id =>
        request.messages.some(m => m.content.includes(`module only: "${id}"`))
      ) ?? 'reading';
      return validModuleResponse(level, moduleId);
    }),
  };
}
```

- [ ] **Step 2: Pass the mock provider into the two skeleton-dependent tests**

In `it('runs a full timed Goethe-style exam, shows the result, and saves history', ...)`
and `it('plays Hoeren questions through Deepgram TTS before answers can be selected', ...)`,
add `aiProvider={mockExamAiProvider(CEFRLevel.B1)}` to the rendered
`<ExamSimulatorPage ... />` props (alongside existing props). Do not change other
assertions; the content is now real but structurally equivalent (objective
questions per part, productive tasks per part).

- [ ] **Step 3: Add a loud-failure test**

Add inside the `describe('ExamSimulatorPage', ...)` block:

```ts
it('shows an error and a retry button instead of a fake exam when generation fails', async () => {
  const failingProvider = {
    id: 'mock', displayName: 'Mock', generateText: vi.fn(),
    generateJson: vi.fn(async () => ({ objectiveQuestions: [], productiveTasks: [] })),
  };
  render(
    <MemoryRouter>
      <ExamSimulatorPage aiProvider={failingProvider} conversationRepository={conversationRepository} />
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole('button', { name: /generate and start exam/i }));
  expect(await screen.findByText(/Exam generation failed/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /generate and start exam/i })).toBeInTheDocument();
  expect(screen.queryByText(/Option [abc] aus dem Text/i)).not.toBeInTheDocument();
});
```

Match the existing render wrapper/imports used by other tests in this file
(`MemoryRouter`, `conversationRepository`, `userEvent`, `screen`). If the file
uses a different render helper, mirror that test's setup exactly.

- [ ] **Step 4: Run the page test file**

Run: `npx vitest run tests/pages/ExamSimulatorPage.test.tsx`
Expected: PASS — all tests including the new loud-failure test.

- [ ] **Step 5: Commit**

```bash
git add tests/pages/ExamSimulatorPage.test.tsx
git commit -m "test: ExamSimulatorPage uses AI provider and asserts loud failure"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: All test files pass (previous baseline was 289 tests; count changes
with the rewritten/added tests). Zero failures.

- [ ] **Step 2: Production build / typecheck**

Run: `npm run build`
Expected: Build succeeds; only the pre-existing chunk-size warning.

- [ ] **Step 3: Grep guard — no skeleton strings remain in source**

Run: `git grep -n "aus dem Text\|originaler .*Lesetext im Stil\|Die Loesung ist im Text" -- 'src/*' 'pages/*'`
Expected: matches **only** in `src/domain/exam/examModuleSchema.ts` (the rejection
patterns). No skeleton content generators remain.

- [ ] **Step 4: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: verify robust exam generator (full suite + build green)"
```

---

## Self-Review Notes

- **Spec coverage:** structure split (Tasks 2–4), validators with skeleton +
  uniqueness rejection (Task 3), per-module parallel generation with retry/repair
  (Tasks 4–5), loud `ExamGenerationError` (Tasks 1, 5), page error+retry (Tasks 6–7),
  speaking via same path (Tasks 4–5 treat speaking as productive), tests for
  success/retry/repair/fail (Tasks 5, 7). Scoring preserved (Task 5 keeps
  `scoreGoetheExam`; Task 5 tests it).
- **Listening duplicate audio:** solved by per-item uniqueness on `passage`
  (validator) — each listening item has a distinct script → distinct TTS.
- **Repair path:** Task 4 builds the repair turn; Task 5 wires `previousOutput`
  + `lastErrors` into attempt > 1.
- **No placeholders:** every code/test step contains full content.
- **Type consistency:** `validateObjectiveModule`/`validateProductiveModule`
  return `{ ok, questions|tasks|errors }` used identically in Task 5;
  `ExamGenerationError(moduleId, reasons)` signature consistent across Tasks 1/5/7;
  `createExamBlueprint(input)` signature consistent across Tasks 2/3/5/7.
