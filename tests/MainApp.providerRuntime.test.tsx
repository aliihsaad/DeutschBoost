import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CEFRLevel, type LearningPlan, type TestResult } from '../types';

const activityPageProps = vi.hoisted(() => ({
  latest: null as null | {
    aiProvider?: { id: string };
    speechProvider?: { id: string };
    providerRuntimeReady?: boolean;
  },
}));

const speakingPageProps = vi.hoisted(() => ({
  latest: null as null | {
    aiProvider?: { id: string };
    speechProvider?: { id: string };
    streamingAiProvider?: { id: string };
    streamingSpeechProvider?: { id: string };
    liveConversationProvider?: { id: string };
  },
}));

const examPageProps = vi.hoisted(() => ({
  latest: null as null | {
    aiProvider?: { id: string };
    speechProvider?: { id: string };
    liveConversationProvider?: { id: string };
  },
}));

const providerSettingsRepository = vi.hoisted(() => ({
  load: vi.fn(),
}));

const profileRepository = vi.hoisted(() => ({
  updateProfile: vi.fn(),
}));

const learningPlanService = vi.hoisted(() => ({
  loadActiveLearningPlan: vi.fn(),
  saveLearningPlan: vi.fn(),
  recordPlacementResult: vi.fn(),
}));

const geminiService = vi.hoisted(() => ({
  generateLearningPlan: vi.fn(),
}));

vi.mock('../src/infrastructure/browser/providerSettingsStorage', () => ({
  browserProviderSettingsRepository: providerSettingsRepository,
}));

