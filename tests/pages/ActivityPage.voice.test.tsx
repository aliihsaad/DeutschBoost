import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderActivity(route: string, speechProvider: any) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ActivityPage speechProvider={speechProvider} />
    </MemoryRouter>
  );
}

describe('ActivityPage voice playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({
      motherLanguage: 'en',
    });
    geminiService.speakText.mockResolvedValue(undefined);
    learningPlanService.updatePlanItemCompletion.mockResolvedValue({ error: null });
    learningPlanService.updateUserProgress.mockResolvedValue({ error: null, profile: null });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:deepgram-activity-audio'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      'Audio',
      class {
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor(readonly src: string) {}

        play() {
          this.onended?.();
          return Promise.resolve();
        }
      }
    );
  });

  it('waits for provider settings before generating a direct activity route', async () => {
    activityService.generateActivity.mockResolvedValue({
      questions: [
        {
          audio_text: 'Guten Morgen.',
          question: 'What did you hear?',
          options: ['Bread', 'Water'],
          correct_option: 0,
        },
      ],
    });
    const route = `/activity?type=listening&topic=Einkaufen&description=Shop&level=${CEFRLevel.A2}`;
    const view = render(
      <MemoryRouter initialEntries={[route]}>
        <ActivityPage providerRuntimeReady={false} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Generating your activity...')).toBeInTheDocument();
    expect(activityService.generateActivity).not.toHaveBeenCalled();

    view.rerender(
      <MemoryRouter initialEntries={[route]}>
        <ActivityPage providerRuntimeReady />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(activityService.generateActivity).toHaveBeenCalled();
    });
  });

  it('plays listening activity audio through the configured speech provider', async () => {
    activityService.generateActivity.mockResolvedValue({
      questions: [
        {
          audio_text: 'Guten Morgen. Ich kaufe Brot.',
          question: 'What did you hear?',
          options: ['Bread', 'Water'],
          correct_option: 0,
        },
      ],
    });
    const speechProvider = {
      id: 'deepgram',
      displayName: 'Deepgram',
      transcribe: vi.fn(),
      synthesize: vi.fn().mockResolvedValue({
        audio: new ArrayBuffer(3),
        mimeType: 'audio/mpeg',
      }),
    };

    renderActivity(
      `/activity?type=listening&topic=Einkaufen&description=Shop&level=${CEFRLevel.A2}`,
      speechProvider
    );

    await screen.findByText('Listen to the audio');
    fireEvent.click(screen.getByRole('button', { name: /Play Audio/i }));

    await waitFor(() => {
      expect(speechProvider.synthesize).toHaveBeenCalledWith({
        feature: 'listening-practice',
        text: 'Guten Morgen. Ich kaufe Brot.',
        options: { language: 'de' },
      });
    });
    expect(geminiService.speakText).not.toHaveBeenCalled();
    expect(screen.getByText(/Audio played/i)).toBeInTheDocument();
  });

  it('plays vocabulary pronunciation through the configured speech provider', async () => {
    activityService.generateActivity.mockResolvedValue({
      cards: [
        {
          german: 'Apfel',
          translation: 'apple',
          example_sentence: 'Ich esse einen Apfel.',
        },
      ],
    });
    const speechProvider = {
      id: 'deepgram',
      displayName: 'Deepgram',
      transcribe: vi.fn(),
      synthesize: vi.fn().mockResolvedValue({
        audio: new ArrayBuffer(3),
        mimeType: 'audio/mpeg',
      }),
    };

    renderActivity(
      `/activity?type=vocabulary&topic=Essen&description=Words&level=${CEFRLevel.A2}`,
      speechProvider
    );

    await screen.findByText('Apfel');
    fireEvent.click(screen.getByTitle('Listen to pronunciation'));

    await waitFor(() => {
      expect(speechProvider.synthesize).toHaveBeenCalledWith({
        feature: 'vocabulary-pronunciation',
        text: 'Apfel',
        options: { language: 'de' },
      });
    });
    expect(geminiService.speakText).not.toHaveBeenCalled();
  });
});
