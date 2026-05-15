# DeutschBoost Phase 1.5 Experience Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable Phase 1.5 foundation for the experience-first local app: navigation, provider capability state, daily learning queue, activity session flow, learning-memory effects, and a visual-concept brief.

**Architecture:** Add pure TypeScript UI/domain models under `src/ui` so the new experience can be tested before React screens are replaced. Keep the current browser app runnable and do not change page routing or runtime behavior in this slice. The next slice can generate visual concepts and then replace the app shell/dashboard using these models.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing root `types.ts`, existing `src/types/activity.types.ts`.

---

## Scope

This plan implements the first executable slice of the approved experience-first UX spec:

- destination/navigation model
- provider status and capability model
- daily learning queue model
- activity session state model
- activity-result-to-learning-memory effects
- visual concept brief for the next UI slice

This plan does not replace React screens. Screen replacement requires approved visual concepts for dashboard, activity result, conversation transcript, mistake notebook/review, and settings.

## Existing Worktree Notes

The repository already contains uncommitted Phase 1 boundary work:

- `services/activityService.ts`
- `tests/services/activityService.test.ts`
- `src/domain/`
- `tests/domain/`
- `docs/superpowers/specs/2026-05-15-deutschboost-local-first-redesign.md`
- `docs/superpowers/plans/2026-05-15-deutschboost-local-conversion-roadmap.md`

Do not revert or reformat that work. This plan adds new files only.

## File Structure

- Create `src/ui/navigationModel.ts`
  - Owns destination ids, route labels, legacy route mapping, and active destination matching.
  - Does not import React, Supabase, Gemini, OpenRouter, or Deepgram.

- Create `src/ui/providerStatusModel.ts`
  - Owns AI and speech provider state shown by local settings and workflow gates.
  - Converts key/config/error state into learner-facing capability flags.

- Create `src/ui/learningWorkflowModel.ts`
  - Owns daily queue ordering, activity session state transitions, and learning-memory effects.
  - Imports only stable learning types from `types.ts` and `src/types/activity.types.ts`.

- Create `tests/ui/navigationModel.test.ts`
  - Tests destination ordering, route matching, and legacy route compatibility.

- Create `tests/ui/providerStatusModel.test.ts`
  - Tests disabled/configured/error states for AI and speech.

- Create `tests/ui/learningWorkflowModel.test.ts`
  - Tests daily queue ordering, session transitions, and memory effects.

- Create `docs/superpowers/specs/2026-05-15-deutschboost-visual-concept-brief.md`
  - Defines the exact visual surfaces to concept before UI implementation.

## Task 1: Navigation Model

**Files:**
- Create: `tests/ui/navigationModel.test.ts`
- Create: `src/ui/navigationModel.ts`

- [ ] **Step 1: Write the failing navigation tests**

Create `tests/ui/navigationModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  appDestinations,
  getDestinationById,
  getDestinationByRoute,
  isDestinationActive,
} from '../../src/ui/navigationModel';

describe('navigationModel', () => {
  it('defines the experience-first desktop navigation order', () => {
    expect(appDestinations.map(destination => destination.id)).toEqual([
      'dashboard',
      'plan',
      'review',
      'practice',
      'conversation',
      'writing',
      'mistakes',
      'exam',
      'library',
      'settings',
    ]);
  });

  it('maps new routes to their destinations', () => {
    expect(getDestinationByRoute('/').id).toBe('dashboard');
    expect(getDestinationByRoute('/plan').id).toBe('plan');
    expect(getDestinationByRoute('/review').id).toBe('review');
    expect(getDestinationByRoute('/conversation').id).toBe('conversation');
    expect(getDestinationByRoute('/settings').id).toBe('settings');
  });

  it('maps legacy routes into the new destination model', () => {
    expect(getDestinationByRoute('/learning-plan').id).toBe('plan');
    expect(getDestinationByRoute('/activity?type=grammar').id).toBe('practice');
    expect(getDestinationByRoute('/speaking-activity').id).toBe('conversation');
    expect(getDestinationByRoute('/exam-simulator').id).toBe('exam');
    expect(getDestinationByRoute('/profile').id).toBe('settings');
  });

  it('falls back to dashboard for unknown routes', () => {
    expect(getDestinationByRoute('/something-old').id).toBe('dashboard');
  });

  it('checks active state across canonical and legacy routes', () => {
    const plan = getDestinationById('plan');
    const conversation = getDestinationById('conversation');

    expect(isDestinationActive(plan, '/plan')).toBe(true);
    expect(isDestinationActive(plan, '/learning-plan')).toBe(true);
    expect(isDestinationActive(plan, '/conversation')).toBe(false);
    expect(isDestinationActive(conversation, '/speaking-activity?topic=Ordering')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the navigation tests and verify they fail**

Run:

```bash
npm run test:run -- tests/ui/navigationModel.test.ts
```

Expected result:

```text
FAIL tests/ui/navigationModel.test.ts
Cannot find module '../../src/ui/navigationModel'
```

- [ ] **Step 3: Add the navigation model**

Create `src/ui/navigationModel.ts`:

```ts
export type AppDestinationId =
  | 'dashboard'
  | 'plan'
  | 'review'
  | 'practice'
  | 'conversation'
  | 'writing'
  | 'mistakes'
  | 'exam'
  | 'library'
  | 'settings';

export type AppDestinationGroup = 'learn' | 'practice' | 'memory' | 'system';

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  shortLabel: string;
  route: string;
  icon: string;
  group: AppDestinationGroup;
  description: string;
  legacyRoutes: string[];
}

