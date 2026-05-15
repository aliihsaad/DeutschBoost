import React from 'react';
import { Link } from 'react-router-dom';
import { CEFRLevel, type SkillType } from '../types';
import { buildDailyLearningQueue, type DailyLearningQueueItem } from '../src/ui/learningWorkflowModel';

const queue = buildDailyLearningQueue({
  level: CEFRLevel.A2,
  targetLevel: CEFRLevel.B1,
  dailyTargetMinutes: 35,
  dueReviews: [
    {
      id: 'review-akkusativ',
      title: 'Akkusativ articles',
      skill: 'Grammar',
      level: CEFRLevel.A2,
      dueAt: '2026-05-15T08:00:00.000Z',
      priority: 1,
    },
  ],
  activePlanItems: [
    {
      id: 'plan-perfect-tense',
      topic: 'Past tenses',
      skill: 'Grammar',
      description: 'Perfekt vs. Praeteritum in short answers.',
      completed: false,
    },
  ],
  weakAreas: [
    {
      id: 'weak-speaking-alitag',
      skill: 'Speaking',
      topic: 'Alltag',
      level: CEFRLevel.A2,
      score: 54,
      reason: 'Recent speaking sessions show missing verb-second word order.',
    },
  ],
  preferences: {
    includeConversation: true,
    includeWriting: true,
    examGoal: 'Goethe A2',
  },
});

const weakAreas: Array<{ label: string; skill: SkillType; tone: 'high' | 'mid' }> = [
  { label: 'Word order', skill: 'Writing', tone: 'high' },
  { label: 'der/die/das', skill: 'Grammar', tone: 'high' },
  { label: 'Praepositionen', skill: 'Grammar', tone: 'mid' },
];

const weeklyStats = [
  { label: 'Minuten gelernt', value: '312 / 420', percent: 74 },
  { label: 'Aufgaben erledigt', value: '38 / 55', percent: 69 },
  { label: 'Richtige Antworten', value: '78%', percent: 78 },
];

const LocalDashboardPage: React.FC = () => {
  const primaryAction = queue[0];

  return (
    <main className="db-dashboard" aria-label="DeutschBoost dashboard">
      <header className="db-dashboard-header">
        <div>
          <h1>Guten Morgen!</h1>
          <p>Hier ist dein Lerncockpit fuer heute.</p>
        </div>
        <div className="db-level-meter" aria-label="Current learning target">
          <div>
            <strong>A2 -&gt; B1</strong>
            <span>Dein aktuelles Ziel</span>
          </div>
          <div className="db-ring" aria-label="34 percent complete">34%</div>
        </div>
      </header>

      <section className="db-dashboard-grid">
        <section className="db-panel db-next-action" aria-labelledby="next-action-heading">
          <span className="db-section-label">Naechste Aktion</span>
          <div className="db-next-action-row">
            <div>
              <h2 id="next-action-heading">{formatPrimaryTitle(primaryAction)}</h2>
              <div className="db-meta-row">
                <span>
                  <i className="fa-regular fa-clock" aria-hidden="true" /> {primaryAction.estimatedMinutes} min
                </span>
                <span>{primaryAction.reason}</span>
              </div>
            </div>
            <Link to={primaryAction.route} className="db-primary-button" role="button">
              Starten
            </Link>
          </div>
        </section>

        <section className="db-panel db-queue-panel" aria-labelledby="queue-heading">
          <div className="db-panel-heading">
            <h2 id="queue-heading">Heutige Queue</h2>
            <span>{queue.length} Aufgaben</span>
          </div>
          <ul className="db-queue-list" aria-label="Today queue">
            {queue.map(item => (
              <QueueRow key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <aside className="db-panel db-review-panel" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Faellige Reviews</h2>
          <strong>18</strong>
          <span>Karten faellig</span>
          <p>Naechste in 13 min</p>
        </aside>

        <aside className="db-panel db-weak-panel" aria-labelledby="weak-heading">
          <h2 id="weak-heading">Schwache Bereiche</h2>
          <div className="db-weak-list">
            {weakAreas.map(area => (
              <div className="db-weak-row" key={area.label}>
                <span>{area.label}</span>
                <span>{area.skill}</span>
                <b className={`db-tone-${area.tone}`}>{area.tone === 'high' ? 'Hoch' : 'Mittel'}</b>
              </div>
            ))}
          </div>
        </aside>

        <section className="db-panel db-weekly-panel" aria-labelledby="weekly-heading">
          <div className="db-panel-heading">
            <h2 id="weekly-heading">Woechentlicher Fortschritt</h2>
            <span>12.-18. Mai</span>
          </div>
          <div className="db-stat-grid">
            {weeklyStats.map(stat => (
              <div className="db-stat" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <div className="db-progress-track" aria-hidden="true">
                  <div style={{ width: `${stat.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="db-panel db-session-panel" aria-labelledby="session-heading">
          <h2 id="session-heading">Letzte Session</h2>
          <span>Gestern - 48 min</span>
          <dl>
            <div>
              <dt>Aufgaben erledigt</dt>
              <dd>14</dd>
            </div>
            <div>
              <dt>Richtige Antworten</dt>
              <dd>11 (79%)</dd>
            </div>
            <div>
              <dt>Korrekturen gespeichert</dt>
              <dd>5</dd>
            </div>
          </dl>
          <p className="db-local-save">
            <i className="fa-solid fa-check" aria-hidden="true" /> Alles lokal gespeichert
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
    <span className={`db-source-marker db-source-${item.source}`} aria-hidden="true">
      {getSourceInitial(item)}
    </span>
    <div>
      <strong>{formatQueueSource(item)}</strong>
      <span>{formatQueueTitle(item)}</span>
    </div>
    <span>{item.estimatedMinutes} min</span>
    <b>{formatQueueTag(item)}</b>
  </li>
);

function formatPrimaryTitle(item: DailyLearningQueueItem): string {
  return item.title.replace(/^Review: /, 'Review ');
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
  if (item.source === 'conversation') return 'Essen gehen';
  if (item.source === 'writing') return 'Beschreibe deinen letzten Urlaub';
  if (item.source === 'exam') return 'Lesen Teil 2 (A2)';
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

export default LocalDashboardPage;
