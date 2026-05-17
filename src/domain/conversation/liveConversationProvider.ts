import type { CEFRLevel, ConversationMode } from '../../../types';

export type LiveConversationProviderId = 'gemini-live';

export interface LiveConversationStartInput {
  level: CEFRLevel;
  motherLanguage: string;
  mode: ConversationMode;
  topic?: string;
  description?: string;
}

export type LiveConversationEvent =
  | { type: 'input-transcript'; text: string }
  | { type: 'output-transcript'; text: string }
  | { type: 'audio'; audio: ArrayBuffer; mimeType: string; sampleRate: number }
  | { type: 'interrupted' }
  | { type: 'turn-complete' }
  | { type: 'closed' }
  | { type: 'error'; error: Error };

export interface LiveConversationSession {
  id: string;
  sendAudioPcm16(chunk: Uint8Array | ArrayBuffer): void;
  sendAudioStreamEnd(): void;
  interrupt(): void;
  close(): void;
  onEvent(listener: (event: LiveConversationEvent) => void): () => void;
}

export interface LiveConversationProvider {
  id: LiveConversationProviderId;
  displayName: string;
  startSession(input: LiveConversationStartInput): Promise<LiveConversationSession>;
}
