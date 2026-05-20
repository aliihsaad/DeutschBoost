import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LearningPlan } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Stat, cn } from '../components/ui';

interface LearningPlanPageProps {
  learningPlan: LearningPlan | null;
  loading: boolean;
}

const SKILL_ICON: Record<string, string> = {
  grammar: 'fa-solid fa-spell-check',
  vocabulary: 'fa-solid fa-book',
  listening: 'fa-solid fa-headphones',
  writing: 'fa-solid fa-pencil-alt',
  speaking: 'fa-solid fa-comments',
  reading: 'fa-solid fa-book-open',
};

const SKILL_BADGE_TONE: Record<string, 'brand' | 'info' | 'success' | 'danger' | 'neutral'> = {
  grammar: 'info',
  vocabulary: 'success',
  listening: 'brand',
  writing: 'brand',
  speaking: 'danger',
  reading: 'info',
};

const skillIcon = (skill: string) => SKILL_ICON[skill.toLowerCase()] ?? 'fa-solid fa-star';
const skillTone = (skill: string) => SKILL_BADGE_TONE[skill.toLowerCase()] ?? 'neutral';

const LearningPlanPage: React.FC<LearningPlanPageProps> = ({ learningPlan, loading }) => {
  const navigate = useNavigate();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [studyStreak, setStudyStreak] = useState<number>(0);
  const [totalStudyTime, setTotalStudyTime] = useState<number>(0);

  const handleStartActivity = (
    skill: string,
    topic: string,
    description: string,
    level: string,
    itemId: string
  ) => {
    const activityType = skill.toLowerCase();

    if (activityType === 'speaking') {
      const params = new URLSearchParams({ itemId, topic, description, level });
      navigate(`/speaking-activity?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({ type: activityType, topic, description, level, itemId });
    navigate(`/activity?${params.toString()}`);
  };

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function loadUserProfile() {
      try {
        const profile = await browserProfileRepository.loadProfile();
        if (!cancelled) {
          setStudyStreak(profile.studyStreak);
          setTotalStudyTime(profile.totalStudyTimeMinutes);
        }
      } catch (err) {
        console.error('Error loading local profile:', err);
      }
    }

    loadUserProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <LoadingSpinner text="Generating your personalized learning plan..." />
      </div>
    );
  }

  if (!learningPlan) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12" aria-label="No learning plan">
        <EmptyState
          title="No Learning Plan Found"
          description="Please complete the placement test first to generate your personalized plan."
          icon={<i className="fa-solid fa-book-open text-4xl text-text-muted" aria-hidden />}
          actionLabel="Take Placement Test"
          onAction={() => navigate('/placement-test')}
        />
      </main>
    );
  }

  const totalItems = learningPlan.weeks.reduce((sum, week) => sum + week.items.length, 0);
  const completedItems = learningPlan.weeks.reduce(
    (sum, week) => sum + week.items.filter(item => item.completed).length,
    0,
  );
  const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allPlanItemsComplete = totalItems > 0 && completedItems === totalItems;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8" aria-label="Learning plan">
      <PageHeader
        title="Your Learning Plan"
        subtitle={`Target level: ${learningPlan.level}`}
        actions={<Badge tone="brand">{learningPlan.level}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Overall Progress" value={`${progressPercentage}%`} hint={`${completedItems} of ${totalItems} completed`} />
        <Stat label="Study Streak" value={String(studyStreak)} hint={`${studyStreak === 1 ? 'day' : 'days'} in a row`} />
        <Stat label="Study Time" value={String(Math.round(totalStudyTime / 60))} hint={`hours total (${totalStudyTime} min)`} />
        <Stat label="Total Weeks" value={String(learningPlan.weeks.length)} hint="Structured learning path" />
        <Stat label="Activities" value={String(totalItems)} hint="Learning activities" />
      </div>

      {allPlanItemsComplete && (
        <Card className="mt-6" title="Plan complete">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <Badge tone="success">Local path finished</Badge>
              <p className="mt-3 text-[14px] leading-relaxed text-text">
                You completed {completedItems} of {totalItems} tasks for this {learningPlan.level} plan.
                The next useful step is to recalibrate your level or start a fresh plan from the latest placement result.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => navigate('/placement-test')}>Recalibrate level</Button>
                <Button variant="secondary" onClick={() => navigate('/placement-test')}>Start next plan</Button>
                <Button variant="secondary" onClick={() => navigate('/practice')}>Keep practicing</Button>
              </div>
            </div>
            <div className="rounded-card border border-success-soft bg-success-soft p-4">
              <h3 className="text-[14px] font-semibold text-success">What happens now?</h3>
              <ul className="mt-2 space-y-1 text-[13px] text-text">
                <li>Completed tasks stay saved locally.</li>
                <li>Daily practice remains available from Practice and Conversation.</li>
                <li>A new placement creates the next active plan.</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-6" title="Your Goals">
        <ul className="space-y-2">
          {learningPlan.goals.map((goal, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-brand text-[12px] font-bold text-text">
                {index + 1}
              </span>
              <span className="text-[14px] text-text">{goal}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 space-y-4">
        {learningPlan.weeks.map(week => {
          const weekCompleted = week.items.filter(i => i.completed).length;
          const weekTotal = week.items.length;
          const weekProgress = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
          const isExpanded = expandedWeeks.has(week.week);

          return (
            <Card key={week.week}>
              <button
                type="button"
                onClick={() => toggleWeek(week.week)}
                className="-m-2 w-full rounded-control p-2 text-left focus:outline-none focus:ring-2 focus:ring-brand"
                aria-expanded={isExpanded}
              >
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[20px] font-bold text-text">Week {week.week}</h2>
                    <p className="mt-1 text-[14px] font-semibold text-brand-strong">{week.focus}</p>
                  </div>
                  <div className="w-full sm:w-56">
                    <ProgressBar value={weekProgress} label={`Week ${week.week} progress`} />
                    <p className="mt-1 text-right text-[12px] font-medium text-text-muted">
                      {weekCompleted}/{weekTotal} completed · {weekProgress}%
                    </p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 space-y-3">
                  {week.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className={cn(
                        'flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center',
                        item.completed
                          ? 'border-success-soft bg-success-soft'
                          : 'border-border bg-surface hover:border-brand',
                      )}
                    >
                      <div className="flex flex-1 items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-card',
                            item.completed ? 'bg-success text-white' : 'bg-brand-soft text-brand-strong',
                          )}
                        >
                          <i className={`${skillIcon(item.skill)} text-[18px]`} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className={cn(
                              'wrap-break-word text-[15px] font-semibold',
                              item.completed ? 'text-text-muted line-through' : 'text-text',
                            )}
                          >
                            {item.topic}
                          </h3>
                          <div className="mt-1">
                            <Badge tone={skillTone(item.skill)}>{item.skill}</Badge>
                          </div>
                          <p
                            className={cn(
                              'mt-2 wrap-break-word text-[13px]',
                              item.completed ? 'text-text-muted line-through' : 'text-text-muted',
                            )}
                          >
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 sm:ml-4">
                        {!item.completed && item.id && (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleStartActivity(
                                item.skill,
                                item.topic,
                                item.description,
                                learningPlan.level,
                                item.id!,
                              )
                            }
                          >
                            Start Activity
                          </Button>
                        )}
                        {item.completed && (
                          <div className="flex items-center gap-2">
                            <span className="grid h-9 w-9 place-items-center rounded-pill bg-success text-white">
                              <i className="fa-solid fa-check" aria-hidden />
                            </span>
                            <span className="text-[13px] font-semibold text-success">Completed!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
};

export default LearningPlanPage;
