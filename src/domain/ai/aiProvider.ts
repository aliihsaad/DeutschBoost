export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface AiJsonRequest {
  feature: string;
  messages: AiMessage[];
  schemaName?: string;
  options?: AiGenerationOptions;
}

export interface AiTextRequest {
  feature: string;
  messages: AiMessage[];
  options?: AiGenerationOptions;
}

export interface AiProvider {
  id: string;
  displayName: string;
  generateJson<T>(request: AiJsonRequest): Promise<T>;
  generateText(request: AiTextRequest): Promise<string>;
}

export interface AiProviderErrorOptions {
  provider: string;
  feature: string;
  retryable?: boolean;
  cause?: unknown;
}

export class AiProviderError extends Error {
  readonly provider: string;
  readonly feature: string;
  readonly retryable: boolean;

  constructor(message: string, options: AiProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'AiProviderError';
    this.provider = options.provider;
    this.feature = options.feature;
    this.retryable = options.retryable ?? false;
  }
}

export const isAiProviderError = (error: unknown): error is AiProviderError => {
  return error instanceof AiProviderError;
};
