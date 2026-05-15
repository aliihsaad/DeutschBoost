import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
});
