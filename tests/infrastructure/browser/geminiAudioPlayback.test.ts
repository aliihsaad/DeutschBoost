import { describe, expect, it } from 'vitest';
import { createGeminiPcmAudioStream } from '../../../src/infrastructure/browser/geminiAudioPlayback';

class FakeBuffer {
  duration: number;
  private channel: Float32Array;
  constructor(length: number, sampleRate: number) {
    this.duration = length / sampleRate;
    this.channel = new Float32Array(length);
  }
  getChannelData() {
    return this.channel;
  }
}

class FakeSource {
  buffer: FakeBuffer | null = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;
  connect() {}
  start(when: number) {
    this.startedAt = when;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeContext {
  currentTime = 0;
  destination = {};
  state = 'running';
  sources: FakeSource[] = [];
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return new FakeBuffer(length, sampleRate);
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source as unknown as ReturnType<AudioContext['createBufferSource']>;
  }
}

function pcmChunk(samples: number): ArrayBuffer {
  return new ArrayBuffer(samples * 2); // PCM16 => 2 bytes/sample
}

describe('createGeminiPcmAudioStream', () => {
  it('schedules consecutive PCM chunks back-to-back with no gaps', () => {
    const ctx = new FakeContext();
    const stream = createGeminiPcmAudioStream(() => ctx as unknown as never);

    void stream.play(pcmChunk(24000), 'audio/pcm;rate=24000', 24000); // 1.0s
    void stream.play(pcmChunk(12000), 'audio/pcm;rate=24000', 24000); // 0.5s

    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0].startedAt).toBe(0);
    // Second chunk starts exactly when the first ends — gapless.
    expect(ctx.sources[1].startedAt).toBe(1);
  });

  it('reset() stops queued sources and rebases the timeline', () => {
    const ctx = new FakeContext();
    const stream = createGeminiPcmAudioStream(() => ctx as unknown as never);

    void stream.play(pcmChunk(24000), 'audio/pcm;rate=24000', 24000);
    stream.reset();
    expect(ctx.sources[0].stopped).toBe(true);

    ctx.currentTime = 5;
    void stream.play(pcmChunk(24000), 'audio/pcm;rate=24000', 24000);
    expect(ctx.sources[1].startedAt).toBe(5);
  });

  it('ignores non-PCM mime types without scheduling', async () => {
    const ctx = new FakeContext();
    const stream = createGeminiPcmAudioStream(() => ctx as unknown as never);
    await stream.play(new ArrayBuffer(8), 'audio/mpeg', 24000);
    expect(ctx.sources).toHaveLength(0);
  });
});
