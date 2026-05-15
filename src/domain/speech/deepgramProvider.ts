import {
  SpeechProviderError,
  type SpeechProvider,
  type SpeechTranscriptionRequest,
  type SpeechTranscriptionResult,
} from './speechProvider';
import { createTranscriptTurn } from './transcriptTypes';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface DeepgramSpeechProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  fetchFn?: FetchLike;
  now?: () => string;
}

interface DeepgramApiKeyTestOptions {
  apiKey?: string;
  authTokenUrl?: string;
  fetchFn?: FetchLike;
}

export interface DeepgramApiKeyTestResult {
  ok: boolean;
  message: string;
  retryable: boolean;
  status?: number;
}

interface DeepgramAlternative {
  transcript?: string;
  confidence?: number;
}

interface DeepgramChannel {
  alternatives?: DeepgramAlternative[];
}

interface DeepgramResponse {
  request_id?: string;
  metadata?: Record<string, unknown>;
  results?: {
    channels?: DeepgramChannel[];
  };
}

interface DeepgramErrorBody {
  err_msg?: string;
  message?: string;
  error?: string | { message?: string };
}

const DEFAULT_BASE_URL = '/api/deepgram/v1/listen';
const DEFAULT_AUTH_TOKEN_URL = '/api/deepgram/v1/auth/token';
const DEFAULT_MODEL = 'nova-3';
const DEFAULT_LANGUAGE = 'de';

const readErrorMessage = async (response: Response): Promise<string> => {
  const rawBody = await response.text();

  if (!rawBody) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(rawBody) as DeepgramErrorBody;
    if (typeof parsed.error === 'string') {
      return parsed.error;
    }
    return parsed.err_msg ?? parsed.message ?? parsed.error?.message ?? rawBody;
  } catch {
    return rawBody;
  }
};

const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

const appendOptionalBoolean = (params: URLSearchParams, key: string, value?: boolean): void => {
  if (value !== undefined) {
    params.set(key, String(value));
  }
};

const buildTranscriptionUrl = (
  providerOptions: DeepgramSpeechProviderOptions,
  request: SpeechTranscriptionRequest
): string => {
  const params = new URLSearchParams();
  params.set('model', request.options?.model ?? providerOptions.model ?? DEFAULT_MODEL);
  params.set('language', request.options?.language ?? providerOptions.language ?? DEFAULT_LANGUAGE);
  appendOptionalBoolean(params, 'punctuate', request.options?.punctuation);
  appendOptionalBoolean(params, 'diarize', request.options?.diarize);

  return `${providerOptions.baseUrl ?? DEFAULT_BASE_URL}?${params.toString()}`;
};

const firstAlternative = (response: DeepgramResponse): DeepgramAlternative | undefined => {
  return response.results?.channels?.[0]?.alternatives?.[0];
};

export async function testDeepgramApiKey(
  options: DeepgramApiKeyTestOptions
): Promise<DeepgramApiKeyTestResult> {
  const apiKey = options.apiKey?.trim();

  if (!apiKey) {
    return {
      ok: false,
      message: 'Deepgram API key is required',
      retryable: false,
    };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(options.authTokenUrl ?? DEFAULT_AUTH_TOKEN_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Token ${apiKey}`,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      message: `Deepgram key test failed: ${await readErrorMessage(response)}`,
      retryable: isRetryableStatus(response.status),
      status: response.status,
    };
  }

  return {
    ok: true,
    message: 'Deepgram API key is valid',
    retryable: false,
    status: response.status,
  };
}

export const createDeepgramSpeechProvider = (
  options: DeepgramSpeechProviderOptions
): SpeechProvider => {
  const providerId = 'deepgram';
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    id: providerId,
    displayName: 'Deepgram',
    async transcribe(request: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult> {
      if (!options.apiKey?.trim()) {
        throw new SpeechProviderError('Deepgram API key is required', {
          provider: providerId,
          feature: request.feature,
          retryable: false,
        });
      }

      const response = await fetchFn(buildTranscriptionUrl(options, request), {
        method: 'POST',
        headers: {
          Authorization: `Token ${options.apiKey}`,
          'Content-Type': request.mimeType,
        },
        body: request.audio as BodyInit,
      });

      if (!response.ok) {
        throw new SpeechProviderError(`Deepgram request failed: ${await readErrorMessage(response)}`, {
          provider: providerId,
          feature: request.feature,
          retryable: isRetryableStatus(response.status),
        });
      }

      const responseBody = (await response.json()) as DeepgramResponse;
      const alternative = firstAlternative(responseBody);

      if (!alternative || typeof alternative.transcript !== 'string') {
        throw new SpeechProviderError('Deepgram returned no transcript alternative', {
          provider: providerId,
          feature: request.feature,
          retryable: true,
        });
      }

      return {
        rawText: alternative.transcript,
        transcript: createTranscriptTurn({
          speaker: 'learner',
          text: alternative.transcript,
          occurredAt: now(),
          confidence: alternative.confidence,
          provider: providerId,
        }),
        providerMetadata: {
          requestId: responseBody.request_id,
          metadata: responseBody.metadata,
        },
      };
    },
  };
};
