import React, { useState } from 'react';
import { generateReadingQuestion, generateGrammarQuestion, evaluateComprehensivePlacementTest } from '../services/geminiService';
import { CEFRLevel, TestResult } from '../types';
import LoadingSpinner from '../src/components/LoadingSpinner';
import Card from '../components/Card';
import { useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';
import toast from 'react-hot-toast';

interface EnhancedPlacementTestPageProps {
  onTestComplete: (result: TestResult) => void;
}

type TestSection = 'Intro' | 'Reading' | 'Grammar' | 'Writing' | 'Evaluating' | 'Complete';

interface Question {
  text?: string;
  sentence?: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

const EnhancedPlacementTestPage: React.FC<EnhancedPlacementTestPageProps> = ({ onTestComplete }) => {
  const { user, updateProfile } = useAuth();
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

  // Adaptive difficulty
  const [currentLevel, setCurrentLevel] = useState<CEFRLevel>(CEFRLevel.A2);

  // Final results
  const [evaluationResult, setEvaluationResult] = useState<TestResult | null>(null);

  // Start test - generate first 5 reading questions
  const startTest = async () => {
    setLoading(true);
    try {
      const questions: Question[] = [];
      let level = CEFRLevel.A2; // Start at A2

      for (let i = 0; i < 5; i++) {
        const response = await generateReadingQuestion(level);
        const data = JSON.parse(response.text);
        questions.push(data);

        // Adaptive: if we're generating future questions, adjust level
        // (This is a simplified version - in practice you'd adjust after each answer)
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

  // Submit reading answer and move to next
  const handleReadingSubmit = () => {
    const currentQuestion = readingQuestions[currentReadingIndex];
    const userAnswer = readingAnswers[currentReadingIndex];

    if (userAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    // Check if correct
    const isCorrect = userAnswer === currentQuestion.correctOptionIndex;
    if (isCorrect) {
      setReadingScore(prev => prev + 1);
    }

    // Move to next question or next section
    if (currentReadingIndex < 4) {
      setCurrentReadingIndex(prev => prev + 1);
    } else {
      // Reading complete, move to grammar
      startGrammarSection();
    }
  };

  // Start grammar section
  const startGrammarSection = async () => {
    setLoading(true);
    setSection('Grammar');

    try {
      const questions: Question[] = [];
      let level = CEFRLevel.A2;

      for (let i = 0; i < 5; i++) {
        const response = await generateGrammarQuestion(level);
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

  // Submit grammar answer and move to next
  const handleGrammarSubmit = () => {
    const currentQuestion = grammarQuestions[currentGrammarIndex];
    const userAnswer = grammarAnswers[currentGrammarIndex];

    if (userAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    const isCorrect = userAnswer === currentQuestion.correctOptionIndex;
    if (isCorrect) {
      setGrammarScore(prev => prev + 1);
    }

    if (currentGrammarIndex < 4) {
      setCurrentGrammarIndex(prev => prev + 1);
    } else {
      // Grammar complete, move to writing
      setSection('Writing');
    }
  };

  // Submit writing and evaluate entire test
  const handleWritingSubmit = async () => {
    if (!userWriting.trim() || userWriting.trim().split(/\s+/).length < 20) {
      toast.error("Please write at least 20 words");
      return;
    }

    setLoading(true);
    setSection('Evaluating');

    try {
      // Evaluate comprehensive test
      const result = await evaluateComprehensivePlacementTest(
        readingScore,
        grammarScore,
        userWriting,
        writingPrompt
      );

      setEvaluationResult(result);

      // Save to database
      if (user) {
        await saveTestResults(result);
      }

      onTestComplete(result);
      setSection('Complete');
    } catch (error) {
      console.error("Error evaluating test:", error);
      toast.error("Could not evaluate your test. Please try again.");
      setSection('Writing');
    } finally {
      setLoading(false);
    }
  };

  // Save test results to database
  const saveTestResults = async (result: TestResult) => {
    if (!user) return;

    try {
      // Save to test_results table
      const { error: testError } = await supabase
        .from('test_results')
        .insert({
          user_id: user.id,
          test_type: 'placement',
          level: result.level,
          sections: {
            reading: readingScore,
            grammar: grammarScore,
            writing: 'evaluated'
          },
          overall_score: Math.round(((readingScore + grammarScore) / 10) * 100),
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          recommendations: result.recommendations,
        });

      if (testError) throw testError;

      // Update user profile with current level
      const { error: profileError } = await updateProfile({
        current_level: result.level as CEFRLevel,
      });

      if (profileError) throw profileError;

      toast.success("Test results saved!");
    } catch (error) {
      console.error("Error saving test results:", error);
      toast.error("Could not save results, but you can still continue.");
    }
  };

  // Render functions
  const renderIntro = () => (
    <Card className="text-center">
      <div className="mb-6">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <i className="fa-solid fa-clipboard-check text-white text-4xl"></i>
        </div>
        <h1 className="text-4xl font-bold mb-4">Comprehensive German Placement Test</h1>
        <p className="text-gray-700 text-lg mb-4">
          This test has three sections to accurately assess your German level:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
          <div className="text-4xl mb-2">📖</div>
          <h3 className="font-bold text-lg mb-2">Reading Comprehension</h3>
          <p className="text-sm text-gray-600">5 questions testing your understanding of German texts</p>
        </div>
        <div className="bg-green-50 p-6 rounded-xl border-2 border-green-200">
          <div className="text-4xl mb-2">✏️</div>
          <h3 className="font-bold text-lg mb-2">Grammar</h3>
          <p className="text-sm text-gray-600">5 questions covering essential German grammar</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
          <div className="text-4xl mb-2">✍️</div>
          <h3 className="font-bold text-lg mb-2">Writing</h3>
          <p className="text-sm text-gray-600">Write a short text to demonstrate your skills</p>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 mb-6">
        <p className="text-sm text-gray-700">
          <i className="fa-solid fa-clock mr-2"></i>
          <strong>Estimated time:</strong> 15-20 minutes • <strong>Questions adapt</strong> to your level as you answer
        </p>
      </div>

      <button
        onClick={startTest}
        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-12 py-4 rounded-xl font-bold text-xl hover:shadow-lg transition"
      >
        Start Test
      </button>
    </Card>
  );

  const renderReading = () => {
    const question = readingQuestions[currentReadingIndex];
    if (!question) return null;

    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">📖 Reading Comprehension</h2>
          <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
            Question {currentReadingIndex + 1} of 5
          </span>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl mb-6 border-2 border-blue-200">
          <p className="text-lg leading-relaxed italic">{question.text}</p>
        </div>

        <p className="font-bold text-lg mb-4">{question.question}</p>

        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                const newAnswers = [...readingAnswers];
                newAnswers[currentReadingIndex] = index;
                setReadingAnswers(newAnswers);
              }}
              className={`block w-full text-left p-4 rounded-xl border-2 transition ${
                readingAnswers[currentReadingIndex] === index
                  ? 'border-blue-500 bg-blue-100'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        <button
          onClick={handleReadingSubmit}
          disabled={readingAnswers[currentReadingIndex] === null}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {currentReadingIndex < 4 ? 'Next Question' : 'Continue to Grammar'}
        </button>
      </Card>
    );
  };

  const renderGrammar = () => {
    const question = grammarQuestions[currentGrammarIndex];
    if (!question) return <LoadingSpinner text="Loading grammar section..." />;

    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">✏️ Grammar</h2>
          <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
            Question {currentGrammarIndex + 1} of 5
          </span>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl mb-6 border-2 border-green-200">
          <p className="text-xl font-mono">{question.sentence}</p>
        </div>

        <p className="font-semibold text-lg mb-4">{question.question}</p>

        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                const newAnswers = [...grammarAnswers];
                newAnswers[currentGrammarIndex] = index;
                setGrammarAnswers(newAnswers);
              }}
              className={`block w-full text-left p-4 rounded-xl border-2 transition ${
                grammarAnswers[currentGrammarIndex] === index
                  ? 'border-green-500 bg-green-100'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        <button
          onClick={handleGrammarSubmit}
          disabled={grammarAnswers[currentGrammarIndex] === null}
          className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {currentGrammarIndex < 4 ? 'Next Question' : 'Continue to Writing'}
        </button>
      </Card>
    );
  };

  const renderWriting = () => (
    <Card>
      <h2 className="text-2xl font-bold mb-4">✍️ Writing</h2>
      <p className="text-gray-600 mb-6">This is the final section. Write naturally and do your best!</p>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl mb-6 border-2 border-purple-200">
        <p className="font-semibold text-lg">{writingPrompt}</p>
      </div>

      <textarea
        value={userWriting}
        onChange={(e) => setUserWriting(e.target.value)}
        className="w-full h-64 p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
        placeholder="Schreiben Sie hier Ihre E-Mail..."
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          Words: {userWriting.trim() ? userWriting.trim().split(/\s+/).length : 0}
        </span>
        <button
          onClick={handleWritingSubmit}
          className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 transition"
        >
          Submit Test for Evaluation
        </button>
      </div>
    </Card>
  );

  const renderEvaluating = () => (
    <Card className="text-center">
      <div className="mb-6">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg animate-pulse">
          <i className="fa-solid fa-brain text-white text-4xl"></i>
        </div>
        <h2 className="text-3xl font-bold mb-4">Evaluating Your Test...</h2>
        <p className="text-gray-700 text-lg mb-8">
          Our AI examiner is analyzing your responses across all three sections.
        </p>
      </div>
      <LoadingSpinner size="lg" text="This may take 30-60 seconds..." />
    </Card>
  );

  const renderComplete = () => {
    if (!evaluationResult) return null;

    return (
      <Card className="text-center">
        <div className="mb-6">
          <i className="fa-solid fa-trophy text-yellow-500 text-7xl mb-4"></i>
          <h1 className="text-4xl font-bold mb-2">Test Complete!</h1>
          <p className="text-gray-700 text-lg">Based on your comprehensive assessment:</p>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl p-8 inline-block mb-8 shadow-xl">
          <p className="text-xl mb-2">Your CEFR Level</p>
          <p className="text-8xl font-bold">{evaluationResult.level}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left mb-8">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="font-bold text-xl mb-4 text-green-800">
              <i className="fa-solid fa-check-circle mr-2"></i>
              Strengths
            </h3>
            <ul className="space-y-2">
              {evaluationResult.strengths.map((s, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-600 mr-2">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
            <h3 className="font-bold text-xl mb-4 text-orange-800">
              <i className="fa-solid fa-lightbulb mr-2"></i>
              Areas to Improve
            </h3>
            <ul className="space-y-2">
              {evaluationResult.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-orange-600 mr-2">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 max-w-3xl mx-auto mb-8">
          <h3 className="font-bold text-xl mb-3 text-blue-800">
            <i className="fa-solid fa-route mr-2"></i>
            Your Path Forward
          </h3>
          <p className="text-gray-700 leading-relaxed">{evaluationResult.recommendations}</p>
        </div>

        <p className="text-gray-600 text-lg">
          A personalized learning plan will be generated based on these results!
        </p>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-8 flex justify-center items-start">
      <div className="w-full max-w-4xl">
        {loading && section !== 'Evaluating' && section !== 'Grammar' && <LoadingSpinner />}
        {!loading && section === 'Intro' && renderIntro()}
        {!loading && section === 'Reading' && renderReading()}
        {section === 'Grammar' && renderGrammar()}
        {!loading && section === 'Writing' && renderWriting()}
        {section === 'Evaluating' && renderEvaluating()}
        {!loading && section === 'Complete' && renderComplete()}
      </div>
    </div>
  );
};

export default EnhancedPlacementTestPage;
