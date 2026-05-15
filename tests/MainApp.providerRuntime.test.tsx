import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const activityPageProps = vi.hoisted(() => ({
  latest: null as null | { aiProvider?: { id: string } },
}));

const providerSettingsRepository = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock('../src/infrastructure/browser/providerSettingsStorage', () => ({
  browserProviderSettingsRepository: providerSettingsRepository,
}));

vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../services/geminiService', () => ({
  generateLearningPlan: vi.fn(),
}));

vi.mock('../services/learningPlanService', () => ({
  loadActiveLearningPlan: vi.fn().mockResolvedValue({ plan: null, error: null }),
  saveLearningPlan: vi.fn(),
}));

vi.mock('../pages/LocalDashboardPage', () => ({
  default: () => <main>Dashboard</main>,
}));

vi.mock('../pages/LocalSettingsPage', () => ({
  default: () => <main>Settings</main>,
}));

vi.mock('../pages/EnhancedPlacementTestPage', () => ({
  default: () => <main>Placement</main>,
}));

vi.mock('../pages/LearningPlanPage', () => ({
  default: () => <main>Plan</main>,
}));

vi.mock('../pages/ConversationPage', () => ({
  default: () => <main>Conversation</main>,
}));

vi.mock('../pages/SpeakingActivityPage', () => ({
  default: () => <main>Speaking</main>,
}));

vi.mock('../pages/ProfilePage', () => ({
  default: () => <main>Profile</main>,
}));

vi.mock('../pages/PracticePage', () => ({
  PracticePage: () => <main>Practice</main>,
}));

vi.mock('../pages/ExamSimulatorPage', () => ({
  ExamSimulatorPage: () => <main>Exam</main>,
}));

vi.mock('../pages/ActivityPage', () => ({
  default: (props: { aiProvider?: { id: string } }) => {
    activityPageProps.latest = props;
    return <main>Activity</main>;
  },
}));

describe('MainApp provider runtime', () => {
  it('passes the saved OpenRouter provider into activity routes', async () => {
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: false,
        provider: 'deepgram',
        model: 'nova-3',
        language: 'de',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/activity?type=vocabulary&topic=Food&description=Words&level=A2']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(activityPageProps.latest?.aiProvider?.id).toBe('openrouter');
    });
  });
});
