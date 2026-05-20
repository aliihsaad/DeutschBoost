import React, { useState } from 'react';
import {
  generateReadingQuestion,
  generateGrammarQuestion,
  evaluateComprehensivePlacementTest,
} from '../services/geminiService';
import { CEFRLevel, TestResult } from '../types';
import LoadingSpinner from '../src/components/LoadingSpinner';
import {
  Badge,
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
  ProgressBar,
  cn,
} from '../components/ui';
import toast from 'react-hot-toast';
import type { AiProvider } from '../src/domain/ai/aiProvider';
import { normalizeTestResult } from '../src/domain/learning/aiResultNormalization';

interface EnhancedPlacementTestPageProps {
  onTestComplete: (result: TestResult) => void | Promise<void>;
  aiProvider?: AiProvider;
}

type TestSection = 'Intro' | 'Reading' | 'Grammar' | 'Writing' | 'Evaluating' | 'Complete';

interface Question {
  text?: string;
  sentence?: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

const SECTION_CARDS = [
  { key: 'Reading', label: 'Reading Comprehension', description: 'Five questions testing your understanding of short German texts.' },
  { key: 'Grammar', label: 'Grammar', description: 'Five questions covering essential German grammar structures.' },
  { key: 'Writing', label: 'Writing', description: 'Write a short free-form text so the AI examiner can assess production.' },
] as const;

const EnhancedPlacementTestPage: React.FC<EnhancedPlacementTestPageProps> = ({
  onTestComplete,
  aiProvider,
}) => {
  const [section, setSection] = useState<TestSection>('Intro');
  const [loading, setLoading] = useState(false);

  // Reading section state
  const [readingQuestions, setReadingQuestions] = useState<Question[]>([]);
  const [currentReadingIndex, setCurrentReadingIndex] = useState(0);
  const [readingAnswers, setReadingAnswers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [readingScore, setReadingScore] = useState(0);

  // Grammar section state
  const [grammarQuestions, setGrammarQuestions] = useState<Question[]>([]);
  const [currentGrammarIndex, setCurrentGrammarIndex] = useState(0);
  const [grammarAnswers, setGrammarAnswers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [grammarScore, setGrammarScore] = useState(0);

  // Writing section state
  const [writingPrompt] = useState(
    "Schreiben Sie eine E-Mail (ca. 80 Wörter) an einen Freund. Erzählen Sie: Was haben Sie letzte Woche gemacht? Was planen Sie für nächste Woche?"
  );
  const [userWriting, setUserWriting] = useState("");

  // Final results
  const [evaluationResult, setEvaluationResult] = useState<TestResult | null>(null);

  const startTest = async () => {
    setLoading(true);
    try {
      const questions: Question[] = [];
      let level = CEFRLevel.A2;

      for (let i = 0; i < 5; i++) {
        const response = await generateReadingQuestion(level, aiProvider);
        const data = JSON.parse(response.text);
        questions.push(data);

        if (i === 1) level = CEFRLevel.A2;
        if (i === 2) level = CEFRLevel.B1;
        if (i === 3) level = CEFRLevel.B1;
        if (i === 4) level = CEFRLevel.B2;
      }

      setReadingQuestions(questions);
      setSection('Reading');
    } catch (error) {
      console.error("Error generating reading questions:", error);
      toast.error("Could not start the test. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReadingSubmit = () => {
    const currentQuestion = readingQuestions[currentReadingIndex];
    const userAnswer = readingAnswers[currentReadingIndex];

    if (userAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    if (userAnswer === currentQuestion.correctOptionIndex) {
      setReadingScore(prev => prev + 1);
    }

    if (currentReadingIndex < 4) {
      setCurrentReadingIndex(prev => prev + 1);
    } else {
      startGrammarSection();
    }
  };

  const startGrammarSection = async () => {
    setLoading(true);
    setSection('Grammar');

    try {
      const questions: Question[] = [];
      let level = CEFRLevel.A2;

      for (let i = 0; i < 5; i++) {
        const response = await generateGrammarQuestion(level, aiProvider);
        const data = JSON.parse(response.text);
        questions.push(data);

        if (i === 1) level = CEFRLevel.A2;
        if (i === 2) level = CEFRLevel.B1;
        if (i === 3) level = CEFRLevel.B1;
        if (i === 4) level = CEFRLevel.B2;
      }

      setGrammarQuestions(questions);
    } catch (error) {
      console.error("Error generating grammar questions:", error);
      toast.error("Error loading grammar section");
    } finally {
      setLoading(false);
    }
  };

  const handleGrammarSubmit = () => {
    const currentQuestion = grammarQuestions[currentGrammarIndex];
    const userAnswer = grammarAnswers[currentGrammarIndex];

    if (userAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    if (userAnswer === currentQuestion.correctOptionIndex) {
      setGrammarScore(prev => prev + 1);
    }

    if (currentGrammarIndex < 4) {
      setCurrentGrammarIndex(prev => prev + 1);
    } else {
      setSection('Writing');
    }
  };

  const handleWritingSubmit = async () => {
    if (!userWriting.trim() || userWriting.trim().split(/\s+/).length < 20) {
      toast.error("Please write at least 20 words");
      return;
    }

    setLoading(true);
    setSection('Evaluating');

    try {
      const result = await evaluateComprehensivePlacementTest(
        readingScore,
        grammarScore,
        userWriting,
        writingPrompt,
        aiProvider
      );
      const safeResult = normalizeTestResult(result);

      setEvaluationResult(safeResult);
      await onTestComplete(safeResult);
      setSection('Complete');
    } catch (error) {
      console.error("Error evaluating test:", error);
      toast.error("Could not evaluate your test. Please try again.");
      setSection('Writing');
    } finally {
      setLoading(false);
    }
  };

  const renderIntro = () => {
    const providerReady = Boolean(aiProvider);

    return (
      <>
        <PageHeader
          title="Comprehensive German Placement Test"
          subtitle="Three short sections — reading, grammar, and a free-form writing prompt — calibrate your CEFR level in about 15–20 minutes."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {SECTION_CARDS.map(s => (
            <Card key={s.key} variant="soft" title={s.label}>
              <p className="text-[13px] leading-relaxed text-text-muted">{s.description}</p>
            </Card>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          <Notice tone="info">
            Estimated time: 15–20 minutes. Questions adapt to your level as you answer.
          </Notice>
          {!providerReady ? (
            <Notice tone="error">
              Connect OpenRouter in Settings before starting the placement test.
            </Notice>
          ) : null}
          <div>
            <Button onClick={startTest} disabled={!providerReady || loading}>
              {providerReady ? 'Start Test' : 'Connect OpenRouter first'}
            </Button>
          </div>
        </div>
      </>
    );
  };

  const renderAnswerOption = (
    option: string,
    index: number,
    selectedIndex: number | null,
    onSelect: (i: number) => void,
  ) => (
    <button
      key={index}
      type="button"
      onClick={() => onSelect(index)}
      aria-pressed={selectedIndex === index}
      className={cn(
        'flex w-full items-start gap-2 rounded-control border px-4 py-3 text-left text-[14px] transition-colors',
        selectedIndex === index
          ? 'border-brand bg-brand-soft text-text'
          : 'border-border bg-surface text-text hover:border-brand',
      )}
    >
      <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
      {option}
    </button>
  );

  const renderReading = () => {
    const question = readingQuestions[currentReadingIndex];
    if (!question) return null;
    const selected = readingAnswers[currentReadingIndex];
    const progress = (currentReadingIndex / 5) * 100;

    return (
      <>
        <PageHeader
          title="Reading Comprehension"
          subtitle={`Question ${currentReadingIndex + 1} of 5`}
          actions={<Badge tone="info">Section 1 of 3</Badge>}
        />
        <div className="mb-4">
          <ProgressBar value={progress} label="Reading progress" />
        </div>
        <Card className="mb-4">
          <p className="text-[14px] leading-relaxed text-text">{question.text}</p>
        </Card>
        <Card>
          <p className="mb-4 text-[14px] font-semibold text-text">{question.question}</p>
          <div className="space-y-2">
            {question.options.map((option, index) =>
              renderAnswerOption(option, index, selected, (i) => {
                const next = [...readingAnswers];
                next[currentReadingIndex] = i;
                setReadingAnswers(next);
              }),
            )}
          </div>
          <div className="mt-6">
            <Button onClick={handleReadingSubmit} disabled={selected === null}>
              {currentReadingIndex < 4 ? 'Next Question' : 'Continue to Grammar'}
            </Button>
          </div>
        </Card>
      </>
    );
  };

  const renderGrammar = () => {
    const question = grammarQuestions[currentGrammarIndex];
    if (!question) return <LoadingSpinner text="Loading grammar section..." />;
    const selected = grammarAnswers[currentGrammarIndex];
    const progress = (currentGrammarIndex / 5) * 100;

    return (
      <>
        <PageHeader
          title="✏️ Grammar"
          subtitle={`Question ${currentGrammarIndex + 1} of 5`}
          actions={<Badge tone="info">Section 2 of 3</Badge>}
        />
        <div className="mb-4">
          <ProgressBar value={progress} label="Grammar progress" />
        </div>
        <Card className="mb-4">
          <p className="font-mono text-[16px] text-text">{question.sentence}</p>
        </Card>
        <Card>
          <p className="mb-4 text-[14px] font-semibold text-text">{question.question}</p>
          <div className="space-y-2">
            {question.options.map((option, index) =>
              renderAnswerOption(option, index, selected, (i) => {
                const next = [...grammarAnswers];
                next[currentGrammarIndex] = i;
                setGrammarAnswers(next);
              }),
            )}
          </div>
          <div className="mt-6">
            <Button onClick={handleGrammarSubmit} disabled={selected === null}>
              {currentGrammarIndex < 4 ? 'Next Question' : 'Continue to Writing'}
            </Button>
          </div>
        </Card>
      </>
    );
  };

  const renderWriting = () => (
    <>
      <PageHeader
        title="Writing"
        subtitle="The final section. Write naturally and do your best."
        actions={<Badge tone="info">Section 3 of 3</Badge>}
      />
      <Card>
        <p className="mb-4 text-[14px] font-semibold text-text">{writingPrompt}</p>
        <Field label="Your e-mail" htmlFor="placement-writing">
          <textarea
            id="placement-writing"
            value={userWriting}
            onChange={(e) => setUserWriting(e.target.value)}
            className="h-64 w-full rounded-control border border-border bg-surface p-3 text-[14px] text-text focus:border-brand focus:outline-none"
            placeholder="Schreiben Sie hier Ihre E-Mail..."
          />
        </Field>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12px] text-text-muted">
            Words: {userWriting.trim() ? userWriting.trim().split(/\s+/).length : 0}
          </span>
          <Button onClick={handleWritingSubmit}>Submit Test for Evaluation</Button>
        </div>
      </Card>
    </>
  );

  const renderEvaluating = () => (
    <Card className="text-center">
      <h2 className="mb-2 text-[20px] font-semibold text-text">Evaluating your test…</h2>
      <p className="mb-6 text-[14px] text-text-muted">
        The AI examiner is analyzing your responses across all three sections.
      </p>
      <LoadingSpinner size="lg" text="This may take 30–60 seconds…" />
    </Card>
  );

  const renderComplete = () => {
    if (!evaluationResult) return null;

    return (
      <>
        <PageHeader
          title="Test Complete!"
          subtitle="Based on your comprehensive assessment, here is your CEFR level and a path forward."
        />
        <Card className="text-center">
          <p className="text-[12px] font-medium uppercase tracking-wide text-text-muted">Your CEFR level</p>
          <p className="mt-2 text-[48px] font-bold text-brand-strong">{evaluationResult.level}</p>
        </Card>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card title="Strengths">
            <ul className="space-y-2 text-[14px] text-text">
              {evaluationResult.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-success">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Areas to improve">
            <ul className="space-y-2 text-[14px] text-text">
              {evaluationResult.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand-strong">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card className="mt-4" title="Your path forward">
          <p className="text-[14px] leading-relaxed text-text">{evaluationResult.recommendations}</p>
        </Card>
        <p className="mt-4 text-[14px] text-text-muted">
          A personalized learning plan will be generated based on these results.
        </p>
      </>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      {loading && section !== 'Evaluating' && section !== 'Grammar' && <LoadingSpinner />}
      {!loading && section === 'Intro' && renderIntro()}
      {!loading && section === 'Reading' && renderReading()}
      {section === 'Grammar' && renderGrammar()}
      {!loading && section === 'Writing' && renderWriting()}
      {section === 'Evaluating' && renderEvaluating()}
      {!loading && section === 'Complete' && renderComplete()}
    </div>
  );
};

export default EnhancedPlacementTestPage;
