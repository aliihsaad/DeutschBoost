import { parseAiJsonResponse } from '../../../utils/safeJsonParse';
import {
  AiProviderError,
  type AiJsonRequest,
  type AiMessage,
  type AiProvider,
  type AiTextRequest,
} from './aiProvider';

interface GeminiGenerationConfig {
  responseMimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiGenerateContentRequest {
  model: string;
  contents: string;
  config?: GeminiGenerationConfig;
}

interface GeminiGenerateContentResponse {
  text?: string | (() => string | undefined);
}

export interface GeminiClientLike {
  models: {
    generateContent(request: GeminiGenerateContentRequest): Promise<GeminiGenerateContentResponse>;
  };
}

interface GeminiProviderOptions {
  client: GeminiClientLike;
  defaultJsonModel?: string;
  defaultTextModel?: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const messagesToContents = (messages: AiMessage[]): string => {
  if (messages.length === 1 && messages[0]?.role === 'user') {
    return messages[0].content;
  }

  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n');
};

const responseText = (response: GeminiGenerateContentResponse): string | undefined => {
  if (typeof response.text === 'function') {
    return response.text();
  }

  return response.text;
};

const requireResponseText = (
  response: GeminiGenerateContentResponse,
  feature: string
): string => {
  const text = responseText(response);

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new AiProviderError(`Missing ${feature} response text`, {
      provider: 'gemini',
      feature,
      retryable: true,
    });
  }

  return text;
};

const generationConfig = (
  request: AiJsonRequest | AiTextRequest,
  responseMimeType?: string
): GeminiGenerationConfig | undefined => {
  const config: GeminiGenerationConfig = {};

  if (responseMimeType) {
    config.responseMimeType = responseMimeType;
  }

  if (request.options?.temperature !== undefined) {
    config.temperature = request.options.temperature;
  }

  if (request.options?.maxTokens !== undefined) {
    config.maxOutputTokens = request.options.maxTokens;
  }

  return Object.keys(config).length > 0 ? config : undefined;
};

export const createGeminiAiProvider = (options: GeminiProviderOptions): AiProvider => {
  const defaultJsonModel = options.defaultJsonModel ?? DEFAULT_GEMINI_MODEL;
  const defaultTextModel = options.defaultTextModel ?? DEFAULT_GEMINI_MODEL;

  return {
    id: 'gemini',
    displayName: 'Google Gemini',
    async generateJson<T>(request: AiJsonRequest): Promise<T> {
      const response = await options.client.models.generateContent({
        model: request.options?.model ?? defaultJsonModel,
        contents: messagesToContents(request.messages),
        config: generationConfig(request, 'application/json'),
      });
      return parseAiJsonResponse<T>(
        requireResponseText(response, request.feature),
        request.schemaName ?? request.feature
      );
    },
    async generateText(request: AiTextRequest): Promise<string> {
      const response = await options.client.models.generateContent({
        model: request.options?.model ?? defaultTextModel,
        contents: messagesToContents(request.messages),
        config: generationConfig(request),
      });
      return requireResponseText(response, request.feature);
    },
  };
};
