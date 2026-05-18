import { describe, expect, it, vi } from 'vitest';
import {
  convertFloat32ToPcm16,
  downsampleFloat32Audio,
  recordAudioSample,
  selectRecordingMimeType,
  startBrowserAudioRecording,
  startBrowserPcmAudioCapture,
  startBrowserStreamingAudioCapture,
} from '../../../src/infrastructure/browser/audioRecorder';

describe('selectRecordingMimeType', () => {
  it('selects the first browser-supported audio MIME type', () => {
    const isTypeSupported = vi.fn((mimeType: string) => mimeType === 'audio/webm');

    expect(selectRecordingMimeType(isTypeSupported)).toBe('audio/webm');
    expect(isTypeSupported).toHaveBeenCalledWith('audio/webm;codecs=opus');
    expect(isTypeSupported).toHaveBeenCalledWith('audio/webm');
  });

  it('returns undefined when MIME probing is unavailable', () => {
    expect(selectRecordingMimeType()).toBeUndefined();
  });
});

describe('startBrowserAudioRecording', () => {
  it('records audio, returns a playable sample, and stops microphone tracks', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    let recorder: FakeMediaRecorder | null = null;

    const activeRecording = await startBrowserAudioRecording({
      getUserMedia,
      createRecorder: (mediaStream, options) => {
        recorder = new FakeMediaRecorder(mediaStream, options?.mimeType);
        return recorder as unknown as MediaRecorder;
      },
      selectMimeType: () => 'audio/webm',
      createPlaybackUrl: () => 'blob:recorded-sample',
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorder?.start).toHaveBeenCalled();

    const sample = await activeRecording.stop();

    expect(sample.mimeType).toBe('audio/webm');
    expect(sample.playbackUrl).toBe('blob:recorded-sample');
    expect(sample.audio.size).toBeGreaterThan(0);
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('startBrowserStreamingAudioCapture', () => {
  it('streams audio chunks and stops microphone tracks', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    let recorder: FakeMediaRecorder | null = null;
    const chunks: Blob[] = [];

    const activeCapture = await startBrowserStreamingAudioCapture({
      getUserMedia,
      createRecorder: (mediaStream, options) => {
        recorder = new FakeMediaRecorder(mediaStream, options?.mimeType);
        return recorder as unknown as MediaRecorder;
      },
      selectMimeType: () => 'audio/webm',
      chunkIntervalMs: 300,
      onAudioChunk: chunk => chunks.push(chunk),
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorder?.start).toHaveBeenCalledWith(300);

    recorder?.emitData('live voice');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('audio/webm');

    activeCapture.stop();

    expect(recorder?.stop).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('PCM audio helpers', () => {
  it('downsamples Float32 microphone samples and converts them to little-endian PCM16', () => {
    const downsampled = downsampleFloat32Audio(new Float32Array([0, 0.5, -0.5, 1]), 32000, 16000);
    const pcm = convertFloat32ToPcm16(downsampled);
    const view = new DataView(pcm.buffer);

    expect(Array.from(downsampled)).toEqual([0, -0.5]);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(-16384);
  });
});

describe('startBrowserPcmAudioCapture', () => {
  it('streams raw PCM16 chunks and releases microphone/audio nodes', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const audioContext = new FakeAudioContext(16000);
    const chunks: Uint8Array[] = [];

    const activeCapture = await startBrowserPcmAudioCapture({
      getUserMedia,
      createAudioContext: () => audioContext,
      onPcmChunk: chunk => chunks.push(chunk),
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(audioContext.source.connect).toHaveBeenCalledWith(audioContext.processor);
    expect(audioContext.processor.connect).toHaveBeenCalledWith(audioContext.destination);

    audioContext.processor.emit(new Float32Array([0, 1]));

    expect(chunks).toHaveLength(1);
    expect(new DataView(chunks[0].buffer).getInt16(2, true)).toBe(32767);

    activeCapture.stop();

    expect(audioContext.source.disconnect).toHaveBeenCalled();
    expect(audioContext.processor.disconnect).toHaveBeenCalled();
    expect(audioContext.close).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });

  it('resumes a suspended audio context before streaming PCM chunks', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const audioContext = new FakeAudioContext(16000);
    audioContext.state = 'suspended';

    await startBrowserPcmAudioCapture({
      getUserMedia: vi.fn().mockResolvedValue(stream),
      createAudioContext: () => audioContext,
      onPcmChunk: vi.fn(),
    });

    expect(audioContext.resume).toHaveBeenCalled();
  });
});

describe('recordAudioSample', () => {
  it('stops an active recording after the requested duration', async () => {
    vi.useFakeTimers();
    const activeRecording = {
      stop: vi.fn().mockResolvedValue({
        audio: new Blob(['voice'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
      }),
      cancel: vi.fn(),
    };

    const samplePromise = recordAudioSample({
      durationMs: 500,
      startRecording: vi.fn().mockResolvedValue(activeRecording),
      delay: ms => new Promise(resolve => window.setTimeout(resolve, ms)),
    });
    await vi.advanceTimersByTimeAsync(500);

    await expect(samplePromise).resolves.toMatchObject({ mimeType: 'audio/webm' });
    expect(activeRecording.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

class FakeMediaRecorder {
  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  start = vi.fn((_timeslice?: number) => {
    this.state = 'recording';
  });

  constructor(
    readonly stream: MediaStream,
    mimeType = 'audio/webm'
  ) {
    this.mimeType = mimeType;
  }

  stop = vi.fn(() => {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['voice'], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.(new Event('stop'));
  });

  emitData(value: string) {
    this.ondataavailable?.({
      data: new Blob([value], { type: this.mimeType }),
    } as BlobEvent);
  }
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  destination = {};
  source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  processor = new FakeScriptProcessorNode();
  close = vi.fn();

  constructor(readonly sampleRate: number) {}

  createMediaStreamSource = vi.fn(() => this.source);

  createScriptProcessor = vi.fn(() => this.processor);

  resume = vi.fn(async () => {
    this.state = 'running';
  });
}

class FakeScriptProcessorNode {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();

  emit(samples: Float32Array) {
    this.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => samples,
      },
    } as AudioProcessingEvent);
  }
}