vi.mock('../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
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

vi.mock('../services/geminiService', () => geminiService);

vi.mock('../services/learningPlanService', () => learningPlanService);

vi.mock('../pages/LocalDashboardPage', () => ({
  default: () => <main>Dashboard</main>,
}));

vi.mock('../pages/LocalSettingsPage', () => ({
  default: () => <main>Settings</main>,
}));

const placementResult: TestResult = {
  level: CEFRLevel.A2,
  strengths: ['Reading'],
  weaknesses: ['Dative case'],
  recommendations: 'Practice daily dialogs.',
};

const generatedPlan: LearningPlan = {
  level: CEFRLevel.B1,
  goals: ['Build a daily grammar habit.'],
  weeks: [
    {
      week: 1,
      focus: 'Cases',
      items: [
        {
          id: 'item-1',
          topic: 'Dative articles',
          skill: 'Grammar',
          description: 'Practice dative after common verbs.',
          completed: false,
        },
      ],
    },
  ],
};

const placementPageProps = vi.hoisted(() => ({
  latest: null as null | { aiProvider?: { id: string } },
}));

vi.mock('../pages/EnhancedPlacementTestPage', () => ({
  default: (props: { onTestComplete: (result: TestResult) => void; aiProvider?: { id: string } }) => {
    placementPageProps.latest = props;
    return (
      <main>
        <button onClick={() => props.onTestComplete(placementResult)}>Finish placement</button>
      </main>
    );
  },
}));

vi.mock('../pages/LearningPlanPage', () => ({
  default: () => <main>Plan</main>,
}));

vi.mock('../pages/SpeakingActivityPage', () => ({
  default: (props: {
    aiProvider?: { id: string };
    speechProvider?: { id: string };
    streamingAiProvider?: { id: string };
    streamingSpeechProvider?: { id: string };
    liveConversationProvider?: { id: string };
    providerRuntimeReady?: boolean;
  }) => {
    speakingPageProps.latest = props;
    return <main>Speaking</main>;
  },
}));

vi.mock('../pages/ProfilePage', () => ({
  default: () => <main>Profile</main>,
}));

vi.mock('../pages/PracticePage', () => ({
  PracticePage: () => <main>Practice</main>,
}));

vi.mock('../pages/ExamSimulatorPage', () => ({
  ExamSimulatorPage: (props: {
    aiProvider?: { id: string };
    speechProvider?: { id: string };
    liveConversationProvider?: { id: string };
  }) => {
    examPageProps.latest = props;
    return <main>Exam</main>;
  },
}));

vi.mock('../pages/ActivityPage', () => ({
  default: (props: { aiProvider?: { id: string }; speechProvider?: { id: string } }) => {
    activityPageProps.latest = props;
    return <main>Activity</main>;
  },
}));

describe('MainApp provider runtime', () => {
  beforeEach(() => {
    activityPageProps.latest = null;
    speakingPageProps.latest = null;
    examPageProps.latest = null;
    placementPageProps.latest = null;
    vi.clearAllMocks();
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: false,
        provider: 'openrouter',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: false,
        provider: 'deepgram',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: false,
        provider: 'gemini-live',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    });
    learningPlanService.loadActiveLearningPlan.mockResolvedValue({ plan: null, error: null });
    learningPlanService.recordPlacementResult.mockResolvedValue({
      result: { id: 'placement-123' },
      error: null,
    });
    learningPlanService.saveLearningPlan.mockResolvedValue({ planId: 'plan-123', error: null });
    geminiService.generateLearningPlan.mockResolvedValue(generatedPlan);
    profileRepository.updateProfile.mockImplementation(async updater =>
      updater({
        id: 'local-learner',
        currentLevel: CEFRLevel.A1,
      })
    );
  });

  it('loads the active local learning plan without auth', async () => {
    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(learningPlanService.loadActiveLearningPlan).toHaveBeenCalledWith('local-learner');
    });
  });

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
        ttsModel: 'aura-2-viktoria-de',
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

  it('passes the saved OpenRouter provider into the placement test route', async () => {
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
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/placement-test']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(placementPageProps.latest?.aiProvider?.id).toBe('openrouter');
    });
  });

  it('keeps OpenRouter and Deepgram out of the Gemini Live conversation route', async () => {
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(speakingPageProps.latest).not.toBeNull();
      expect(speakingPageProps.latest?.aiProvider).toBeUndefined();
      expect(speakingPageProps.latest?.speechProvider).toBeUndefined();
      expect(speakingPageProps.latest?.liveConversationProvider).toBeUndefined();
    });
  });

  it('does not pass OpenRouter or Deepgram streaming providers into the conversation route', async () => {
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(speakingPageProps.latest).not.toBeNull();
      expect(speakingPageProps.latest?.streamingAiProvider).toBeUndefined();
      expect(speakingPageProps.latest?.streamingSpeechProvider).toBeUndefined();
    });
  });

  it('passes Gemini Live into the conversation route as the realtime provider', async () => {
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: false,
        provider: 'openrouter',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: false,
        provider: 'deepgram',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(speakingPageProps.latest?.liveConversationProvider?.id).toBe('gemini-live');
    });
  });

  it('passes the saved Deepgram provider into activity routes', async () => {
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: false,
        provider: 'openrouter',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/activity?type=listening&topic=Food&description=Words&level=A2']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(activityPageProps.latest?.speechProvider?.id).toBe('deepgram');
      expect(activityPageProps.latest?.providerRuntimeReady).toBe(true);
    });
  });

  it('passes Deepgram TTS and Gemini Live into exam routes', async () => {
    providerSettingsRepository.load.mockResolvedValue({
      ai: {
        enabled: false,
        provider: 'openrouter',
        model: 'openrouter/auto',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        ttsModel: 'aura-2-viktoria-de',
        language: 'de',
      },
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voiceName: 'Kore',
      },
    });

    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/exam']}>
        <MainApp />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(examPageProps.latest?.speechProvider?.id).toBe('deepgram');
      expect(examPageProps.latest?.liveConversationProvider?.id).toBe('gemini-live');
    });
  });

  it('records placement results, updates the local profile, and saves the generated plan locally', async () => {
    const { default: MainApp } = await import('../MainApp');

    render(
      <MemoryRouter initialEntries={['/placement-test']}>
        <MainApp />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finish placement' }));

    await waitFor(() => {
      expect(learningPlanService.recordPlacementResult).toHaveBeenCalledWith(
        'local-learner',
        placementResult
      );
    });
    expect(profileRepository.updateProfile).toHaveBeenCalledWith(expect.any(Function));
    expect(geminiService.generateLearningPlan).toHaveBeenCalledWith(placementResult, undefined);
    expect(learningPlanService.saveLearningPlan).toHaveBeenCalledWith(
      'local-learner',
      generatedPlan,
      'placement-123'
    );
  });
});
