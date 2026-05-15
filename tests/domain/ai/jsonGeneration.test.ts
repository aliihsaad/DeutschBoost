import { describe, expect, it, vi } from 'vitest';
import { generateJsonWithProvider } from '../../../src/domain/ai/jsonGeneration';
import type { AiProvider, AiJsonRequest } from '../../../src/domain/ai/aiProvider';

interface GeneratedActivity {
  topic: string;
  questionCount: number;
}

const createRequest = (): AiJsonRequest => ({
  feature: 'activity-generation',
  messages: [
    {
      role: 'system',
      content: 'You create German learning activities.',
    },
    {
      role: 'user',
      content: 'Create one A1 grammar question.',
    },
  ],
});

describe('generateJsonWithProvider', () => {
  it('forwards JSON generation requests to the selected provider', async () => {
    const provider: AiProvider = {
      id: 'test-provider',
      displayName: 'Test Provider',
      generateJson: vi.fn().mockResolvedValue({
        topic: 'Articles',
        questionCount: 1,
      }),
      generateText: vi.fn(),
    };

    const request = createRequest();
    const result = await generateJsonWithProvider<GeneratedActivity>(provider, request);

    expect(result).toEqual({
      topic: 'Articles',
      questionCount: 1,
    });
    expect(provider.generateJson).toHaveBeenCalledWith(request);
  });

  it('adds feature context when provider JSON generation fails', async () => {
    const provider: AiProvider = {
      id: 'test-provider',
      displayName: 'Test Provider',
      generateJson: vi.fn().mockRejectedValue(new Error('model overloaded')),
      generateText: vi.fn(),
    };

    await expect(generateJsonWithProvider(provider, createRequest())).rejects.toThrow(
      'activity-generation failed with test-provider: model overloaded'
    );
  });
});