export const appDestinations: AppDestination[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    route: '/',
    icon: 'layout-dashboard',
    group: 'learn',
    description: 'Daily queue, next action, weak areas, and current learning status.',
    legacyRoutes: ['/home', '/placement-test'],
  },
  {
    id: 'plan',
    label: 'Plan',
    shortLabel: 'Plan',
    route: '/plan',
    icon: 'map',
    group: 'learn',
    description: 'Weekly path, upcoming lessons, completed items, and level goals.',
    legacyRoutes: ['/learning-plan'],
  },
  {
    id: 'review',
    label: 'Review',
    shortLabel: 'Review',
    route: '/review',
    icon: 'refresh-cw',
    group: 'memory',
    description: 'Due vocabulary, phrases, grammar mistakes, and saved corrections.',
    legacyRoutes: [],
  },
  {
    id: 'practice',
    label: 'Practice',
    shortLabel: 'Practice',
    route: '/practice',
    icon: 'dumbbell',
    group: 'practice',
    description: 'Free practice by skill, level, topic, and exam target.',
    legacyRoutes: ['/activity'],
  },
  {
    id: 'conversation',
    label: 'Conversation',
    shortLabel: 'Speak',
    route: '/conversation',
    icon: 'mic',
    group: 'practice',
    description: 'Text and push-to-talk tutor sessions with local transcript history.',
    legacyRoutes: ['/speaking-activity'],
  },
  {
    id: 'writing',
    label: 'Writing',
    shortLabel: 'Write',
    route: '/writing',
    icon: 'pen-line',
    group: 'practice',
    description: 'Prompts, drafts, feedback, revisions, and saved corrections.',
    legacyRoutes: [],
  },
  {
    id: 'mistakes',
    label: 'Mistakes',
    shortLabel: 'Mistakes',
    route: '/mistakes',
    icon: 'notebook-tabs',
    group: 'memory',
    description: 'Searchable notebook of grammar, vocabulary, pronunciation, and writing issues.',
    legacyRoutes: [],
  },
  {
    id: 'exam',
    label: 'Exam',
    shortLabel: 'Exam',
    route: '/exam',
    icon: 'timer',
    group: 'practice',
    description: 'Goethe-style timed practice and local reports.',
    legacyRoutes: ['/exam-simulator'],
  },
  {
    id: 'library',
    label: 'Library',
    shortLabel: 'Library',
    route: '/library',
    icon: 'library',
    group: 'learn',
    description: 'Saved readings, listening items, grammar notes, and local content packs.',
    legacyRoutes: [],
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    route: '/settings',
    icon: 'settings',
    group: 'system',
    description: 'Local profile, files, backups, AI provider, speech provider, and privacy.',
    legacyRoutes: ['/profile'],
  },
];

const destinationById = new Map<AppDestinationId, AppDestination>(
  appDestinations.map(destination => [destination.id, destination])
);

export function getDestinationById(id: AppDestinationId): AppDestination {
  const destination = destinationById.get(id);

  if (!destination) {
    throw new Error(`Unknown app destination: ${id}`);
  }

  return destination;
}

export function getDestinationByRoute(pathnameWithSearch: string): AppDestination {
  const pathname = normalizePathname(pathnameWithSearch);

  return (
    appDestinations.find(destination => routeMatchesDestination(destination, pathname)) ??
    getDestinationById('dashboard')
  );
}

export function isDestinationActive(destination: AppDestination, pathnameWithSearch: string): boolean {
  return routeMatchesDestination(destination, normalizePathname(pathnameWithSearch));
}

function routeMatchesDestination(destination: AppDestination, pathname: string): boolean {
  if (destination.route === pathname) {
    return true;
  }

  return destination.legacyRoutes.some(legacyRoute => {
    return pathname === legacyRoute || pathname.startsWith(`${legacyRoute}/`);
  });
}

function normalizePathname(pathnameWithSearch: string): string {
  const pathname = pathnameWithSearch.split('?')[0].split('#')[0] || '/';
  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  return withoutTrailingSlash || '/';
}
```

- [ ] **Step 4: Run the navigation tests and verify they pass**

Run:

```bash
npm run test:run -- tests/ui/navigationModel.test.ts
```

Expected result:

```text
PASS tests/ui/navigationModel.test.ts
```

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/ui/navigationModel.ts tests/ui/navigationModel.test.ts
git commit -m "feat: add experience navigation model"
```

Expected result:

```text
[master <hash>] feat: add experience navigation model
```

## Task 2: Provider Status Model

**Files:**
- Create: `tests/ui/providerStatusModel.test.ts`
- Create: `src/ui/providerStatusModel.ts`

- [ ] **Step 1: Write the failing provider status tests**

