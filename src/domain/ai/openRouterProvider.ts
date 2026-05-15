import { parseAiJsonResponse } from '../../../utils/safeJsonParse';
import {
  AiProviderError,
  type AiJsonRequest,
  type AiMessage,
  type AiProvider,
  type AiTextRequest,
} from './aiProvider';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface OpenRouterProviderOptions {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  appTitle?: string;
  siteUrl?: string;
  fetchFn?: FetchLike;
}

interface OpenRouterChoice {
  message?: {
    content?: string | null;
  };
}

interface OpenRouterCompletionResponse {
  choices?: OpenRouterChoice[];
}

interface OpenRouterErrorBody {
  error?: {
    message?: string;
  } | string;
  message?: string;
}

interface CompletionRequestOptions {
  jsonMode?: boolean;
  schemaName?: string;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const createHeaders = (options: OpenRouterProviderOptions): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (options.siteUrl) {
    headers['HTTP-Referer'] = options.siteUrl;
  }

  if (options.appTitle) {
    headers['X-Title'] = options.appTitle;
  }

  return headers;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  const rawBody = await response.text();

  if (!rawBody) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(rawBody) as OpenRouterErrorBody;
    if (typeof parsed.error === 'string') {
      return parsed.error;
    }
    return parsed.error?.message ?? parsed.message ?? rawBody;
  } catch {
    return rawBody;
  }
};

const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

const extractAssistantText = (
  body: OpenRouterCompletionResponse,
  provider: string,
  feature: string
): string => {
  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new AiProviderError('OpenRouter returned an empty assistant response', {
      provider,
      feature,
      retryable: true,
    });
  }

  return content;
};

const messagesForRequest = (messages: AiMessage[]): AiMessage[] => {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
};

export const createOpenRouterProvider = (options: OpenRouterProviderOptions): AiProvider => {
  const providerId = 'openrouter';
  const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL);
  const fetchFn = options.fetchFn ?? fetch;

  const runCompletion = async (
    request: AiJsonRequest | AiTextRequest,
    completionOptions: CompletionRequestOptions = {}
  ): Promise<string> => {
    if (!options.apiKey?.trim()) {
      throw new AiProviderError('OpenRouter API key is required', {
        provider: providerId,
        feature: request.feature,
        retryable: false,
      });
    }

    const body = {
      model: request.options?.model ?? options.model,
      messages: messagesForRequest(request.messages),
      temperature: request.options?.temperature,
      max_tokens: request.options?.maxTokens,
      ...(completionOptions.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: createHeaders(options),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AiProviderError(`OpenRouter request failed: ${await readErrorMessage(response)}`, {
        provider: providerId,
        feature: request.feature,
        retryable: isRetryableStatus(response.status),
      });
    }

    const responseBody = (await response.json()) as OpenRouterCompletionResponse;
    return extractAssistantText(responseBody, providerId, request.feature);
  };

  return {
    id: providerId,
    displayName: 'OpenRouter',
    async generateJson<T>(request: AiJsonRequest): Promise<T> {
      const text = await runCompletion(request, {
        jsonMode: true,
        schemaName: request.schemaName,
      });
      return parseAiJsonResponse<T>(text, request.schemaName ?? request.feature);
    },
    async generateText(request: AiTextRequest): Promise<string> {
      return runCompletion(request);
    },
  };
};
