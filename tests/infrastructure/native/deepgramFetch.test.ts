import { describe, expect, it, vi } from 'vitest';
import { createInstalledNativeDeepgramFetch, createTauriDeepgramFetch } from '../../../src/infrastructure/native/deepgramFetch';

describe('createTauriDeepgramFetch', () => {
  it('routes local Deepgram auth checks through the Tauri command bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({ member_id: 'member-123' }),
      content_type: 'application/json',
    });
    const fetchFn = createTauriDeepgramFetch(invoke);

    const response = await fetchFn('/api/deepgram/v1/auth/token', {
      method: 'GET',
      headers: {
        Authorization: 'Token deepgram-key',
      },
    });

    await expect(response.json()).resolves.toEqual({ member_id: 'member-123' });
    expect(invoke).toHaveBeenCalledWith('deepgram_auth_token', {
      apiKey: 'deepgram-key',
    });
  });

  it('routes Deepgram transcription audio through the Tauri command bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        results: {
          channels: [{ alternatives: [{ transcript: 'Guten Tag' }] }],
        },
      }),
      content_type: 'application/json',
    });
    const fetchFn = createTauriDeepgramFetch(invoke);

    const response = await fetchFn(
      '/api/deepgram/v1/listen?model=nova-3&language=de&punctuate=true&smart_format=true',
      {
        method: 'POST',
        headers: {
          Authorization: 'Token deepgram-key',
          'Content-Type': 'audio/webm',
        },
        body: new Uint8Array([1, 2, 3]),
      }
    );

    await expect(response.json()).resolves.toEqual({
      results: {
        channels: [{ alternatives: [{ transcript: 'Guten Tag' }] }],
      },
    });
    expect(invoke).toHaveBeenCalledWith('deepgram_transcribe', {
      apiKey: 'deepgram-key',
      model: 'nova-3',
      language: 'de',
      audio: [1, 2, 3],
      mimeType: 'audio/webm',
      punctuate: true,
      smartFormat: true,
      diarize: null,
    });
  });
});

describe('createInstalledNativeDeepgramFetch', () => {
  it('stays disabled outside Tauri', () => {
    expect(createInstalledNativeDeepgramFetch({})).toBeNull();
  });
});
