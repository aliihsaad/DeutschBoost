import { CEFRLevel, type LearningPlan, type LearningPlanItem, type TestResult } from '../../../types';

const VALID_LEVELS = new Set<string>(Object.values(CEFRLevel));
const VALID_SKILLS: LearningPlanItem['skill'][] = [
  'Grammar',
  'Vocabulary',
  'Listening',
  'Writing',
  'Speaking',
  'Reading',
];

const SKILL_BY_NORMALIZED_VALUE = new Map(
  VALID_SKILLS.map(skill => [skill.toLowerCase(), skill])
);

const DEFAULT_STRENGTHS = [
  'Completed the reading, grammar, and writing placement sections.',
];

const DEFAULT_WEAKNESSES = [
  'The AI examiner did not return specific improvement areas. Review the generated learning plan for targeted practice.',
];

const DEFAULT_RECOMMENDATIONS =
  'Continue with a balanced German study routine covering grammar, vocabulary, reading, writing, listening, and speaking.';

interface NormalizeTestResultOptions {
  fallbackLevel?: CEFRLevel;
  fallbackStrengths?: string[];
  fallbackWeaknesses?: string[];
  fallbackRecommendations?: string;
}

export function normalizeTestResult(
  value: unknown,
  options: NormalizeTestResultOptions = {}
): TestResult {
  const root = asRecord(value);

  return {
    level: normalizeLevel(root.level, options.fallbackLevel ?? CEFRLevel.A1),
    strengths:
      firstNonEmptyStringArray(root.strengths, root.strong_points, root.strongPoints) ??
      options.fallbackStrengths ??
      DEFAULT_STRENGTHS,
    weaknesses:
      firstNonEmptyStringArray(
        root.weaknesses,
        root.areas_for_improvement,
        root.areasForImprovement,
        root.improvement_areas,
        root.improvementAreas
      ) ??
      options.fallbackWeaknesses ??
      DEFAULT_WEAKNESSES,
    recommendations:
      firstNonEmptyString(
        root.recommendations,
        root.recommendation,
        root.feedback,
        root.detailed_feedback,
        root.detailedFeedback
      ) ??
      options.fallbackRecommendations ??
      DEFAULT_RECOMMENDATIONS,
  };
}

export function normalizeLearningPlanResult(
  value: unknown,
  fallbackLevel: CEFRLevel = CEFRLevel.A1
): LearningPlan {
  const root = asRecord(value);
  const level = normalizeLevel(root.level, fallbackLevel);
  const goals = firstNonEmptyStringArray(root.goals, root.objectives) ?? [
    `Build consistent ${level} German practice habits.`,
  ];
  const rawWeeks = Array.isArray(root.weeks) ? root.weeks : [];
  const weeks = rawWeeks.length > 0
    ? rawWeeks.map((week, index) => normalizeLearningPlanWeek(week, index))
    : [
        {
          week: 1,
          focus: `${level} foundation`,
          items: [
            createFallbackPlanItem(`${level} foundation`),
          ],
        },
      ];

  return {
    level,
    goals,
    weeks,
  };
}

function normalizeLearningPlanWeek(
  value: unknown,
  index: number
): LearningPlan['weeks'][number] {
  const root = asRecord(value);
  const weekNumber = typeof root.week === 'number' && Number.isFinite(root.week)
    ? root.week
    : index + 1;
  const focus = firstNonEmptyString(root.focus, root.title, root.topic) ?? `Week ${weekNumber}`;
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const items = rawItems
    .map(item => normalizeLearningPlanItem(item, focus))
    .filter((item): item is LearningPlanItem => item !== null);

  return {
    week: weekNumber,
    focus,
    items: items.length > 0 ? items : [createFallbackPlanItem(focus)],
  };
}

function normalizeLearningPlanItem(
  value: unknown,
  fallbackTopic: string
): LearningPlanItem | null {
  const root = asRecord(value);
  const topic = firstNonEmptyString(root.topic, root.title, root.name) ?? fallbackTopic;
  const description = firstNonEmptyString(root.description, root.task, root.details) ??
    `Practice ${topic} with short daily exercises.`;
  const id = firstNonEmptyString(root.id);

  if (!topic && !description) {
    return null;
  }

  return {
    ...(id ? { id } : {}),
    topic,
    skill: normalizeSkill(root.skill),
    description,
    completed: root.completed === true,
  };
}

function createFallbackPlanItem(topic: string): LearningPlanItem {
  return {
    topic,
    skill: 'Grammar',
    description: `Practice ${topic} with short daily exercises.`,
    completed: false,
  };
}

function normalizeSkill(value: unknown): LearningPlanItem['skill'] {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SKILL_BY_NORMALIZED_VALUE.get(normalized) ?? 'Grammar';
}

function normalizeLevel(value: unknown, fallback: CEFRLevel): CEFRLevel {
  return typeof value === 'string' && VALID_LEVELS.has(value)
    ? value as CEFRLevel
    : fallback;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function firstNonEmptyStringArray(...values: unknown[]): string[] | undefined {
  for (const value of values) {
    const normalized = normalizeStringArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