Create `tests/ui/providerStatusModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildLearningCapabilities,
  describeProviderStatus,
  type ProviderSettingsSnapshot,
} from '../../src/ui/providerStatusModel';

describe('providerStatusModel', () => {
  it('marks AI as disabled when no provider key is configured', () => {
    const status = describeProviderStatus({
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: false,
      configured: false,
      model: 'openrouter/auto',
    });

    expect(status.state).toBe('disabled');
    expect(status.headline).toBe('AI tutor is off');
    expect(status.actionLabel).toBe('Configure AI');
    expect(status.capabilities.canGenerateTutorResponses).toBe(false);
  });

  it('marks speech as configured when Deepgram is enabled with a key', () => {
    const status = describeProviderStatus({
      kind: 'speech',
      providerName: 'Deepgram',
      enabled: true,
      configured: true,
      model: 'nova-3',
      language: 'de',
    });

    expect(status.state).toBe('configured');
    expect(status.headline).toBe('Deepgram speech is ready');
    expect(status.detail).toContain('nova-3');
    expect(status.capabilities.canTranscribeSpeech).toBe(true);
  });

  it('keeps the provider visible when the last call failed', () => {
    const status = describeProviderStatus({
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: true,
      configured: true,
      model: 'openrouter/auto',
      lastError: '401 Unauthorized',
    });

    expect(status.state).toBe('error');
    expect(status.headline).toBe('OpenRouter needs attention');
    expect(status.detail).toContain('401 Unauthorized');
    expect(status.actionLabel).toBe('Review settings');
  });

  it('builds learner-facing capability flags from AI and speech states', () => {
    const ai: ProviderSettingsSnapshot = {
      kind: 'ai',
      providerName: 'OpenRouter',
      enabled: true,
      configured: true,
      model: 'openrouter/auto',
    };
    const speech: ProviderSettingsSnapshot = {
      kind: 'speech',
      providerName: 'Deepgram',
      enabled: false,
      configured: false,
      model: 'nova-3',
      language: 'de',
    };

    const capabilities = buildLearningCapabilities(ai, speech);

    expect(capabilities.aiTutorAvailable).toBe(true);
    expect(capabilities.voiceInputAvailable).toBe(false);
    expect(capabilities.textConversationAvailable).toBe(true);
    expect(capabilities.fallbackReasons).toEqual(['Voice input needs Deepgram settings.']);
  });
});
```

- [ ] **Step 2: Run the provider status tests and verify they fail**

Run:

```bash
npm run test:run -- tests/ui/providerStatusModel.test.ts
```

Expected result:

```text
FAIL tests/ui/providerStatusModel.test.ts
Cannot find module '../../src/ui/providerStatusModel'
```

- [ ] **Step 3: Add the provider status model**

Create `src/ui/providerStatusModel.ts`:

```ts
export type ProviderKind = 'ai' | 'speech';
export type ProviderState = 'configured' | 'disabled' | 'error';

export interface ProviderSettingsSnapshot {
  kind: ProviderKind;
  providerName: string;
  enabled: boolean;
  configured: boolean;
  model?: string;
  language?: string;
  lastError?: string;
}

export interface ProviderCapabilities {
  canGenerateTutorResponses: boolean;
  canGenerateActivities: boolean;
  canEvaluateWriting: boolean;
  canTranscribeSpeech: boolean;
}

export interface ProviderStatusDescription {
  kind: ProviderKind;
  providerName: string;
  state: ProviderState;
  headline: string;
  detail: string;
  actionLabel: string;
  capabilities: ProviderCapabilities;
}

export interface LearningCapabilities {
  aiTutorAvailable: boolean;
  activityGenerationAvailable: boolean;
  writingEvaluationAvailable: boolean;
  voiceInputAvailable: boolean;
  textConversationAvailable: boolean;
  fallbackReasons: string[];
}

export function describeProviderStatus(snapshot: ProviderSettingsSnapshot): ProviderStatusDescription {
  const state = getProviderState(snapshot);
  const capabilities = getProviderCapabilities(snapshot, state);

  if (state === 'disabled') {
    return {
      kind: snapshot.kind,
      providerName: snapshot.providerName,
      state,
      headline: snapshot.kind === 'ai' ? 'AI tutor is off' : 'Voice input is off',
      detail:
        snapshot.kind === 'ai'
          ? 'Local sample exercises remain available until an AI provider is configured.'
          : 'Text conversation remains available until a speech provider is configured.',
      actionLabel: snapshot.kind === 'ai' ? 'Configure AI' : 'Configure voice',
      capabilities,
    };
  }

  if (state === 'error') {
    return {
      kind: snapshot.kind,
      providerName: snapshot.providerName,
      state,
      headline: `${snapshot.providerName} needs attention`,
      detail: `Last provider error: ${snapshot.lastError}`,
      actionLabel: 'Review settings',
      capabilities,
    };
  }

  return {
    kind: snapshot.kind,
    providerName: snapshot.providerName,
    state,
    headline:
      snapshot.kind === 'ai'
        ? `${snapshot.providerName} AI is ready`
        : `${snapshot.providerName} speech is ready`,
    detail: describeConfiguredProvider(snapshot),
    actionLabel: 'Manage settings',
    capabilities,
  };
}

export function buildLearningCapabilities(
  aiSnapshot: ProviderSettingsSnapshot,
  speechSnapshot: ProviderSettingsSnapshot
): LearningCapabilities {
  const aiStatus = describeProviderStatus(aiSnapshot);
  const speechStatus = describeProviderStatus(speechSnapshot);
  const fallbackReasons: string[] = [];

  if (!aiStatus.capabilities.canGenerateTutorResponses) {
    fallbackReasons.push('AI tutor needs OpenRouter settings.');
  }

  if (!speechStatus.capabilities.canTranscribeSpeech) {
    fallbackReasons.push('Voice input needs Deepgram settings.');
  }

  return {
    aiTutorAvailable: aiStatus.capabilities.canGenerateTutorResponses,
    activityGenerationAvailable: aiStatus.capabilities.canGenerateActivities,
    writingEvaluationAvailable: aiStatus.capabilities.canEvaluateWriting,
    voiceInputAvailable: speechStatus.capabilities.canTranscribeSpeech,
    textConversationAvailable: true,
    fallbackReasons,
  };
}

function getProviderState(snapshot: ProviderSettingsSnapshot): ProviderState {
  if (!snapshot.enabled || !snapshot.configured) {
    return 'disabled';
  }

  if (snapshot.lastError) {
    return 'error';
  }

  return 'configured';
}

function getProviderCapabilities(
  snapshot: ProviderSettingsSnapshot,
  state: ProviderState
): ProviderCapabilities {
  const active = state === 'configured';

  return {
    canGenerateTutorResponses: active && snapshot.kind === 'ai',
    canGenerateActivities: active && snapshot.kind === 'ai',
    canEvaluateWriting: active && snapshot.kind === 'ai',
    canTranscribeSpeech: active && snapshot.kind === 'speech',
  };
}

function describeConfiguredProvider(snapshot: ProviderSettingsSnapshot): string {
  const parts = [snapshot.model, snapshot.language].filter(Boolean);

  if (parts.length === 0) {
    return `${snapshot.providerName} is configured.`;
  }

  return `${snapshot.providerName} is configured with ${parts.join(' / ')}.`;
}
```

