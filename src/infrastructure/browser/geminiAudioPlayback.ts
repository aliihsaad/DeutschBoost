export type PlayGeminiPcmAudio = (
  audio: ArrayBuffer,
  mimeType: string,
  sampleRate: number
) => Promise<void>;

export async function playGeminiPcmAudio(
  audio: ArrayBuffer,
  mimeType: string,
  sampleRate: number
): Promise<void> {
  const playbackBlob = mimeType.startsWith('audio/pcm')
    ? createWavBlobFromPcm16(audio, sampleRate)
    : new Blob([audio], { type: mimeType });
  const playbackUrl = URL.createObjectURL(playbackBlob);

  try {
    await playAudioUrl(playbackUrl);
  } finally {
    releaseObjectUrl(playbackUrl);
  }
}

function playAudioUrl(url: string): Promise<void> {
  const audio = new Audio(url);

  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    const playback = audio.play();

    if (playback) {
      playback.catch(reject);
    }
  });
}

function createWavBlobFromPcm16(audio: ArrayBuffer, sampleRate: number): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const channelCount = 1;
  const bytesPerSample = 2;
  const byteRate = sampleRate * channelCount * bytesPerSample;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + audio.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, audio.byteLength, true);

  return new Blob([header, audio], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function releaseObjectUrl(url: string): void {
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}
