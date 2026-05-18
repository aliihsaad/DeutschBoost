import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CEFRLevel, type LearningPlan } from '../../types';

const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
}));

vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

const learningPlan: LearningPlan = {
  level: CEFRLevel.B1,
  goals: ['Use German word order in daily conversations.'],
  weeks: [
    {
      week: 1,
      focus: 'Word order',
      items: [
        {
          id: 'item-1',
          topic: 'Main clauses',
          skill: 'Grammar',
          description: 'Practice verb-second sentences.',
          completed: true,
        },
        {
          id: 'item-2',
          topic: 'Small talk',
          skill: 'Speaking',
          description: 'Answer common questions aloud.',
          completed: false,
        },
      ],
    },
  ],
};

describe('LearningPlanPage local profile stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({
      studyStreak: 3,
      totalStudyTimeMinutes: 90,
    });
  });

  it('loads study stats from the local profile repository without requiring auth', async () => {
    const { default: LearningPlanPage } = await import('../../pages/LearningPlanPage');

    render(
      <MemoryRouter>
        <LearningPlanPage learningPlan={learningPlan} loading={false} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('hours total (90 min)')).toBeInTheDocument();
  });

  it('shows a finished-plan recap and next actions when every item is complete', async () => {
    const { default: LearningPlanPage } = await import('../../pages/LearningPlanPage');
    const completedPlan: LearningPlan = {
      ...learningPlan,
      weeks: learningPlan.weeks.map(week => ({
        ...week,
        items: week.items.map(item => ({ ...item, completed: true })),
      })),
    };

    render(
      <MemoryRouter>
        <LearningPlanPage learningPlan={completedPlan} loading={false} />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Plan complete/i })).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recalibrate level/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start next plan/i })).toBeInTheDocument();
  });

  it('navigates to placement when no plan exists and the learner chooses the placement test', async () => {
    const { default: LearningPlanPage } = await import('../../pages/LearningPlanPage');

    render(
      <MemoryRouter initialEntries={['/plan']}>
        <Routes>
          <Route path="/plan" element={<LearningPlanPage learningPlan={null} loading={false} />} />
          <Route path="/placement-test" element={<main>Placement route</main>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Take Placement Test/i }));

    expect(screen.getByText('Placement route')).toBeInTheDocument();
  });
});
