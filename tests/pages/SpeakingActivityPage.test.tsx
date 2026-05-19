import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpeakingActivityPage from '../../pages/SpeakingActivityPage';
import type { AiProvider } from '../../src/domain/ai/aiProvider';
import type { StreamingAiProvider } from '../../src/domain/ai/streamingAiProvider';
import type { ConversationRepository } from '../../src/domain/conversation/conversationRepository';
import type {
  LiveConversationEvent,
  LiveConversationProvider,
  LiveConversationSession,
} from '../../src/domain/conversation/liveConversationProvider';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';
import type { StreamingSpeechProvider } from '../../src/domain/speech/streamingSpeechProvider';
import { ConversationMode } from '../../types';

const profileRepository = vi.hoisted(() => ({
  loadProfile: vi.fn(),
}));

vi.mock('../../src/infrastructure/browser/profileStorage', () => ({
  browserProfileRepository: profileRepository,
}));

function createAiProvider(): AiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    generateJson: vi.fn(),
    generateText: vi.fn(),
  };
}

function createSpeechProvider(): SpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    transcribe: vi.fn(),
    synthesize: vi.fn(),
  };
}

function createStreamingAiProvider(): StreamingAiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    streamText: vi.fn(),
  };
}

function createStreamingSpeechProvider(): StreamingSpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    startTranscription: vi.fn(),
    startSynthesis: vi.fn(),
  };
}

function createConversationRepository(): ConversationRepository {
  return {
    startSession: vi.fn().mockResolvedValue('local-session-1'),
    appendTranscript: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    loadRecentSessions: vi.fn().mockResolvedValue([]),
    loadLastFeedback: vi.fn().mockResolvedValue(null),
  };
}

function createLiveConversationProvider() {
  const listeners = new Set<(event: LiveConversationEvent) => void>();
  const session: LiveConversationSession = {
    id: 'gemini-live-session',
    sendAudioPcm16: vi.fn(),
    sendAudioStreamEnd: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn(),
    onEvent: (listener: (event: LiveConversationEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const provider: LiveConversationProvider = {
    id: 'gemini-live',
    displayName: 'Gemini Live',
    startSession: vi.fn().mockResolvedValue(session),
  };

  return {
    provider,
    session,
    emit: (event: LiveConversationEvent) => listeners.forEach(listener => listener(event)),
  };
}

function expectLegacyConversationControlsToBeAbsent() {
  expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Record answer' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Stop and send' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start live practice' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Live practice controls')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Last recorded learner audio')).not.toBeInTheDocument();
}

describe('SpeakingActivityPage Gemini Live conversation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRepository.loadProfile.mockResolvedValue({
      currentLevel: 'A2',
      motherLanguage: 'english',
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:gemini-live-audio'),
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

  it('shows a Gemini Live-only setup state even when OpenRouter and Deepgram are configured', async () => {
    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage
          aiProvider={createAiProvider()}
          speechProvider={createSpeechProvider()}
          streamingAiProvider={createStreamingAiProvider()}
          streamingSpeechProvider={createStreamingSpeechProvider()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Live German Conversation' })).toBeInTheDocument();
    expect(screen.getByText('Connect Gemini Live')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Start live conversation' })).toBeDisabled();
    expect(screen.queryByText(/OpenRouter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Deepgram/i)).not.toBeInTheDocument();
    expectLegacyConversationControlsToBeAbsent();
  });

  it('runs Gemini Live as the only Conversation transport', async () => {
    const liveConversation = createLiveConversationProvider();
    const conversationRepository = createConversationRepository();
    const startGeminiLiveAudioCapture = vi.fn(async ({ onPcmChunk }) => {
      onPcmChunk(new Uint8Array([1, 2, 3]));
      return { stop: vi.fn() };
    });
    const playGeminiLiveAudio = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage
          aiProvider={createAiProvider()}
          speechProvider={createSpeechProvider()}
          streamingAiProvider={createStreamingAiProvider()}
          streamingSpeechProvider={createStreamingSpeechProvider()}
          liveConversationProvider={liveConversation.provider}
          conversationRepository={conversationRepository}
          startGeminiLiveAudioCapture={startGeminiLiveAudioCapture}
          playGeminiLiveAudio={playGeminiLiveAudio}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });

    expectLegacyConversationControlsToBeAbsent();
    fireEvent.click(screen.getByRole('button', { name: 'Start live conversation' }));

    expect(
      await within(screen.getByLabelText('Gemini Live controls')).findByText('Listening')
    ).toBeInTheDocument();
    expect(liveConversation.provider.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'A2',
        motherLanguage: 'English',
        mode: ConversationMode.FREE_CONVERSATION,
      })
    );
    expect(liveConversation.session.sendAudioPcm16).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));

    await act(async () => {
      liveConversation.emit({ type: 'input-transcript', text: 'Ich moechte Kaffee.' });
      liveConversation.emit({ type: 'output-transcript', text: 'Gern. Ich moechte einen Kaffee.' });
      liveConversation.emit({
        type: 'audio',
        audio: new Uint8Array([4, 5, 6]).buffer,
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
      });
      liveConversation.emit({ type: 'turn-complete' });
    });

    expect(
      await within(screen.getByLabelText('Conversation transcript')).findByText('Ich moechte Kaffee.')
    ).toBeInTheDocument();
    expect(
      await within(screen.getByLabelText('Conversation transcript')).findByText('Gern. Ich moechte einen Kaffee.')
    ).toBeInTheDocument();
    expect(conversationRepository.appendTranscript).toHaveBeenCalledTimes(2);
    expect(playGeminiLiveAudio).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'audio/pcm;rate=24000',
      24000
    );

    fireEvent.click(screen.getByRole('button', { name: 'End conversation' }));

    await waitFor(() => {
      expect(conversationRepository.endSession).toHaveBeenCalled();
    });
    expect(await screen.findByRole('button', { name: 'Start live conversation' })).toBeInTheDocument();
  });

  it('shows a clear Gemini Live startup error without falling back to OpenRouter or Deepgram', async () => {
    const provider: LiveConversationProvider = {
      id: 'gemini-live',
      displayName: 'Gemini Live',
      startSession: vi.fn().mockRejectedValue(new Error('Gemini Live socket closed before setup completed')),
    };

    render(
      <MemoryRouter initialEntries={['/conversation']}>
        <SpeakingActivityPage
          aiProvider={createAiProvider()}
          speechProvider={createSpeechProvider()}
          streamingAiProvider={createStreamingAiProvider()}
          streamingSpeechProvider={createStreamingSpeechProvider()}
          liveConversationProvider={provider}
          conversationRepository={createConversationRepository()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(profileRepository.loadProfile).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start live conversation' }));

    expect(await screen.findByText('Gemini Live socket closed before setup completed')).toBeInTheDocument();
    expectLegacyConversationControlsToBeAbsent();
  });
});
