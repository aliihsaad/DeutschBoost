import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('legacy Gemini Live conversation cleanup', () => {
  it('does not keep the inactive Gemini Live page or service helpers', () => {
    expect(existsSync(path.join(repoRoot, 'pages/ConversationPage.tsx'))).toBe(false);

    const geminiService = readProjectFile('services/geminiService.ts');

    expect(geminiService).not.toMatch(/LiveConnectSession|LiveServerMessage|Modality/);
    expect(geminiService).not.toMatch(/ai\.live\.connect|startConversationSession/);
    expect(geminiService).not.toMatch(/sendRealtimeInput|decodeAudioData|createPcmBlob|audio\/pcm/);
  });

  it('keeps conversation routes on the provider-based speaking page', () => {
    const mainApp = readProjectFile('MainApp.tsx');
    const speakingPage = readProjectFile('pages/SpeakingActivityPage.tsx');

    expect(mainApp).toContain("import SpeakingActivityPage from './pages/SpeakingActivityPage'");
    expect(mainApp).toContain('path="/conversation"');
    expect(mainApp).not.toContain('ConversationPage');

    expect(speakingPage).not.toMatch(/@google\/genai|LiveConnectSession|startGeminiSession|sendRealtimeInput/);
  });
});
