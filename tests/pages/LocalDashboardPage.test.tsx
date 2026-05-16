import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LocalDashboardPage from '../../pages/LocalDashboardPage';
import { CEFRLevel, type LearningPlan } from '../../types';
import {
  createDefaultLearnerProfile,
  type LearnerProfile,
  type ProfileRepository,
} from '../../src/domain/profile/profileRepository';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';

const learnerId = 'local-learner';

describe('LocalDashboardPage', () => {
  it('renders an honest empty local dashboard instead of seeded progress', async () => {
    const profileRepository = createProfileRepository();
    const learningPlanLoader = vi.fn().mockResolvedValue({ plan: null, error: null });
    const conversationRepository = createConversationRepository([]);

    render(
      <MemoryRouter>
        <LocalDashboardPage
          profileRepository={profileRepository}
          learningPlanLoader={learningPlanLoader}
          conversationRepository={conversationRepository}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText('A1 -> B1')).toBeInTheDocument();
    expect(screen.getByText('Create a local learning plan')).toBeInTheDocument();
    expect(screen.getByText('No review cards yet')).toBeInTheDocument();
    expect(screen.getByText('No saved local sessions yet')).toBeInTheDocument();

    expect(screen.queryByText(/Akkusativ/i)).not.toBeInTheDocument();
    expect(screen.queryByText('312 / 420')).not.toBeInTheDocument();
    expect(screen.queryByText('18')).not.toBeInTheDocument();
  });

  it('builds today queue from the saved local profile and active plan', async () => {
    const profileRepository = createProfileRepository({
      currentLevel: CEFRLevel.A2,
      targetLevel: CEFRLevel.B1,
      dailyGoalMinutes: 30,
      studyStreak: 3,
      totalStudyTimeMinutes: 95,
    });
    const learningPlan: LearningPlan = {
      level: CEFRLevel.A2,
      goals: ['Reach B1 speaking confidence'],
      weeks: [
        {
          week: 1,
          focus: 'Past tense',
          items: [
            {
              id: 'plan-perfect-tense',
              topic: 'Perfekt vs. Praeteritum',
              skill: 'Grammar',
              description: 'Use both tenses in short answers.',
              completed: false,
            },
          ],
        },
      ],
    };
    const learningPlanLoader = vi.fn().mockResolvedValue({ plan: learningPlan, error: null });
    const conversationRepository = createConversationRepository([
      {
        id: 'session-1',
        learnerId,
        mode: 'free-talk',
        startedAt: '2026-05-15T10:00:00.000Z',
        endedAt: '2026-05-15T10:05:00.000Z',
        durationSeconds: 300,
        transcript: [
          { speaker: 'learner', text: 'Hallo', occurredAt: '2026-05-15T10:00:00.000Z' },
          { speaker: 'tutor', text: 'Guten Morgen', occurredAt: '2026-05-15T10:00:05.000Z' },
        ],
      },
    ]);

    render(
      <MemoryRouter>
        <LocalDashboardPage
          profileRepository={profileRepository}
          learningPlanLoader={learningPlanLoader}
          conversationRepository={conversationRepository}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText('A2 -> B1')).toBeInTheDocument();

    const queue = await screen.findByRole('list', { name: 'Today queue' });
    expect(within(queue).getByText('Perfekt vs. Praeteritum')).toBeInTheDocument();
    expect(within(queue).getByText('Speaking')).toBeInTheDocument();

    expect(screen.getByText('3 days')).toBeInTheDocument();
    expect(screen.getByText('1 h 35 min')).toBeInTheDocument();
    expect(screen.getByText(/2\s+transcript turns/)).toBeInTheDocument();
    expect(screen.queryByText('Word order')).not.toBeInTheDocument();
  });
});

function createProfileRepository(overrides: Partial<LearnerProfile> = {}): ProfileRepository {
  const profile = {
    ...createDefaultLearnerProfile('2026-05-16T10:00:00.000Z'),
    ...overrides,
  };

  return {
    loadProfile: vi.fn().mockResolvedValue(profile),
    saveProfile: vi.fn().mockResolvedValue(profile),
    updateProfile: vi.fn(),
    resetProfile: vi.fn(),
  };
}

function createConversationRepository(
  sessions: Awaited<ReturnType<ConversationRepository['loadRecentSessions']>>
): Pick<ConversationRepository, 'loadRecentSessions'> {
  return {
    loadRecentSessions: vi.fn().mockResolvedValue(sessions),
  };
}