- [ ] **Step 4: Run the provider status tests and verify they pass**

Run:

```bash
npm run test:run -- tests/ui/providerStatusModel.test.ts
```

Expected result:

```text
PASS tests/ui/providerStatusModel.test.ts
```

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/ui/providerStatusModel.ts tests/ui/providerStatusModel.test.ts
git commit -m "feat: add provider capability model"
```

Expected result:

```text
[master <hash>] feat: add provider capability model
```

## Task 3: Daily Learning Queue Model

**Files:**
- Create: `tests/ui/learningWorkflowModel.test.ts`
- Create: `src/ui/learningWorkflowModel.ts`

- [ ] **Step 1: Write failing queue tests**

Create `tests/ui/learningWorkflowModel.test.ts` with the first queue tests:

```ts
import { describe, expect, it } from 'vitest';
import { CEFRLevel, type LearningPlanItem } from '../../types';
import {
  buildDailyLearningQueue,
  type DailyLearningQueueInput,
} from '../../src/ui/learningWorkflowModel';

const planItem: LearningPlanItem = {
  id: 'plan-grammar-1',
  topic: 'Akkusativ articles',
  skill: 'Grammar',
  description: 'Practice definite and indefinite articles in Akkusativ.',
  completed: false,
};

function createQueueInput(): DailyLearningQueueInput {
  return {
    level: CEFRLevel.A2,
    targetLevel: CEFRLevel.B1,
    dailyTargetMinutes: 25,
    dueReviews: [
      {
        id: 'review-1',
        title: 'der, die, das corrections',
        skill: 'Grammar',
        level: CEFRLevel.A1,
        dueAt: '2026-05-15T08:00:00.000Z',
        priority: 1,
      },
    ],
    activePlanItems: [planItem],
    weakAreas: [
      {
        id: 'weak-speaking-1',
        skill: 'Speaking',
        topic: 'Ordering food',
        level: CEFRLevel.A2,
        score: 54,
        reason: 'Recent speaking sessions show missing verb-second word order.',
      },
    ],
    preferences: {
      includeConversation: true,
      includeWriting: true,
      examGoal: 'Goethe B1',
    },
  };
}

describe('learningWorkflowModel queue', () => {
  it('orders due reviews before plan work and weak-area practice', () => {
    const queue = buildDailyLearningQueue(createQueueInput());

    expect(queue.map(item => item.source)).toEqual([
      'review',
      'plan',
      'weak-area',
      'conversation',
      'writing',
      'exam',
    ]);
  });

  it('creates learner-facing reasons for each queue item', () => {
    const queue = buildDailyLearningQueue(createQueueInput());

    expect(queue[0]).toMatchObject({
      title: 'Review: der, die, das corrections',
      route: '/review',
      reason: 'Due now from your saved corrections.',
    });
    expect(queue[1]).toMatchObject({
      title: 'Akkusativ articles',
      route: '/practice',
      reason: 'Next item from your A2 to B1 plan.',
    });
    expect(queue[2].reason).toContain('Recent speaking sessions');
  });

  it('omits optional conversation, writing, and exam items when disabled', () => {
    const queue = buildDailyLearningQueue({
      ...createQueueInput(),
      preferences: {
        includeConversation: false,
        includeWriting: false,
      },
    });

    expect(queue.map(item => item.source)).toEqual(['review', 'plan', 'weak-area']);
  });

  it('limits the queue to the daily target without dropping due reviews', () => {
    const queue = buildDailyLearningQueue({
      ...createQueueInput(),
      dailyTargetMinutes: 10,
    });

    expect(queue.map(item => item.source)).toEqual(['review', 'plan']);
    expect(queue.reduce((minutes, item) => minutes + item.estimatedMinutes, 0)).toBe(18);
  });
});
```

- [ ] **Step 2: Run the queue tests and verify they fail**

Run:

```bash
npm run test:run -- tests/ui/learningWorkflowModel.test.ts
```

Expected result:

```text
FAIL tests/ui/learningWorkflowModel.test.ts
Cannot find module '../../src/ui/learningWorkflowModel'
```

- [ ] **Step 3: Add the daily queue implementation**

Create `src/ui/learningWorkflowModel.ts` with the queue model:

```ts
import { CEFRLevel, type LearningPlanItem, type SkillType } from '../../types';
import type { ActivityType, ActivityResult } from '../types/activity.types';

export type QueueSource =
  | 'review'
  | 'plan'
  | 'weak-area'
  | 'conversation'
  | 'writing'
  | 'exam';

export interface DueReviewItem {
  id: string;
  title: string;
  skill: SkillType;
  level: CEFRLevel;
  dueAt: string;
  priority: number;
}

export interface WeakAreaItem {
  id: string;
  skill: SkillType;
  topic: string;
  level: CEFRLevel;
  score: number;
  reason: string;
}

export interface DailyLearningPreferences {
  includeConversation: boolean;
  includeWriting: boolean;
  examGoal?: string;
}

export interface DailyLearningQueueInput {
  level: CEFRLevel;
  targetLevel: CEFRLevel;
  dailyTargetMinutes: number;
  dueReviews: DueReviewItem[];
  activePlanItems: LearningPlanItem[];
  weakAreas: WeakAreaItem[];
  preferences: DailyLearningPreferences;
}

