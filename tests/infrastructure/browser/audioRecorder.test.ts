import { describe, expect, it, vi } from 'vitest';
import {
  recordAudioSample,
  selectRecordingMimeType,
  startBrowserAudioRecording,
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
