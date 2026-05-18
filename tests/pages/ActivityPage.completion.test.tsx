import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityPage from '../../pages/ActivityPage';
import { CEFRLevel } from '../../types';

const activityService = vi.hoisted(() => ({
  generateActivity: vi.fn(),
  evaluateWriting: vi.fn(),
}));

const geminiService = vi.hoisted(() => ({
  speakText: vi.fn(),
}));

const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
}));

const learningPlanService = vi.hoisted(() => ({
  updatePlanItemCompletion: vi.fn(),
  updateUserProgress: vi.fn(),
}));

vi.mock('../../services/activityService', () => activityService);

vi.mock('../../services/geminiService', () => geminiService);

vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

vi.mock('../../services/learningPlanService', () => learningPlanService);

vi.mock('react-hot-toast', () => ({
  default: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
  },
}));

function renderActivityRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/activity" element={<ActivityPage providerRuntimeReady />} />
        <Route path="/learning-plan" element={<main>Learning plan route</main>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ActivityPage completion flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({
      motherLanguage: 'en',
    });
    activityService.generateActivity.mockResolvedValue({
      questions: [
        {
          sentence: 'Ich ___ Deutsch.',
          options: ['lerne', 'lernst'],
          correct_option: 0,
          explanation: 'Ich takes the -e verb ending.',
        },
      ],
    });
    learningPlanService.updatePlanItemCompletion.mockResolvedValue({ error: null });
    learningPlanService.updateUserProgress.mockResolvedValue({ error: null, profile: null });
  });

  it('keeps a passing result on screen until the learner continues', async () => {
    renderActivityRoute(
      `/activity?type=grammar&topic=Verbformen&description=Practice&level=${CEFRLevel.A2}&itemId=item-1`
    );

    await screen.findByText('Question 1 of 1');
    fireEvent.click(screen.getByRole('button', { name: /A\.\s*lerne/i }));
    fireEvent.click(screen.getByRole('button', { name: /Finish/i }));

    expect(await screen.findByText('100%')).toBeInTheDocument();

    await waitFor(() => {
      expect(learningPlanService.updatePlanItemCompletion).toHaveBeenCalledWith('local-learner', 'item-1', true);
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    expect(screen.getByRole('heading', { name: /Excellent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to Plan/i })).toBeInTheDocument();
    expect(screen.queryByText('Learning plan route')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue to Plan/i }));

    expect(screen.getByText('Learning plan route')).toBeInTheDocument();
  });
});