export interface DailyLearningQueueItem {
  id: string;
  title: string;
  skill: SkillType | 'Mixed';
  level: CEFRLevel;
  estimatedMinutes: number;
  source: QueueSource;
  reason: string;
  route: string;
  priority: number;
  intent:
    | { type: 'review'; reviewId: string }
    | { type: 'activity'; activityType: ActivityType; planItemId?: string; topic: string }
    | { type: 'conversation'; mode: 'free-talk' | 'roleplay' | 'pronunciation-check' }
    | { type: 'writing'; promptSource: 'daily' }
    | { type: 'exam'; examGoal: string };
  completionEffect: 'review-card' | 'plan-progress' | 'mistake-capture' | 'transcript' | 'writing-revision' | 'exam-report';
}

export function buildDailyLearningQueue(input: DailyLearningQueueInput): DailyLearningQueueItem[] {
  const dueReviewItems = input.dueReviews
    .slice()
    .sort((left, right) => left.priority - right.priority || left.dueAt.localeCompare(right.dueAt))
    .map(mapReviewToQueueItem);

  const planQueueItem = input.activePlanItems.find(item => !item.completed);
  const weakestArea = input.weakAreas.slice().sort((left, right) => left.score - right.score)[0];
  const queue: DailyLearningQueueItem[] = [...dueReviewItems];

  if (planQueueItem) {
    queue.push(mapPlanItemToQueueItem(planQueueItem, input.level, input.targetLevel));
  }

  if (weakestArea) {
    queue.push(mapWeakAreaToQueueItem(weakestArea));
  }

  if (input.preferences.includeConversation) {
    queue.push({
      id: 'conversation-daily',
      title: 'Speak for 5 minutes',
      skill: 'Speaking',
      level: input.level,
      estimatedMinutes: 5,
      source: 'conversation',
      reason: 'Short speaking turns keep active recall fresh.',
      route: '/conversation',
      priority: 40,
      intent: { type: 'conversation', mode: 'free-talk' },
      completionEffect: 'transcript',
    });
  }

  if (input.preferences.includeWriting) {
    queue.push({
      id: 'writing-daily',
      title: 'Write a short answer',
      skill: 'Writing',
      level: input.level,
      estimatedMinutes: 8,
      source: 'writing',
      reason: 'Writing turns passive grammar into production practice.',
      route: '/writing',
      priority: 50,
      intent: { type: 'writing', promptSource: 'daily' },
      completionEffect: 'writing-revision',
    });
  }

  if (input.preferences.examGoal) {
    queue.push({
      id: 'exam-daily',
      title: `${input.preferences.examGoal} exam drill`,
      skill: 'Mixed',
      level: input.level,
      estimatedMinutes: 12,
      source: 'exam',
      reason: `Your goal includes ${input.preferences.examGoal}.`,
      route: '/exam',
      priority: 60,
      intent: { type: 'exam', examGoal: input.preferences.examGoal },
      completionEffect: 'exam-report',
    });
  }

  return limitQueueToDailyTarget(queue, input.dailyTargetMinutes);
}

function mapReviewToQueueItem(review: DueReviewItem): DailyLearningQueueItem {
  return {
    id: `queue-${review.id}`,
    title: `Review: ${review.title}`,
    skill: review.skill,
    level: review.level,
    estimatedMinutes: 6,
    source: 'review',
    reason: 'Due now from your saved corrections.',
    route: '/review',
    priority: review.priority,
    intent: { type: 'review', reviewId: review.id },
    completionEffect: 'review-card',
  };
}

function mapPlanItemToQueueItem(
  item: LearningPlanItem,
  currentLevel: CEFRLevel,
  targetLevel: CEFRLevel
): DailyLearningQueueItem {
  return {
    id: `queue-${item.id ?? item.topic}`,
    title: item.topic,
    skill: item.skill,
    level: currentLevel,
    estimatedMinutes: 12,
    source: 'plan',
    reason: `Next item from your ${currentLevel} to ${targetLevel} plan.`,
    route: '/practice',
    priority: 20,
    intent: {
      type: 'activity',
      activityType: skillToActivityType(item.skill),
      planItemId: item.id,
      topic: item.topic,
    },
    completionEffect: 'plan-progress',
  };
}

function mapWeakAreaToQueueItem(weakArea: WeakAreaItem): DailyLearningQueueItem {
  return {
    id: `queue-${weakArea.id}`,
    title: `${weakArea.topic} repair`,
    skill: weakArea.skill,
    level: weakArea.level,
    estimatedMinutes: 10,
    source: 'weak-area',
    reason: weakArea.reason,
    route: weakArea.skill === 'Speaking' ? '/conversation' : '/practice',
    priority: 30,
    intent:
      weakArea.skill === 'Speaking'
        ? { type: 'conversation', mode: 'pronunciation-check' }
        : {
            type: 'activity',
            activityType: skillToActivityType(weakArea.skill),
            topic: weakArea.topic,
          },
    completionEffect: 'mistake-capture',
  };
}

function limitQueueToDailyTarget(
  queue: DailyLearningQueueItem[],
  dailyTargetMinutes: number
): DailyLearningQueueItem[] {
  const requiredReviews = queue.filter(item => item.source === 'review');
  const optionalItems = queue.filter(item => item.source !== 'review');
  const selected = [...requiredReviews];
  let selectedMinutes = selected.reduce((total, item) => total + item.estimatedMinutes, 0);

  for (const item of optionalItems) {
    if (selected.length === requiredReviews.length || selectedMinutes + item.estimatedMinutes <= dailyTargetMinutes) {
      selected.push(item);
      selectedMinutes += item.estimatedMinutes;
    }
  }

  return selected;
}

