import type {
  LearnerId,
  LearningPlan,
  LearningPlanId,
  LearningPlanItemCompletion,
  PlacementResultRecord,
  SaveLearningPlanInput,
  SavedLearningPlan,
  TestResult,
} from './types';

export const DEFAULT_LEARNING_PLAN_STORAGE_KEY = 'deutschboost.learningPlans.v1';

type MaybePromise<T> = T | Promise<T>;

export interface LearningPlanStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}

export interface LearningPlanRepository {
  loadActive(learnerId: LearnerId): Promise<LearningPlan | null>;
  save(input: SaveLearningPlanInput): Promise<SavedLearningPlan>;
  markItemCompletion(input: LearningPlanItemCompletion): Promise<void>;
  recordPlacementResult(learnerId: LearnerId, result: TestResult): Promise<PlacementResultRecord>;
}

interface StoredLearningPlan {
  id: LearningPlanId;
  learnerId: LearnerId;
  placementResultId?: string;
  isActive: boolean;
  createdAt: string;
  plan: LearningPlan;
}

interface LearningPlanStore {
  activePlanIdsByLearner: Record<LearnerId, LearningPlanId>;
  plans: StoredLearningPlan[];
  placementResults: PlacementResultRecord[];
}

interface StorageLearningPlanRepositoryOptions {
  storage: LearningPlanStorage;
  storageKey?: string;
  now?: () => string;
  idFactory?: () => string;
  itemIdFactory?: (planId: LearningPlanId, weekNumber: number, itemIndex: number) => string;
  placementIdFactory?: () => string;
}

export function createStorageLearningPlanRepository(
  options: StorageLearningPlanRepositoryOptions
): LearningPlanRepository {
  const storageKey = options.storageKey ?? DEFAULT_LEARNING_PLAN_STORAGE_KEY;
  const now = options.now ?? (() => new Date().toISOString());
  const idFactory = options.idFactory ?? createLearningPlanId;
  const itemIdFactory = options.itemIdFactory ?? createLearningPlanItemId;
  const placementIdFactory = options.placementIdFactory ?? createPlacementResultId;

  const loadStore = () => loadLearningPlanStore(options.storage, storageKey);
  const saveStore = (store: LearningPlanStore) =>
    options.storage.setItem(storageKey, JSON.stringify(store));

  return {
    async loadActive(learnerId: LearnerId): Promise<LearningPlan | null> {
      const store = await loadStore();
      const activePlanId = store.activePlanIdsByLearner[learnerId];

      if (!activePlanId) {
        return null;
      }

      const storedPlan = store.plans.find(plan => plan.id === activePlanId && plan.learnerId === learnerId);
      return storedPlan?.isActive ? cloneLearningPlan(storedPlan.plan) : null;
    },

    async save(input: SaveLearningPlanInput): Promise<SavedLearningPlan> {
      const store = await loadStore();
      const planId = idFactory();
      const plan = addPlanItemIds(cloneLearningPlan(input.plan), planId, itemIdFactory);
      const createdAt = now();

      store.plans = store.plans.map(storedPlan =>
        storedPlan.learnerId === input.learnerId
          ? { ...storedPlan, isActive: false }
          : storedPlan
      );
      store.plans.unshift({
        id: planId,
        learnerId: input.learnerId,
        placementResultId: input.placementResultId,
        isActive: true,
        createdAt,
        plan,
      });
      store.activePlanIdsByLearner[input.learnerId] = planId;

      await saveStore(store);
      return { planId, plan: cloneLearningPlan(plan) };
    },

    async markItemCompletion(input: LearningPlanItemCompletion): Promise<void> {
      const store = await loadStore();
      const storedPlan = findPlanForItem(store, input.learnerId, input.itemId);

      storedPlan.plan = {
        ...storedPlan.plan,
        weeks: storedPlan.plan.weeks.map(week => ({
          ...week,
          items: week.items.map(item =>
            item.id === input.itemId
              ? {
                  ...item,
                  completed: input.completed,
                }
              : item
          ),
        })),
      };

      await saveStore(store);
    },

    async recordPlacementResult(
      learnerId: LearnerId,
      result: TestResult
    ): Promise<PlacementResultRecord> {
      const store = await loadStore();
      const record: PlacementResultRecord = {
        ...result,
        id: placementIdFactory(),
        learnerId,
        completedAt: now(),
      };

      store.placementResults.unshift(record);
      await saveStore(store);
      return record;
    },
  };
}

async function loadLearningPlanStore(
  storage: LearningPlanStorage,
  storageKey: string
): Promise<LearningPlanStore> {
  const stored = await storage.getItem(storageKey);

  if (!stored) {
    return createEmptyLearningPlanStore();
  }

  try {
    return normalizeLearningPlanStore(JSON.parse(stored));
  } catch {
    await storage.removeItem(storageKey);
    return createEmptyLearningPlanStore();
  }
}

