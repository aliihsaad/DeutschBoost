import { describe, expect, it, vi } from 'vitest';
import { runTurnBasedConversationTurn, transcriptTurnsToLegacyTranscripts } from '../../src/application/turnBasedConversation';
import type { AiProvider } from '../../src/domain/ai/aiProvider';
import type { SpeechProvider } from '../../src/domain/speech/speechProvider';
import type { TranscriptTurn } from '../../src/domain/speech/transcriptTypes';
import { CEFRLevel, ConversationMode } from '../../types';

function createSpeechProvider(transcriptText: string): SpeechProvider {
  return {
    id: 'deepgram',
    displayName: 'Deepgram',
    transcribe: vi.fn().mockResolvedValue({
      rawText: transcriptText,
      transcript: {
        speaker: 'learner',
        text: transcriptText.trim(),
        occurredAt: '2026-05-15T15:00:00.000Z',
        confidence: 0.91,
        provider: 'deepgram',
      },
    }),
  };
}

function createAiProvider(responseText: string): AiProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    generateJson: vi.fn(),
    generateText: vi.fn().mockResolvedValue(responseText),
  };
}

describe('runTurnBasedConversationTurn', () => {
  it('transcribes learner audio and asks the AI tutor for the next German turn', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const history: TranscriptTurn[] = [
      {
        speaker: 'tutor',
        text: 'Was mochtest du bestellen?',
        occurredAt: '2026-05-15T14:59:00.000Z',
        provider: 'openrouter',
      },
    ];
    const speechProvider = createSpeechProvider('Ich mochte ein Kaffee.');
    const aiProvider = createAiProvider('Fast richtig: Ich mochte einen Kaffee. Was trinkst du gern dazu?');

    const result = await runTurnBasedConversationTurn({
      speechProvider,
      aiProvider,
      audio,
      mimeType: 'audio/webm',
      history,
      level: CEFRLevel.A2,
      motherLanguage: 'English',
      mode: ConversationMode.SPEAKING_ACTIVITY,
      topic: 'Ordering coffee',
      description: 'Practice ordering in a cafe.',
      now: () => '2026-05-15T15:00:05.000Z',
    });

    expect(speechProvider.transcribe).toHaveBeenCalledWith({
      feature: 'conversation voice turn',
      audio,
      mimeType: 'audio/webm',
      options: {
        punctuation: true,
        smartFormat: true,
      },
    });
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'german conversation tutor turn',
        options: {
          temperature: 0.45,
          maxTokens: 260,
        },
      })
    );
    const tutorRequest = vi.mocked(aiProvider.generateText).mock.calls[0][0];
    expect(tutorRequest.messages[0].content).toContain('German conversation tutor');
    expect(tutorRequest.messages[0].content).toContain('CEFR A2');
    expect(tutorRequest.messages[1].content).toContain('Ordering coffee');
    expect(tutorRequest.messages[1].content).toContain('Tutor: Was mochtest du bestellen?');
    expect(tutorRequest.messages[1].content).toContain('Learner: Ich mochte ein Kaffee.');

    expect(result.learnerTurn).toMatchObject({
      speaker: 'learner',
      text: 'Ich mochte ein Kaffee.',
      provider: 'deepgram',
    });
    expect(result.tutorTurn).toEqual({
      speaker: 'tutor',
      text: 'Fast richtig: Ich mochte einen Kaffee. Was trinkst du gern dazu?',
      occurredAt: '2026-05-15T15:00:05.000Z',
      provider: 'openrouter',
    });
    expect(result.transcript).toEqual([...history, result.learnerTurn, result.tutorTurn]);
  });

  it('does not call the tutor when the learner audio has no transcript text', async () => {
    const speechProvider = createSpeechProvider('   ');
    const aiProvider = createAiProvider('Hallo');

    await expect(
      runTurnBasedConversationTurn({
        speechProvider,
        aiProvider,
        audio: new Uint8Array([1]),
        mimeType: 'audio/webm',
        history: [],
        level: CEFRLevel.A1,
        motherLanguage: 'English',
        mode: ConversationMode.FREE_CONVERSATION,
      })
    ).rejects.toThrow('No German speech was transcribed');

    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });
});

describe('transcriptTurnsToLegacyTranscripts', () => {
  it('maps local transcript turns to the legacy feedback transcript shape', () => {
    expect(
      transcriptTurnsToLegacyTranscripts([
        { speaker: 'learner', text: 'Hallo', occurredAt: '2026-05-15T15:00:00.000Z' },
        { speaker: 'tutor', text: 'Guten Tag', occurredAt: '2026-05-15T15:00:01.000Z' },
        { speaker: 'system', text: 'started', occurredAt: '2026-05-15T15:00:02.000Z' },
      ])
    ).toEqual([
      { id: 0, speaker: 'user', text: 'Hallo' },
      { id: 1, speaker: 'model', text: 'Guten Tag' },
    ]);
  });
});