function skillToActivityType(skill: SkillType): ActivityType {
  const map: Record<SkillType, ActivityType> = {
    Grammar: 'grammar',
    Vocabulary: 'vocabulary',
    Listening: 'listening',
    Writing: 'writing',
    Speaking: 'speaking',
    Reading: 'reading',
  };

  return map[skill];
}
```

- [ ] **Step 4: Run the queue tests and verify they pass**

Run:

```bash
npm run test:run -- tests/ui/learningWorkflowModel.test.ts
```

Expected result:

```text
PASS tests/ui/learningWorkflowModel.test.ts
```

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add src/ui/learningWorkflowModel.ts tests/ui/learningWorkflowModel.test.ts
git commit -m "feat: add daily learning queue model"
```

Expected result:

```text
[master <hash>] feat: add daily learning queue model
```

## Task 4: Activity Session State And Learning-Memory Effects

**Files:**
- Modify: `tests/ui/learningWorkflowModel.test.ts`
- Modify: `src/ui/learningWorkflowModel.ts`

- [ ] **Step 1: Add failing session and memory-effect tests**

Append this block to `tests/ui/learningWorkflowModel.test.ts`:

```ts
import {
  advanceActivitySession,
  createActivitySession,
  createLearningMemoryEffects,
} from '../../src/ui/learningWorkflowModel';

describe('learningWorkflowModel activity sessions', () => {
  it('moves through prepare, active, feedback, saving-memory, and complete states', () => {
    const session = createActivitySession({
      id: 'session-1',
      activityType: 'grammar',
      topic: 'Akkusativ articles',
      level: CEFRLevel.A2,
      startedAt: '2026-05-15T09:00:00.000Z',
    });

    const active = advanceActivitySession(session, { type: 'start' });
    const feedback = advanceActivitySession(active, {
      type: 'submit-result',
      result: {
        activity_type: 'grammar',
        score: 68,
        completed: true,
        time_spent_seconds: 420,
        data: {
          corrections: [
            {
              id: 'correction-1',
              skill: 'Grammar',
              original: 'Ich sehe der Mann.',
              corrected: 'Ich sehe den Mann.',
              explanation: 'Akkusativ masculine changes der to den.',
            },
          ],
        },
      },
    });
    const saving = advanceActivitySession(feedback, { type: 'save-memory' });
    const complete = advanceActivitySession(saving, { type: 'finish' });

    expect(session.state).toBe('prepare');
    expect(active.state).toBe('active');
    expect(feedback.state).toBe('feedback');
    expect(saving.state).toBe('saving-memory');
    expect(complete.state).toBe('complete');
    expect(complete.savedEffects.map(effect => effect.type)).toEqual(['mistake-note', 'review-card']);
  });

  it('throws a clear error for invalid session transitions', () => {
    const session = createActivitySession({
      id: 'session-2',
      activityType: 'writing',
      topic: 'Daily routine',
      level: CEFRLevel.A2,
    });

    expect(() => advanceActivitySession(session, { type: 'finish' })).toThrow(
      'Cannot finish activity session from prepare'
    );
  });

  it('converts corrections, vocabulary, and writing revisions into learning-memory effects', () => {
    const effects = createLearningMemoryEffects({
      activity_type: 'writing',
      score: 72,
      completed: true,
      time_spent_seconds: 600,
      data: {
        corrected_text: 'Ich gehe jeden Morgen zur Arbeit.',
        corrections: [
          {
            id: 'correction-2',
            skill: 'Writing',
            original: 'Ich gehe jede Morgen zu Arbeit.',
            corrected: 'Ich gehe jeden Morgen zur Arbeit.',
            explanation: 'Use accusative jeden Morgen and contraction zur.',
          },
        ],
        vocabulary: [
          {
            id: 'vocab-1',
            german: 'zur Arbeit',
            translation: 'to work',
            example: 'Ich fahre zur Arbeit.',
          },
        ],
      },
    });

    expect(effects).toEqual([
      {
        id: 'mistake-correction-2',
        type: 'mistake-note',
        title: 'Writing correction',
        skill: 'Writing',
        reviewPrompt: 'Ich gehe jede Morgen zu Arbeit.',
        reviewAnswer: 'Ich gehe jeden Morgen zur Arbeit.',
        explanation: 'Use accusative jeden Morgen and contraction zur.',
      },
      {
        id: 'vocabulary-vocab-1',
        type: 'vocabulary-card',
        title: 'zur Arbeit',
        skill: 'Vocabulary',
        reviewPrompt: 'zur Arbeit',
        reviewAnswer: 'to work',
        explanation: 'Ich fahre zur Arbeit.',
      },
      {
        id: 'writing-revision-writing',
        type: 'writing-revision',
        title: 'Saved writing revision',
        skill: 'Writing',
        reviewPrompt: 'Review the corrected version of your writing.',
        reviewAnswer: 'Ich gehe jeden Morgen zur Arbeit.',
        explanation: 'Saved from writing feedback.',
      },
      {
        id: 'review-writing-72',
        type: 'review-card',
        title: 'Review writing score 72%',
        skill: 'Writing',
        reviewPrompt: 'Practice the corrections from this writing session.',
        reviewAnswer: 'Open the saved feedback and rewrite the answer.',
        explanation: 'Scores below 80% return to review.',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the session tests and verify they fail**

Run:

```bash
npm run test:run -- tests/ui/learningWorkflowModel.test.ts
```

Expected result:

```text
FAIL tests/ui/learningWorkflowModel.test.ts
advanceActivitySession is not exported
```

- [ ] **Step 3: Add session and learning-memory model code**

Append this code to `src/ui/learningWorkflowModel.ts`:

```ts
export type ActivitySessionState = 'prepare' | 'active' | 'feedback' | 'saving-memory' | 'complete';

