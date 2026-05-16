import type { TranscriptTurn } from './transcriptTypes';

export interface SpeechTranscriptionOptions {
  language?: string;
  model?: string;
  punctuation?: boolean;
  smartFormat?: boolean;
  diarize?: boolean;
}

export interface SpeechTranscriptionRequest {
  feature: string;
  audio: Blob | ArrayBuffer | Uint8Array;
  mimeType: string;
  options?: SpeechTranscriptionOptions;
}

export interface SpeechTranscriptionResult {
  transcript: TranscriptTurn;
  rawText: string;
  providerMetadata?: Record<string, unknown>;
}

export interface SpeechSynthesisOptions {
  ttsModel?: string;
  language?: string;
  format?: 'mp3';
  speed?: number;
}

export interface SpeechSynthesisRequest {
  feature: string;
  text: string;
  options?: SpeechSynthesisOptions;
}

export interface SpeechSynthesisResult {
  audio: ArrayBuffer;
  mimeType: string;
  providerMetadata?: Record<string, unknown>;
}

export interface SpeechProvider {
  id: string;
  displayName: string;
  transcribe(request: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult>;
  synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
}

export interface SpeechProviderErrorOptions {
  provider: string;
  feature: string;
  retryable?: boolean;
  cause?: unknown;
}

export class SpeechProviderError extends Error {
  readonly provider: string;
  readonly feature: string;
  readonly retryable: boolean;

  constructor(message: string, options: SpeechProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'SpeechProviderError';
    this.provider = options.provider;
    this.feature = options.feature;
    this.retryable = options.retryable ?? false;
  }
}
