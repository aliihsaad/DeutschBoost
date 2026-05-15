import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const activeLocalShellFiles = [
  'App.tsx',
  'MainApp.tsx',
  'pages/EnhancedPlacementTestPage.tsx',
  'pages/LearningPlanPage.tsx',
  'pages/ActivityPage.tsx',
  'pages/SpeakingActivityPage.tsx',
  'pages/PracticePage.tsx',
  'pages/ExamSimulatorPage.tsx',
];

describe('local app shell cloud boundary', () => {
  it('does not import Supabase auth or cloud-backed practice services from active local routes', () => {
    for (const relativePath of activeLocalShellFiles) {
      const source = readFileSync(join(cwd(), relativePath), 'utf8');

      expect(source, relativePath).not.toMatch(/contexts\/AuthContext/);
      expect(source, relativePath).not.toMatch(/src\/lib\/supabase/);
      expect(source, relativePath).not.toMatch(/services\/practiceService/);
      expect(source, relativePath).not.toMatch(/\buseAuth\b|\bAuthProvider\b/);
    }
  });
});
