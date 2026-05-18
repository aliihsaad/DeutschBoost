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
    <main className="db-dashboard" aria-label="DeutschBoost dashboard">
      <header className="db-dashboard-header">
        <div>
          <span className="db-dashboard-kicker">Heute</span>
          <h1>Guten Morgen!</h1>
          <p>Hier ist dein lokales Lerncockpit fuer heute.</p>
        </div>
        <div className="db-level-meter" aria-label="Current learning target">
          <div>
            <strong>{profile.currentLevel} -&gt; {profile.targetLevel}</strong>
            <span>Dein aktuelles Ziel</span>
          </div>
          <div className="db-ring" aria-label={`${planProgress.percent} percent complete`}>
            {planProgress.percent}%
          </div>
        </div>
      </header>

      <nav className="db-dashboard-actions" aria-label="Quick study actions">
        <Link to="/conversation">
          <i className="fa-solid fa-comments" aria-hidden="true" />
          <span>Sprechen</span>
        </Link>
        <Link to="/practice">
          <i className="fa-solid fa-dumbbell" aria-hidden="true" />
          <span>Ueben</span>
        </Link>
        <Link to="/plan">
          <i className="fa-solid fa-calendar-days" aria-hidden="true" />
          <span>Plan</span>
        </Link>
        <Link to="/settings">
          <i className="fa-solid fa-gear" aria-hidden="true" />
          <span>Provider</span>
        </Link>
      </nav>

      {loadState === 'error' ? (
        <section className="db-panel db-empty-workspace" role="alert">
          <span className="db-section-label">Local dashboard</span>
          <h2>Dashboard could not load</h2>
          <p>{errorMessage ?? 'Local dashboard data could not be read.'}</p>
        </section>
      ) : null}

      <section className="db-dashboard-grid">
        <section className="db-panel db-next-action" aria-labelledby="next-action-heading">
          <span className="db-section-label">Naechste Aktion</span>
          <div className="db-next-action-row">
            <div>
              <h2 id="next-action-heading">{primaryAction.title}</h2>
              <div className="db-meta-row">
                <span>
                  <i className="fa-regular fa-clock" aria-hidden="true" /> {primaryAction.estimatedMinutes} min
                </span>
                <span>{primaryAction.reason}</span>
              </div>
            </div>
            <Link to={primaryAction.route} className="db-primary-button" role="button">
              <i className="fa-solid fa-play" aria-hidden="true" />
              Starten
            </Link>
          </div>
        </section>

        <section className="db-panel db-queue-panel" aria-labelledby="queue-heading">
          <div className="db-panel-heading">
            <h2 id="queue-heading">Heutige Queue</h2>
            <span>{queue.length} Aufgaben</span>
          </div>
          {queue.length > 0 ? (
            <ul className="db-queue-list" aria-label="Today queue">
              {queue.map(item => (
                <QueueRow key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p>No local queue yet. Create a plan to generate the first study path.</p>
          )}
        </section>

        <aside className="db-panel db-review-panel" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Faellige Reviews</h2>
          <strong>0</strong>
          <span>No review cards yet</span>
          <p>Review cards will appear after corrections are saved locally.</p>
        </aside>

        <aside className="db-panel db-weak-panel" aria-labelledby="focus-heading">
          <h2 id="focus-heading">Aktueller Fokus</h2>
          <div className="db-weak-list">
            {activePlanItems.slice(0, 3).map(item => (
              <div className="db-weak-row" key={item.id ?? item.topic}>
                <span>{item.topic}</span>
                <span>{item.skill}</span>
                <b className={item.completed ? 'db-tone-mid' : 'db-tone-high'}>
                  {item.completed ? 'Done' : 'Next'}
                </b>
              </div>
            ))}
            {activePlanItems.length === 0 ? (
              <div className="db-weak-row">
                <span>No plan focus yet</span>
                <span>{profile.currentLevel}</span>
                <b className="db-tone-mid">Local</b>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="db-panel db-weekly-panel" aria-labelledby="progress-heading">
          <div className="db-panel-heading">
            <h2 id="progress-heading">Lokaler Fortschritt</h2>
            <span>{loadState === 'loading' ? 'Loading' : 'Device only'}</span>
          </div>
          <div className="db-stat-grid">
            <ProgressStat label="Study streak" value={`${profile.studyStreak} days`} percent={profile.studyStreak > 0 ? 100 : 0} />
            <ProgressStat
              label="Total study time"
              value={formatStudyTime(profile.totalStudyTimeMinutes)}
              percent={Math.min(100, Math.round((profile.totalStudyTimeMinutes / Math.max(profile.dailyGoalMinutes, 1)) * 100))}
            />
            <ProgressStat
              label="Plan progress"
              value={`${planProgress.completed} / ${planProgress.total}`}
              percent={planProgress.percent}
            />
          </div>
        </section>

        <aside className="db-panel db-session-panel" aria-labelledby="session-heading">
          <h2 id="session-heading">Letzte Session</h2>
          {lastSession ? (
            <>
              <span>{formatSessionDuration(lastSession)}</span>
              <dl>
                <div>
                  <dt>Transcript</dt>
                  <dd>{lastSession.transcript.length} transcript turns</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{formatMode(lastSession.mode)}</dd>
                </div>
                <div>
                  <dt>Saved</dt>
                  <dd>{formatDate(lastSession.endedAt ?? lastSession.startedAt)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <span>No saved local sessions yet</span>
              <p>Conversation history will appear here after your first local speaking session.</p>
            </>
          )}
          <p className="db-local-save">
            <i className="fa-solid fa-check" aria-hidden="true" /> Device-only storage active
          </p>
        </aside>
      </section>
    </main>
  );
};

interface QueueRowProps {
  item: DailyLearningQueueItem;
}

const QueueRow: React.FC<QueueRowProps> = ({ item }) => (
  <li className="db-queue-row">
    <Link to={item.route} aria-label={`${formatQueueTitle(item)}, ${item.estimatedMinutes} minutes`}>
      <span className={`db-source-marker db-source-${item.source}`} aria-hidden="true">
        {getSourceInitial(item)}
      </span>
      <div>
        <strong>{formatQueueSource(item)}</strong>
        <span>{formatQueueTitle(item)}</span>
      </div>
      <span>{item.estimatedMinutes} min</span>
      <b>{formatQueueTag(item)}</b>
    </Link>
  </li>
);

const ProgressStat: React.FC<{ label: string; value: string; percent: number }> = ({
  label,
  value,
  percent,
}) => (
  <div className="db-stat">
    <span>{label}</span>
    <strong>{value}</strong>
    <div className="db-progress-track" aria-hidden="true">
      <div style={{ width: `${percent}%` }} />
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
