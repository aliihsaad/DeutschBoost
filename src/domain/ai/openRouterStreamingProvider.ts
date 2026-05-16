import { AiProviderError, type AiMessage } from './aiProvider';
import type {
  StreamingAiProvider,
  StreamingAiTextChunk,
  StreamingAiTextRequest,
} from './streamingAiProvider';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface OpenRouterStreamingProviderOptions {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  appTitle?: string;
  siteUrl?: string;
  fetchFn?: FetchLike;
}

interface OpenRouterStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

interface OpenRouterErrorBody {
  error?: {
    message?: string;
  } | string;
  message?: string;
}

interface ParsedSseBlock {
  chunks: string[];
  done: boolean;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export function createOpenRouterStreamingProvider(
  options: OpenRouterStreamingProviderOptions
): StreamingAiProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchFn = options.fetchFn ?? fetch;

  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    async *streamText(request: StreamingAiTextRequest): AsyncIterable<StreamingAiTextChunk> {
      if (!options.apiKey?.trim()) {
        throw new AiProviderError('OpenRouter API key is required', {
          provider: 'openrouter',
          feature: request.feature,
          retryable: false,
        });
      }

      const response = await fetchFn(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: request.signal,
        headers: createHeaders(options),
        body: JSON.stringify({
          model: request.options?.model ?? options.model,
          messages: messagesForRequest(request.messages),
          temperature: request.options?.temperature,
          max_tokens: request.options?.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new AiProviderError(`OpenRouter stream failed: ${await readErrorMessage(response)}`, {
          provider: 'openrouter',
          feature: request.feature,
          retryable: response.status === 429 || response.status >= 500,
        });
      }

      for await (const text of readOpenRouterSseChunks(response)) {
        yield { text };
      }
    },
  };
}

function createHeaders(options: OpenRouterStreamingProviderOptions): Record<string, string> {
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
}

function messagesForRequest(messages: AiMessage[]): AiMessage[] {
  return messages.map(message => ({
    role: message.role,
    content: message.content,
  }));
}

async function* readOpenRouterSseChunks(response: Response): AsyncIterable<string> {
  if (!response.body) {
    yield* parseOpenRouterSseBlock(await response.text()).chunks;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const parsed = parseOpenRouterSseBlock(block);
      yield* parsed.chunks;

      if (parsed.done) {
        return;
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const parsed = parseOpenRouterSseBlock(buffer);
    yield* parsed.chunks;
  }
}

function parseOpenRouterSseBlock(block: string): ParsedSseBlock {
  const chunks: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) {
      continue;
    }

    const data = trimmed.slice('data:'.length).trim();

    if (data === '[DONE]') {
      return { chunks, done: true };
    }

    const parsed = JSON.parse(data) as OpenRouterStreamChunk;
    const content = parsed.choices?.[0]?.delta?.content;

    if (content) {
      chunks.push(content);
    }
  }

  return { chunks, done: false };
}

async function readErrorMessage(response: Response): Promise<string> {
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
}
