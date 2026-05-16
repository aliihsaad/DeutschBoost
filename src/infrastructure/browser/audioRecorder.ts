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

function defaultDelay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
