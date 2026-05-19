export type PlayGeminiPcmAudio = (
  audio: ArrayBuffer,
  mimeType: string,
  sampleRate: number
) => Promise<void>;

// Minimal Web Audio surface so this is testable with a fake context.
interface AudioBufferLike {
  duration: number;
  getChannelData(channel: number): Float32Array;
}

interface AudioBufferSourceLike {
  buffer: AudioBufferLike | null;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  start(when: number): void;
  stop(): void;
}

interface AudioContextLike {
  currentTime: number;
  destination: unknown;
  state?: string;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioBufferSourceLike;
  resume?: () => void | Promise<void>;
}

type AudioContextFactory = () => AudioContextLike;

export interface GeminiPcmAudioStream {
  play: PlayGeminiPcmAudio;
  reset(): void;
}

function defaultAudioContextFactory(): AudioContextLike {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) {
    throw new Error('Web Audio is not available in this environment');
  }

  return new Ctor() as unknown as AudioContextLike;
}

function pcm16ToFloat32(audio: ArrayBuffer): Float32Array {
  const view = new DataView(audio);
  const sampleCount = Math.floor(audio.byteLength / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000;
  }

  return samples;
}

/**
 * Schedules consecutive PCM16 chunks back-to-back on a single audio timeline so
 * Gemini's streamed audio plays as one continuous, gap-free voice instead of
 * many overlapping/choppy clips.
 */
export function createGeminiPcmAudioStream(
  createContext: AudioContextFactory = defaultAudioContextFactory
): GeminiPcmAudioStream {
  let context: AudioContextLike | null = null;
  let nextStartTime = 0;
  const activeSources = new Set<AudioBufferSourceLike>();

  const ensureContext = (): AudioContextLike => {
    if (!context) {
      context = createContext();
      nextStartTime = context.currentTime;
    }
    if (context.state === 'suspended') {
      void context.resume?.();
    }
    return context;
  };

  return {
    play(audio, mimeType, sampleRate) {
      if (!mimeType.startsWith('audio/pcm')) {
        return Promise.resolve();
      }

      const ctx = ensureContext();
      const samples = pcm16ToFloat32(audio);

      if (samples.length === 0) {
        return Promise.resolve();
      }

      const buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime, nextStartTime);
      source.start(startAt);
      nextStartTime = startAt + buffer.duration;
      activeSources.add(source);

      return new Promise(resolve => {
        source.onended = () => {
          activeSources.delete(source);
          resolve();
        };
      });
    },
    reset() {
      activeSources.forEach(source => {
        try {
          source.stop();
        } catch {
          // A source that already finished throws on stop(); ignore.
        }
      });
      activeSources.clear();
      nextStartTime = context ? context.currentTime : 0;
    },
  };
}

let defaultStream: GeminiPcmAudioStream | null = null;

function getDefaultStream(): GeminiPcmAudioStream {
  if (!defaultStream) {
    defaultStream = createGeminiPcmAudioStream();
  }
  return defaultStream;
}

export const playGeminiPcmAudio: PlayGeminiPcmAudio = (audio, mimeType, sampleRate) =>
  getDefaultStream().play(audio, mimeType, sampleRate);

export function resetGeminiPcmAudioStream(): void {
  defaultStream?.reset();
}