export interface ActivitySessionModel {
  id: string;
  activityType: ActivityType;
  topic: string;
  level: CEFRLevel;
  state: ActivitySessionState;
  startedAt?: string;
  result?: ActivityResult;
  savedEffects: LearningMemoryEffect[];
}

export type ActivitySessionEvent =
  | { type: 'start' }
  | { type: 'submit-result'; result: ActivityResult }
  | { type: 'save-memory' }
  | { type: 'finish' };

export type LearningMemoryEffectType =
  | 'mistake-note'
  | 'vocabulary-card'
  | 'review-card'
  | 'writing-revision';

export interface LearningMemoryEffect {
  id: string;
  type: LearningMemoryEffectType;
  title: string;
  skill: SkillType;
  reviewPrompt: string;
  reviewAnswer: string;
  explanation: string;
}

interface ActivityCorrection {
  id: string;
  skill: SkillType;
  original: string;
  corrected: string;
  explanation: string;
}

interface ActivityVocabularyCapture {
  id: string;
  german: string;
  translation: string;
  example: string;
}

interface ActivityResultData {
  corrections?: ActivityCorrection[];
  vocabulary?: ActivityVocabularyCapture[];
  corrected_text?: string;
}

export function createActivitySession(input: {
  id: string;
  activityType: ActivityType;
  topic: string;
  level: CEFRLevel;
  startedAt?: string;
}): ActivitySessionModel {
  return {
    id: input.id,
    activityType: input.activityType,
    topic: input.topic,
    level: input.level,
    state: 'prepare',
    startedAt: input.startedAt,
    savedEffects: [],
  };
}

export function advanceActivitySession(
  session: ActivitySessionModel,
  event: ActivitySessionEvent
): ActivitySessionModel {
  if (event.type === 'start' && session.state === 'prepare') {
    return {
      ...session,
      state: 'active',
      startedAt: session.startedAt ?? new Date().toISOString(),
    };
  }

  if (event.type === 'submit-result' && session.state === 'active') {
    return {
      ...session,
      state: 'feedback',
      result: event.result,
    };
  }

  if (event.type === 'save-memory' && session.state === 'feedback') {
    return {
      ...session,
      state: 'saving-memory',
      savedEffects: session.result ? createLearningMemoryEffects(session.result) : [],
    };
  }

  if (event.type === 'finish' && session.state === 'saving-memory') {
    return {
      ...session,
      state: 'complete',
    };
  }

  throw new Error(`Cannot ${event.type.replace('-', ' ')} activity session from ${session.state}`);
}

export function createLearningMemoryEffects(result: ActivityResult): LearningMemoryEffect[] {
  const data = (result.data ?? {}) as ActivityResultData;
  const effects: LearningMemoryEffect[] = [];

  for (const correction of data.corrections ?? []) {
    effects.push({
      id: `mistake-${correction.id}`,
      type: 'mistake-note',
      title: `${correction.skill} correction`,
      skill: correction.skill,
      reviewPrompt: correction.original,
      reviewAnswer: correction.corrected,
      explanation: correction.explanation,
    });
  }

  for (const vocabulary of data.vocabulary ?? []) {
    effects.push({
      id: `vocabulary-${vocabulary.id}`,
      type: 'vocabulary-card',
      title: vocabulary.german,
      skill: 'Vocabulary',
      reviewPrompt: vocabulary.german,
      reviewAnswer: vocabulary.translation,
      explanation: vocabulary.example,
    });
  }

  if (result.activity_type === 'writing' && data.corrected_text) {
    effects.push({
      id: 'writing-revision-writing',
      type: 'writing-revision',
      title: 'Saved writing revision',
      skill: 'Writing',
      reviewPrompt: 'Review the corrected version of your writing.',
      reviewAnswer: data.corrected_text,
      explanation: 'Saved from writing feedback.',
    });
  }

  if (result.score < 80) {
    const skill = activityTypeToSkill(result.activity_type);
    effects.push({
      id: `review-${result.activity_type}-${result.score}`,
      type: 'review-card',
      title: `Review ${result.activity_type} score ${result.score}%`,
      skill,
      reviewPrompt: `Practice the corrections from this ${result.activity_type} session.`,
      reviewAnswer: 'Open the saved feedback and rewrite the answer.',
      explanation: 'Scores below 80% return to review.',
    });
  }

  return effects;
}

function activityTypeToSkill(activityType: ActivityType): SkillType {
  const map: Record<ActivityType, SkillType> = {
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
    listening: 'Listening',
    writing: 'Writing',
    speaking: 'Speaking',
    reading: 'Reading',
  };

  return map[activityType];
}
```

- [ ] **Step 4: Run the session tests and verify they pass**

Run:

```bash
npm run test:run -- tests/ui/learningWorkflowModel.test.ts
```

Expected result:

```text
PASS tests/ui/learningWorkflowModel.test.ts
```

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src/ui/learningWorkflowModel.ts tests/ui/learningWorkflowModel.test.ts
git commit -m "feat: model activity session memory effects"
```

Expected result:

```text
[master <hash>] feat: model activity session memory effects
```

## Task 5: Visual Concept Brief

**Files:**
- Create: `docs/superpowers/specs/2026-05-15-deutschboost-visual-concept-brief.md`

- [ ] **Step 1: Create the visual concept brief**

Create `docs/superpowers/specs/2026-05-15-deutschboost-visual-concept-brief.md`:

