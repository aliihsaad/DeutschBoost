export interface RecordedAudioSample {
  audio: Blob;
  mimeType: string;
  playbackUrl?: string;
}

export interface ActiveAudioRecording {
  stop(): Promise<RecordedAudioSample>;
  cancel(): void;
}

export interface ActiveStreamingAudioCapture {
  stop(): void;
}

export interface ActivePcmAudioCapture {
  stop(): void;
}

interface BrowserAudioRecordingOptions {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream, options?: MediaRecorderOptions) => MediaRecorder;
  selectMimeType?: () => string | undefined;
  createPlaybackUrl?: (audio: Blob) => string | undefined;
}

interface BrowserStreamingAudioCaptureOptions {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream, options?: MediaRecorderOptions) => MediaRecorder;
  selectMimeType?: () => string | undefined;
  chunkIntervalMs?: number;
  onAudioChunk: (chunk: Blob) => void;
  onError?: (error: Error) => void;
}

interface PcmAudioContextLike {
  sampleRate: number;
  destination: unknown;
  createMediaStreamSource(stream: MediaStream): PcmAudioSourceNodeLike;
  createScriptProcessor(
    bufferSize: number,
    numberOfInputChannels: number,
    numberOfOutputChannels: number
  ): PcmScriptProcessorNodeLike;
  close?: () => void | Promise<void>;
}

interface PcmAudioSourceNodeLike {
  connect(destination: unknown): void;
  disconnect(): void;
}

interface PcmScriptProcessorNodeLike {
  onaudioprocess: ((event: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null;
  connect(destination: unknown): void;
  disconnect(): void;
}

interface BrowserPcmAudioCaptureOptions {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext?: () => PcmAudioContextLike;
  targetSampleRate?: number;
  bufferSize?: number;
  onPcmChunk: (chunk: Uint8Array) => void;
  onError?: (error: Error) => void;
}

interface RecordAudioSampleOptions {
  durationMs?: number;
  startRecording?: () => Promise<ActiveAudioRecording>;
  delay?: (ms: number) => Promise<void>;
}

const RECORDING_MIME_TYPE_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export function selectRecordingMimeType(
  isTypeSupported?: (mimeType: string) => boolean
): string | undefined {
  const supports =
    isTypeSupported ??
    (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
      : undefined);

  if (!supports) {
    return undefined;
  }

  return RECORDING_MIME_TYPE_CANDIDATES.find(candidate => supports(candidate));
}

export async function startBrowserAudioRecording(
  options: BrowserAudioRecordingOptions = {}
): Promise<ActiveAudioRecording> {
  const getUserMedia = options.getUserMedia ?? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!getUserMedia) {
    throw new Error('Microphone recording is not available in this browser');
  }

  if (typeof MediaRecorder === 'undefined' && !options.createRecorder) {
    throw new Error('Audio recording is not available in this browser');
  }

  const stream = await getUserMedia({ audio: true });

  try {
    const mimeType = options.selectMimeType?.() ?? selectRecordingMimeType();
    const recorder =
      options.createRecorder?.(stream, mimeType ? { mimeType } : undefined) ??
      new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];

    const stopped = new Promise<RecordedAudioSample>((resolve, reject) => {
      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => {
        stopTracks(stream);
        reject(new Error('Microphone recording failed'));
      };
      recorder.onstop = () => {
        stopTracks(stream);
        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const audio = new Blob(chunks, { type: recordedMimeType });

        if (audio.size === 0) {
          reject(new Error('No audio was recorded'));
          return;
        }

        resolve({
          audio,
          mimeType: recordedMimeType,
          playbackUrl: createPlaybackUrl(audio, options.createPlaybackUrl),
        });
      };
    });

    recorder.start();

    return {
      stop: () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }

        return stopped;
      },
      cancel: () => {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        stopTracks(stream);
      },
    };
  } catch (error) {
    stopTracks(stream);
    throw error;
  }
}

export async function startBrowserStreamingAudioCapture(
  options: BrowserStreamingAudioCaptureOptions
): Promise<ActiveStreamingAudioCapture> {
  const getUserMedia = options.getUserMedia ?? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!getUserMedia) {
    throw new Error('Microphone recording is not available in this browser');
  }

  if (typeof MediaRecorder === 'undefined' && !options.createRecorder) {
    throw new Error('Audio recording is not available in this browser');
  }

  const stream = await getUserMedia({ audio: true });

  try {
    const mimeType = options.selectMimeType?.() ?? selectRecordingMimeType();
    const recorder =
      options.createRecorder?.(stream, mimeType ? { mimeType } : undefined) ??
      new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        options.onAudioChunk(event.data);
      }
    };
    recorder.onerror = () => {
      stopTracks(stream);
      options.onError?.(new Error('Microphone streaming failed'));
    };
    recorder.onstop = () => {
      stopTracks(stream);
    };
    recorder.start(options.chunkIntervalMs ?? 250);

    return {
      stop: () => {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          stopTracks(stream);
        }
      },
    };
  } catch (error) {
    stopTracks(stream);
    throw error;
  }
}

export async function startBrowserPcmAudioCapture(
  options: BrowserPcmAudioCaptureOptions
): Promise<ActivePcmAudioCapture> {
  const getUserMedia = options.getUserMedia ?? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!getUserMedia) {
    throw new Error('Microphone recording is not available in this browser');
  }

  const createAudioContext = options.createAudioContext ?? createDefaultAudioContext;
  const stream = await getUserMedia({ audio: true });

  try {
    const audioContext = createAudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(options.bufferSize ?? 4096, 1, 1);
    const targetSampleRate = options.targetSampleRate ?? 16000;

    processor.onaudioprocess = event => {
      try {
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleFloat32Audio(input, audioContext.sampleRate, targetSampleRate);
        options.onPcmChunk(convertFloat32ToPcm16(downsampled));
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error('Microphone PCM conversion failed'));
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    return {
      stop: () => {
        processor.onaudioprocess = null;
        source.disconnect();
        processor.disconnect();
        void audioContext.close?.();
        stopTracks(stream);
      },
    };
  } catch (error) {
    stopTracks(stream);
    throw error;
  }
}

export function downsampleFloat32Audio(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (targetSampleRate >= sourceSampleRate) {
    return samples;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.floor(samples.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    output[index] = samples[Math.floor(index * ratio)] ?? 0;
  }

  return output;
}

export function convertFloat32ToPcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(index * 2, value, true);
  });

  return bytes;
}

export async function recordAudioSample(
  options: RecordAudioSampleOptions | number = {}
): Promise<RecordedAudioSample> {
  const normalizedOptions = typeof options === 'number' ? { durationMs: options } : options;
  const durationMs = normalizedOptions.durationMs ?? 3500;
  const startRecording = normalizedOptions.startRecording ?? (() => startBrowserAudioRecording());
  const delay = normalizedOptions.delay ?? defaultDelay;
  const recording = await startRecording();

  await delay(durationMs);

  return recording.stop();
}

function createPlaybackUrl(
  audio: Blob,
  createPlaybackUrlOverride?: (audio: Blob) => string | undefined
): string | undefined {
  if (createPlaybackUrlOverride) {
    return createPlaybackUrlOverride(audio);
  }

  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(audio) : undefined;
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

function createDefaultAudioContext(): PcmAudioContextLike {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Raw microphone capture is not available in this browser');
  }

  return new AudioContextCtor();
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
