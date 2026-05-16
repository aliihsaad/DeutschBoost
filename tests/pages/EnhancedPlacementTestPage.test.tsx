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

  it('renders placement completion safely when the AI evaluation omits list fields', async () => {
    geminiService.generateReadingQuestion.mockImplementation(async () => ({
      text: JSON.stringify({
        text: 'Anna kauft Brot.',
        question: 'Was kauft Anna?',
        options: ['Brot', 'Milch', 'Kaffee', 'Tee'],
        correctOptionIndex: 0,
      }),
    }));
    geminiService.generateGrammarQuestion.mockImplementation(async () => ({
      text: JSON.stringify({
        sentence: 'Ich gehe _____ Schule.',
        question: 'Was passt?',
        options: ['in die', 'im', 'an der', 'auf den'],
        correctOptionIndex: 0,
      }),
    }));
    geminiService.evaluateComprehensivePlacementTest.mockResolvedValue({
      level: CEFRLevel.B1,
      recommendations: 'Practice writing complete paragraphs.',
    });
    const onTestComplete = vi.fn();

    render(<EnhancedPlacementTestPage onTestComplete={onTestComplete} aiProvider={provider} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Test' }));

    for (let index = 0; index < 5; index += 1) {
      await screen.findByRole('heading', { name: /Reading Comprehension/i });
      fireEvent.click(screen.getByRole('button', { name: 'A.Brot' }));
      fireEvent.click(screen.getByRole('button', { name: index < 4 ? 'Next Question' : 'Continue to Grammar' }));
    }

    for (let index = 0; index < 5; index += 1) {
      await screen.findByRole('heading', { name: '✏️ Grammar' });
      fireEvent.click(screen.getByRole('button', { name: 'A.in die' }));
      fireEvent.click(screen.getByRole('button', { name: index < 4 ? 'Next Question' : 'Continue to Writing' }));
    }

    const writing = await screen.findByPlaceholderText('Schreiben Sie hier Ihre E-Mail...');
    fireEvent.change(writing, {
      target: {
        value:
          'Hallo Max ich habe letzte Woche Deutsch gelernt und einen Film gesehen. Naechste Woche moechte ich mehr sprechen und neue Woerter wiederholen.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Test for Evaluation' }));

    expect(await screen.findByRole('heading', { name: 'Test Complete!' })).toBeInTheDocument();
    expect(screen.getByText('Completed the reading, grammar, and writing placement sections.')).toBeInTheDocument();
    expect(screen.getByText(/did not return specific improvement areas/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(onTestComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          strengths: expect.any(Array),
          weaknesses: expect.any(Array),
        })
      );
    });
  });
});
