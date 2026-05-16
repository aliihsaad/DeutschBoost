import type { TranscriptTurn } from './transcriptTypes';

export type StreamingSpeechState =
  | 'connecting'
  | 'open'
  | 'listening'
  | 'speaking'
  | 'closed'
  | 'error';

export interface StreamingTranscriptPiece {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
  confidence?: number;
  startedAtSeconds?: number;
  durationSeconds?: number;
  providerMetadata?: Record<string, unknown>;
}

export interface StreamingTranscriptEvent {
  type: 'interim' | 'final' | 'speech-started' | 'utterance-end' | 'error' | 'closed';
  piece?: StreamingTranscriptPiece;
  turn?: TranscriptTurn;
  error?: Error;
}

export interface StreamingSpeechToTextOptions {
  language: string;
  model: string;
  endpointingMs: number;
  interimResults: boolean;
  punctuate: boolean;
  smartFormat: boolean;
}

export interface StreamingSpeechToTextSession {
  readonly id: string;
  sendAudio(chunk: Blob | ArrayBuffer | Uint8Array): void;
  finalize(): void;
  close(): void;
  onEvent(listener: (event: StreamingTranscriptEvent) => void): () => void;
}

export interface StreamingTextToSpeechOptions {
  ttsModel: string;
  encoding: 'mp3' | 'linear16';
  sampleRate?: number;
  speed?: number;
}

export interface StreamingSpeechAudioEvent {
  type: 'audio' | 'flushed' | 'cleared' | 'warning' | 'closed' | 'error';
  audio?: ArrayBuffer;
  mimeType?: string;
  warning?: string;
  error?: Error;
  providerMetadata?: Record<string, unknown>;
}

export interface StreamingTextToSpeechSession {
  readonly id: string;
  sendText(text: string): void;
  flush(): void;
  clear(): void;
  close(): void;
  onEvent(listener: (event: StreamingSpeechAudioEvent) => void): () => void;
}

export interface StreamingSpeechProvider {
  id: string;
  displayName: string;
  startTranscription(options: StreamingSpeechToTextOptions): Promise<StreamingSpeechToTextSession>;
  startSynthesis(options: StreamingTextToSpeechOptions): Promise<StreamingTextToSpeechSession>;
}
