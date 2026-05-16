import type { AiGenerationOptions, AiMessage } from './aiProvider';

export interface StreamingAiTextRequest {
  feature: string;
  messages: AiMessage[];
  options?: AiGenerationOptions;
  signal?: AbortSignal;
}

export interface StreamingAiTextChunk {
  text: string;
  providerMetadata?: Record<string, unknown>;
}

export interface StreamingAiProvider {
  id: string;
  displayName: string;
  streamText(request: StreamingAiTextRequest): AsyncIterable<StreamingAiTextChunk>;
}
