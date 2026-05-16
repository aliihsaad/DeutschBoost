import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EnhancedPlacementTestPage from '../../pages/EnhancedPlacementTestPage';
import { CEFRLevel } from '../../types';
import type { AiProvider } from '../../src/domain/ai/aiProvider';

const geminiService = vi.hoisted(() => ({
  generateReadingQuestion: vi.fn(),
  generateGrammarQuestion: vi.fn(),
  evaluateComprehensivePlacementTest: vi.fn(),
}));

vi.mock('../../services/geminiService', () => geminiService);

const provider: AiProvider = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  generateJson: vi.fn(),
  generateText: vi.fn(),
};

describe('EnhancedPlacementTestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not start the placement test until an AI provider is configured', () => {
    render(<EnhancedPlacementTestPage onTestComplete={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Connect OpenRouter in Settings before starting the placement test.'
    );
    expect(screen.getByRole('button', { name: 'Connect OpenRouter first' })).toBeDisabled();
    expect(geminiService.generateReadingQuestion).not.toHaveBeenCalled();
  });

  it('starts placement questions with the configured AI provider instead of the Gemini-only default', async () => {
    geminiService.generateReadingQuestion.mockImplementation(async (level: CEFRLevel) => ({
      text: JSON.stringify({
        text: `Reading ${level}`,
        question: 'Welche Antwort passt?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
      }),
    }));

    render(<EnhancedPlacementTestPage onTestComplete={vi.fn()} aiProvider={provider} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Test' }));

    await waitFor(() => {
      expect(geminiService.generateReadingQuestion).toHaveBeenCalledTimes(5);
    });
    expect(geminiService.generateReadingQuestion).toHaveBeenCalledWith(CEFRLevel.A2, provider);
    expect(await screen.findByRole('heading', { name: /Reading Comprehension/i })).toBeInTheDocument();
  });
});