function normalizeLearningPlanStore(value: unknown): LearningPlanStore {
  const root = asRecord(value);
  const activePlanIdsByLearner = asStringRecord(root.activePlanIdsByLearner);
  const plans = Array.isArray(root.plans)
    ? root.plans.map(normalizeStoredLearningPlan).filter(isStoredLearningPlan)
    : [];
  const placementResults = Array.isArray(root.placementResults)
    ? root.placementResults.map(normalizePlacementResult).filter(isPlacementResultRecord)
    : [];

  return {
    activePlanIdsByLearner,
    plans,
    placementResults,
  };
}

function createEmptyLearningPlanStore(): LearningPlanStore {
  return {
    activePlanIdsByLearner: {},
    plans: [],
    placementResults: [],
  };
}

function normalizeStoredLearningPlan(value: unknown): StoredLearningPlan | null {
  const root = asRecord(value);
  const id = normalizeString(root.id);
  const learnerId = normalizeString(root.learnerId);
  const createdAt = normalizeString(root.createdAt);
  const plan = normalizeLearningPlan(root.plan);

  if (!id || !learnerId || !createdAt || !plan) {
    return null;
  }

  return {
    id,
    learnerId,
    placementResultId: normalizeString(root.placementResultId),
    isActive: root.isActive === true,
    createdAt,
    plan,
  };
}

function normalizeLearningPlan(value: unknown): LearningPlan | null {
  const root = asRecord(value);
  const level = normalizeString(root.level) as LearningPlan['level'] | undefined;
  const goals = Array.isArray(root.goals)
    ? root.goals.filter((goal): goal is string => typeof goal === 'string')
    : [];
  const weeks = Array.isArray(root.weeks)
    ? root.weeks.map(week => {
        const weekRoot = asRecord(week);
        return {
          week: typeof weekRoot.week === 'number' ? weekRoot.week : 0,
          focus: normalizeString(weekRoot.focus) ?? '',
          items: Array.isArray(weekRoot.items)
            ? weekRoot.items.map(item => {
                const itemRoot = asRecord(item);
                return {
                  id: normalizeString(itemRoot.id),
                  topic: normalizeString(itemRoot.topic) ?? '',
                  skill: (normalizeString(itemRoot.skill) ?? 'Grammar') as LearningPlan['weeks'][number]['items'][number]['skill'],
                  description: normalizeString(itemRoot.description) ?? '',
                  completed: itemRoot.completed === true,
                };
              })
            : [],
        };
      })
    : [];

  if (!level) {
    return null;
  }

  return { level, goals, weeks };
}

function normalizePlacementResult(value: unknown): PlacementResultRecord | null {
  const root = asRecord(value);
  const id = normalizeString(root.id);
  const learnerId = normalizeString(root.learnerId);
  const completedAt = normalizeString(root.completedAt);
  const level = normalizeString(root.level) as PlacementResultRecord['level'] | undefined;
  const recommendations = normalizeString(root.recommendations);

  if (!id || !learnerId || !completedAt || !level || !recommendations) {
    return null;
  }

  return {
    id,
    learnerId,
    completedAt,
    level,
    strengths: normalizeStringArray(root.strengths),
    weaknesses: normalizeStringArray(root.weaknesses),
    recommendations,
  };
}

function addPlanItemIds(
  plan: LearningPlan,
  planId: LearningPlanId,
  itemIdFactory: (planId: LearningPlanId, weekNumber: number, itemIndex: number) => string
): LearningPlan {
  return {
    ...plan,
    weeks: plan.weeks.map(week => ({
      ...week,
      items: week.items.map((item, itemIndex) => ({
        ...item,
        id: item.id ?? itemIdFactory(planId, week.week, itemIndex),
        completed: item.completed === true,
      })),
    })),
  };
}

function findPlanForItem(
  store: LearningPlanStore,
  learnerId: LearnerId,
  itemId: string
): StoredLearningPlan {
  const storedPlan = store.plans.find(plan =>
    plan.learnerId === learnerId &&
    plan.plan.weeks.some(week => week.items.some(item => item.id === itemId))
  );

  if (!storedPlan) {
    throw new Error(`Learning plan item not found: ${itemId}`);
  }

  return storedPlan;
}

function cloneLearningPlan(plan: LearningPlan): LearningPlan {
  return {
    ...plan,
    goals: [...plan.goals],
    weeks: plan.weeks.map(week => ({
      ...week,
      items: week.items.map(item => ({ ...item })),
    })),
  };
}

function createLearningPlanId(): string {
  return `local-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLearningPlanItemId(
  planId: LearningPlanId,
  weekNumber: number,
  itemIndex: number
): string {
  return `${planId}-week-${weekNumber}-item-${itemIndex + 1}`;
}

function createPlacementResultId(): string {
  return `local-placement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  const root = asRecord(value);
  return Object.fromEntries(
    Object.entries(root).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isStoredLearningPlan(value: StoredLearningPlan | null): value is StoredLearningPlan {
  return value !== null;
}

function isPlacementResultRecord(value: PlacementResultRecord | null): value is PlacementResultRecord {
  return value !== null;
}