```md
# DeutschBoost Visual Concept Brief

Status: ready for image concept generation
Date: 2026-05-15

## Product

DeutschBoost is becoming a local-first desktop German learning workstation. The UI should feel like a focused productivity app for repeated study, not a marketing SaaS dashboard.

## Audience

Adult German learners who want structured daily progress, review, speaking practice, and exam preparation. The app should support serious repeated use without visual noise.

## Required Concept Screens

Generate one readable desktop concept for each surface:

1. Dashboard learning cockpit
2. Activity session and result flow
3. Conversation with push-to-talk transcript
4. Mistake notebook plus review queue
5. Settings for local files, AI, speech, and privacy

## Shared Layout Rules

- Desktop-first layout.
- Compact left sidebar or rail.
- Top page header inside each destination.
- Stable action area for start, submit, save, retry, and next.
- Dense but readable content.
- No marketing hero as the app home.
- No nested cards.
- No decorative gradient-orb backgrounds.
- No giant rounded controls when compact controls work better.
- No one-note purple or blue gradient palette.

## Dashboard Requirements

The dashboard must show:

- One primary next action.
- Today's queue.
- Due review count.
- Current CEFR level and target.
- Weak areas.
- Weekly progress strip.
- Recent session summary.

## Activity Requirements

The activity concept must show:

- Prepare or active task area.
- Progress indicator.
- Answer interaction area.
- Result feedback.
- Saved mistakes or review effects.
- Return to next queue action.

## Conversation Requirements

The conversation concept must show:

- Text input mode.
- Voice turn mode.
- Transcript rows.
- Deepgram-style confidence/status shown as product state, not provider debug noise.
- Tutor feedback and saved corrections.

## Mistakes And Review Requirements

The mistakes/review concept must show:

- Search and filters.
- Mistake list.
- Review card.
- Status such as new, learning, mastered, ignored.
- Link back to source session.

## Settings Requirements

The settings concept must show:

- Local profile.
- Data location.
- Backup/export/import.
- AI provider status.
- Speech provider status.
- Privacy explanation for data leaving the device.

## Visual Tone

Use a restrained, modern desktop app style:

- clean typography
- calm neutral foundation
- clear semantic color
- sharp information hierarchy
- productive density
- 8px or smaller card radius unless the accepted design requires a different system
- icons for navigation and controls

The accepted concept will define the design tokens and screen implementation for the next slice.
```

- [ ] **Step 2: Commit Task 5**

Run:

```bash
git add docs/superpowers/specs/2026-05-15-deutschboost-visual-concept-brief.md
git commit -m "docs: add DeutschBoost visual concept brief"
```

Expected result:

```text
[master <hash>] docs: add DeutschBoost visual concept brief
```

## Task 6: Full Verification

**Files:**
- Verify all files from Tasks 1-5.

- [ ] **Step 1: Run focused UI model tests**

Run:

```bash
npm run test:run -- tests/ui
```

Expected result:

```text
PASS tests/ui/navigationModel.test.ts
PASS tests/ui/providerStatusModel.test.ts
PASS tests/ui/learningWorkflowModel.test.ts
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm run test:run
```

Expected result:

```text
Test Files 12 passed
Tests 80 passed
```

The exact total can be higher if more tests were added in the existing Phase 1 work. Failures in touched files must be fixed before continuing.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected result:

```text
vite build
built in
```

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected result includes only pre-existing uncommitted Phase 1 work, unless the executor intentionally kept these new files uncommitted:

```text
 M services/activityService.ts
 M tests/services/activityService.test.ts
?? docs/superpowers/plans/
?? docs/superpowers/specs/2026-05-15-deutschboost-local-first-redesign.md
?? src/domain/
?? tests/domain/
```

- [ ] **Step 5: Save completion to Vault**

Save a Vault handoff with:

```json
{
  "project": "DeutschBoost",
  "memory_type": "handoff",
  "subject": "Phase 1.5 experience models implementation",
  "title": "Phase 1.5 slice: navigation, provider status, queue, and session models",
  "summary": "Implemented the pure TypeScript models for the experience-first local app: navigation destinations, provider capability state, daily learning queue, activity session transitions, learning-memory effects, and visual concept brief. Tests and build results should be recorded in the content.",
  "keywords": ["navigationModel", "providerStatusModel", "learningWorkflowModel", "daily-queue", "mistakes", "review"],
  "tags": ["implementation", "phase-1-5", "ui-ux", "local-first"],
  "routine_type": "implementation",
  "source_app": "codex",
  "related_files": [
    "src/ui/navigationModel.ts",
    "src/ui/providerStatusModel.ts",
    "src/ui/learningWorkflowModel.ts",
    "tests/ui/navigationModel.test.ts",
    "tests/ui/providerStatusModel.test.ts",
    "tests/ui/learningWorkflowModel.test.ts",
    "docs/superpowers/specs/2026-05-15-deutschboost-visual-concept-brief.md"
  ],
  "next_steps": [
    "Generate and approve visual concepts for the five primary app surfaces.",
    "Build design tokens from the accepted concept.",
    "Replace the app shell and dashboard using the new models."
  ]
}
```

## Plan Self-Review

- Spec coverage: This plan covers the first implementation slice from the approved Phase 1.5 spec: navigation, provider disabled/configured states, queue ordering, activity session loop, mistake/review effects, and the visual concept gate.
- Deferred scope: React screen replacement, design tokens, and browser visual verification are intentionally split into the next plan because they depend on approved image concepts.
- Type consistency: `ActivityType`, `ActivityResult`, `CEFRLevel`, `LearningPlanItem`, and `SkillType` all reuse existing project types.
- Test strategy: Each pure model gets focused Vitest coverage before implementation, then the full suite and build run at the end.

## Execution Handoff

Plan complete when saved to `docs/superpowers/plans/2026-05-15-deutschboost-phase-1-5-experience-models.md`.

Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.
