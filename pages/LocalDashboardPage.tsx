import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CEFRLevel, type LearningPlan, type LearningPlanItem } from '../types';
import { loadActiveLearningPlan } from '../services/learningPlanService';
import {
  createDefaultLearnerProfile,
  type LearnerProfile,
  type ProfileRepository,
} from '../src/domain/profile/profileRepository';
import type {
  ConversationRepository,
  ConversationSessionRecord,
} from '../src/domain/conversation/conversationRepository';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { browserConversationRepository } from '../src/infrastructure/browser/conversationStorage';
import { buildDailyLearningQueue, type DailyLearningQueueItem } from '../src/ui/learningWorkflowModel';
import { PageHeader, Card, Stat, Ring, Badge, ProgressBar } from '../components/ui';

const LOCAL_LEARNER_ID = 'local-learner';

type LearningPlanLoader = typeof loadActiveLearningPlan;

interface LocalDashboardPageProps {
  learnerId?: string;
  profileRepository?: ProfileRepository;
  learningPlanLoader?: LearningPlanLoader;
  conversationRepository?: Pick<ConversationRepository, 'loadRecentSessions'>;
}

interface PrimaryAction {
  title: string;
  route: string;
  estimatedMinutes: number;
  reason: string;
}

const LocalDashboardPage: React.FC<LocalDashboardPageProps> = ({
  learnerId = LOCAL_LEARNER_ID,
  profileRepository = browserProfileRepository,
  learningPlanLoader = loadActiveLearningPlan,
  conversationRepository = browserConversationRepository,
}) => {
  const [profile, setProfile] = useState<LearnerProfile>(createDefaultLearnerProfile);
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [recentSessions, setRecentSessions] = useState<ConversationSessionRecord[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardState() {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const [loadedProfile, planResult, sessions] = await Promise.all([
          profileRepository.loadProfile(),
          learningPlanLoader(learnerId),
          conversationRepository.loadRecentSessions(learnerId, 1),
        ]);

        if (cancelled) return;

        if (planResult.error) {
          setErrorMessage(planResult.error.message);
          setLoadState('error');
        } else {
          setProfile(loadedProfile);
          setLearningPlan(planResult.plan);
          setRecentSessions(sessions);
          setLoadState('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Dashboard could not load');
          setLoadState('error');
        }
      }
    }

    loadDashboardState();

    return () => {
      cancelled = true;
    };
  }, [conversationRepository, learnerId, learningPlanLoader, profileRepository]);

  const activePlanItems = useMemo(() => getActivePlanItems(learningPlan), [learningPlan]);
  const queue = useMemo(
    () =>
      buildDailyLearningQueue({
        level: profile.currentLevel,
        targetLevel: profile.targetLevel,
        dailyTargetMinutes: profile.dailyGoalMinutes,
        dueReviews: [],
        activePlanItems,
        weakAreas: [],
        preferences: {
          includeConversation: true,
          includeWriting: false,
        },
      }),
    [activePlanItems, profile.currentLevel, profile.dailyGoalMinutes, profile.targetLevel]
  );
  const planProgress = calculatePlanProgress(activePlanItems);
  const primaryAction = getPrimaryAction({ learningPlan, queue });
  const lastSession = recentSessions[0] ?? null;

  return (
    <main aria-label="DeutschBoost dashboard">
      <PageHeader
        title="Guten Morgen!"
        subtitle="Hier ist dein lokales Lerncockpit fuer heute."
        actions={
          <div
            className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2"
            aria-label="Current learning target"
          >
            <div className="flex flex-col leading-tight">
              <strong className="text-[14px] font-bold text-text">
                {profile.currentLevel} -&gt; {profile.targetLevel}
              </strong>
              <span className="text-[12px] text-text-muted">Dein aktuelles Ziel</span>
            </div>
            <Ring value={planProgress.percent} label="Plan" />
          </div>
        }
      />

      <nav
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Quick study actions"
      >
        {[
          { to: '/conversation', icon: 'fa-comments', label: 'Sprechen' },
          { to: '/practice', icon: 'fa-dumbbell', label: 'Ueben' },
          { to: '/plan', icon: 'fa-calendar-days', label: 'Plan' },
          { to: '/settings', icon: 'fa-gear', label: 'Provider' },
        ].map(action => (
          <Link
            key={action.to}
            to={action.to}
            className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-[14px] font-medium text-text transition-colors hover:border-brand"
          >
            <i className={`fa-solid ${action.icon} text-text-muted`} aria-hidden="true" />
            <span>{action.label}</span>
          </Link>
        ))}
      </nav>

      {loadState === 'error' ? (
        <div role="alert" className="mb-6">
          <Card title="Dashboard could not load">
            <p className="text-[13px] text-text-muted">
              {errorMessage ?? 'Local dashboard data could not be read.'}
            </p>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-labelledby="next-action-heading">
          <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
            Naechste Aktion
          </span>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div>
              <h2 id="next-action-heading" className="text-[18px] font-bold text-text">
                {primaryAction.title}
              </h2>
              <div className="mt-1 flex flex-wrap gap-3 text-[13px] text-text-muted">
                <span>
                  <i className="fa-regular fa-clock" aria-hidden="true" />{' '}
                  {primaryAction.estimatedMinutes} min
                </span>
                <span>{primaryAction.reason}</span>
              </div>
            </div>
            <Link
              to={primaryAction.route}
              role="button"
              className="inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-[14px] font-medium text-text transition-colors hover:bg-brand-strong hover:text-white"
            >
              <i className="fa-solid fa-play" aria-hidden="true" />
              Starten
            </Link>
          </div>
        </Card>

        <Card aria-labelledby="queue-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="queue-heading" className="text-[16px] font-semibold text-text">
              Heutige Queue
            </h2>
            <Badge>{queue.length} Aufgaben</Badge>
          </div>
          {queue.length > 0 ? (
            <ul className="flex flex-col gap-2" aria-label="Today queue">
              {queue.map(item => (
                <QueueRow key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-text-muted">
              No local queue yet. Create a plan to generate the first study path.
            </p>
          )}
        </Card>

        <Card aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-[16px] font-semibold text-text">
            Faellige Reviews
          </h2>
          <strong className="mt-2 block text-[28px] font-bold text-text">0</strong>
          <span className="text-[13px] text-text-muted">No review cards yet</span>
          <p className="mt-2 text-[12px] text-text-muted">
            Review cards will appear after corrections are saved locally.
          </p>
        </Card>

        <Card aria-labelledby="focus-heading">
          <h2 id="focus-heading" className="mb-3 text-[16px] font-semibold text-text">
            Aktueller Fokus
          </h2>
          <div className="flex flex-col gap-2">
            {activePlanItems.slice(0, 3).map(item => (
              <div
                className="flex items-center justify-between gap-2 text-[13px]"
                key={item.id ?? item.topic}
              >
                <span className="text-text">{item.topic}</span>
                <span className="text-text-muted">{item.skill}</span>
                <Badge tone={item.completed ? 'neutral' : 'brand'}>
                  {item.completed ? 'Done' : 'Next'}
                </Badge>
              </div>
            ))}
            {activePlanItems.length === 0 ? (
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-text">No plan focus yet</span>
                <span className="text-text-muted">{profile.currentLevel}</span>
                <Badge>Local</Badge>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="lg:col-span-2" aria-labelledby="progress-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="progress-heading" className="text-[16px] font-semibold text-text">
              Lokaler Fortschritt
            </h2>
            <Badge>{loadState === 'loading' ? 'Loading' : 'Device only'}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ProgressStat
              label="Study streak"
              value={`${profile.studyStreak} days`}
              percent={profile.studyStreak > 0 ? 100 : 0}
            />
            <ProgressStat
              label="Total study time"
              value={formatStudyTime(profile.totalStudyTimeMinutes)}
              percent={Math.min(
                100,
                Math.round((profile.totalStudyTimeMinutes / Math.max(profile.dailyGoalMinutes, 1)) * 100)
              )}
            />
            <ProgressStat
              label="Plan progress"
              value={`${planProgress.completed} / ${planProgress.total}`}
              percent={planProgress.percent}
            />
          </div>
        </Card>

        <Card aria-labelledby="session-heading">
          <h2 id="session-heading" className="mb-2 text-[16px] font-semibold text-text">
            Letzte Session
          </h2>
          {lastSession ? (
            <>
              <span className="text-[13px] text-text-muted">
                {formatSessionDuration(lastSession)}
              </span>
              <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Transcript</dt>
                  <dd className="text-text">{lastSession.transcript.length} transcript turns</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Mode</dt>
                  <dd className="text-text">{formatMode(lastSession.mode)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Saved</dt>
                  <dd className="text-text">
                    {formatDate(lastSession.endedAt ?? lastSession.startedAt)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <span className="text-[13px] text-text-muted">No saved local sessions yet</span>
              <p className="mt-2 text-[12px] text-text-muted">
                Conversation history will appear here after your first local speaking session.
              </p>
            </>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-success">
            <i className="fa-solid fa-check" aria-hidden="true" /> Device-only storage active
          </p>
        </Card>
      </div>
    </main>
  );
};

interface QueueRowProps {
  item: DailyLearningQueueItem;
}

const QueueRow: React.FC<QueueRowProps> = ({ item }) => (
  <li>
    <Link
      to={item.route}
      aria-label={`${formatQueueTitle(item)}, ${item.estimatedMinutes} minutes`}
      className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 transition-colors hover:border-brand"
    >
      <span
        className="grid h-7 w-7 flex-none place-items-center rounded-pill bg-surface-soft text-[12px] font-bold text-text-muted"
        aria-hidden="true"
      >
        {getSourceInitial(item)}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-[13px] font-semibold text-text">
          {formatQueueSource(item)}
        </strong>
        <span className="block truncate text-[12px] text-text-muted">
          {formatQueueTitle(item)}
        </span>
      </div>
      <span className="text-[12px] text-text-muted">{item.estimatedMinutes} min</span>
      <b className="text-[12px] font-medium text-brand-strong">{formatQueueTag(item)}</b>
    </Link>
  </li>
);

const ProgressStat: React.FC<{ label: string; value: string; percent: number }> = ({
  label,
  value,
  percent,
}) => (
  <div className="rounded-card border border-border bg-surface p-4">
    <span className="text-[12px] font-medium uppercase tracking-wide text-text-muted">{label}</span>
    <strong className="mt-1 block text-[18px] font-bold text-text">{value}</strong>
    <div className="mt-2">
      <ProgressBar value={percent} label={label} />
    </div>
  </div>
);

function getActivePlanItems(plan: LearningPlan | null): LearningPlanItem[] {
  return plan?.weeks.flatMap(week => week.items) ?? [];
}

function getPrimaryAction(input: {
  learningPlan: LearningPlan | null;
  queue: DailyLearningQueueItem[];
}): PrimaryAction {
  if (!input.learningPlan) {
    return {
      title: 'Create a local learning plan',
      route: '/placement-test',
      estimatedMinutes: 15,
      reason: 'Take the placement test once so the app can build your first local path.',
    };
  }

  const queueItem = input.queue[0];

  if (!queueItem) {
    return {
      title: 'Open your learning plan',
      route: '/plan',
      estimatedMinutes: 5,
      reason: 'All current plan items are complete.',
    };
  }

  return {
    title: queueItem.title,
    route: queueItem.route,
    estimatedMinutes: queueItem.estimatedMinutes,
    reason: queueItem.reason,
  };
}

function calculatePlanProgress(items: LearningPlanItem[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = items.length;
  const completed = items.filter(item => item.completed).length;

  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function formatQueueSource(item: DailyLearningQueueItem): string {
  if (item.source === 'plan') return 'Plan';
  if (item.source === 'weak-area') return 'Repair';
  if (item.source === 'conversation') return 'Speaking';
  if (item.source === 'writing') return 'Writing';
  if (item.source === 'exam') return 'Exam drill';
  return 'Review';
}

function formatQueueTitle(item: DailyLearningQueueItem): string {
  return item.title.replace(/^Review: /, '');
}

function formatQueueTag(item: DailyLearningQueueItem): string {
  if (item.source === 'plan') return 'Plan';
  if (item.source === 'conversation') return 'Sprechen';
  if (item.source === 'writing') return 'Schreiben';
  if (item.source === 'exam') return 'Pruefung';
  return 'Review';
}

function getSourceInitial(item: DailyLearningQueueItem): string {
  if (item.source === 'conversation') return 'S';
  if (item.source === 'writing') return 'W';
  if (item.source === 'exam') return 'E';
  if (item.source === 'plan') return 'P';
  if (item.source === 'weak-area') return '!';
  return 'R';
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function formatSessionDuration(session: ConversationSessionRecord): string {
  if (typeof session.durationSeconds === 'number') {
    return `${Math.max(1, Math.round(session.durationSeconds / 60))} min`;
  }

  return 'Session saved locally';
}

function formatMode(mode: ConversationSessionRecord['mode']): string {
  return mode
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Local';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default LocalDashboardPage;
