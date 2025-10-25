import React, { useState, useEffect } from 'react';
import { generatePlacementTest, evaluateWriting } from '../services/geminiService';
import { CEFRLevel, TestResult } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Card from '../components/Card';

interface PlacementTestPageProps {
  onTestComplete: (result: TestResult) => void;
}

type TestSection = 'Intro' | 'Reading' | 'Writing' | 'Evaluating' | 'Complete';

interface ReadingQuestion {
  text: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

const PlacementTestPage: React.FC<PlacementTestPageProps> = ({ onTestComplete }) => {
  const [section, setSection] = useState<TestSection>('Intro');
  const [loading, setLoading] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState<ReadingQuestion | null>(null);
  const [userReadingAnswer, setUserReadingAnswer] = useState<number | null>(null);
  const [isReadingCorrect, setIsReadingCorrect] = useState<boolean | null>(null);
  const [writingPrompt] = useState("Schreiben Sie eine kurze E-Mail (ca. 40 Wörter) an einen Freund. Erzählen Sie ihm von Ihrem letzten Wochenende.");
  const [userWriting, setUserWriting] = useState("");
  const [evaluationResult, setEvaluationResult] = useState<TestResult | null>(null);

  const startTest = async () => {
    setLoading(true);
    try {
      const response = await generatePlacementTest(CEFRLevel.A2);
      const data = JSON.parse(response.text);
      setReadingQuestion(data);
      setSection('Reading');
    } catch (error) {
      console.error("Error generating reading question:", error);
      alert("Could not start the test. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReadingSubmit = () => {
    if (userReadingAnswer === null || !readingQuestion) return;
    const isCorrect = userReadingAnswer === readingQuestion.correctOptionIndex;
    setIsReadingCorrect(isCorrect);
    setTimeout(() => {
        setSection('Writing');
    }, 2000);
  };

  const handleWritingSubmit = async () => {
    if (!userWriting.trim()) {
      alert("Please write something before submitting.");
      return;
    }
    setLoading(true);
    setSection('Evaluating');
    try {
      const result = await evaluateWriting(writingPrompt, userWriting);
      setEvaluationResult(result);
      onTestComplete(result);
      setSection('Complete');
    } catch (error) {
      console.error("Error evaluating writing:", error);
      alert("Could not evaluate your writing. Please try again.");
      setSection('Writing');
    } finally {
      setLoading(false);
    }
  };

  const renderIntro = () => (
    <Card className="text-center">
      <h1 className="text-3xl font-bold mb-4 dark:text-gray-100">German Placement Test</h1>
      <p className="text-gray-700 dark:text-gray-300 mb-8">Let's find out your German level. This test has two parts: Reading and Writing.</p>
      <button onClick={startTest} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-lg">
        Start Test
      </button>
    </Card>
  );

  const renderReading = () => readingQuestion && (
    <Card>
      <h2 className="text-2xl font-bold mb-2 dark:text-gray-100">Teil 1: Lesen (Reading)</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">Lesen Sie den Text und wählen Sie die richtige Antwort.</p>
      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-6">
        <p className="italic dark:text-gray-200">{readingQuestion.text}</p>
      </div>
      <p className="font-semibold mb-4 dark:text-gray-100">{readingQuestion.question}</p>
      <div className="space-y-3">
        {readingQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => setUserReadingAnswer(index)}
            disabled={isReadingCorrect !== null}
            className={`block w-full text-left p-4 rounded-lg border-2 transition dark:text-gray-100 ${
              userReadingAnswer === index
                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${isReadingCorrect !== null && index === readingQuestion.correctOptionIndex ? '!bg-green-200 dark:!bg-green-900/40 !border-green-500' : ''}
               ${isReadingCorrect !== null && userReadingAnswer === index && userReadingAnswer !== readingQuestion.correctOptionIndex ? '!bg-red-200 dark:!bg-red-900/40 !border-red-500' : ''}`}
          >
            {option}
          </button>
        ))}
      </div>
      {isReadingCorrect !== null && (
        <div className={`mt-4 p-3 rounded-lg text-center font-semibold ${isReadingCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
            {isReadingCorrect ? "Correct! Moving to the next section..." : "That's not quite right. Moving on..."}
        </div>
      )}
      <button onClick={handleReadingSubmit} disabled={userReadingAnswer === null || isReadingCorrect !== null} className="mt-6 bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400">
        Submit Answer
      </button>
    </Card>
  );
  
  const renderWriting = () => (
    <Card>
        <h2 className="text-2xl font-bold mb-2 dark:text-gray-100">Teil 2: Schreiben (Writing)</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Lesen Sie die Aufgabe und schreiben Sie Ihren Text.</p>
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-6">
            <p className="font-semibold dark:text-gray-100">{writingPrompt}</p>
        </div>
        <textarea
            value={userWriting}
            onChange={(e) => setUserWriting(e.target.value)}
            className="w-full h-48 p-4 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            placeholder="Schreiben Sie hier Ihre E-Mail..."
        />
        <button onClick={handleWritingSubmit} className="mt-6 bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
            Submit Writing for Evaluation
        </button>
    </Card>
  )

  const renderEvaluating = () => (
    <Card className="text-center">
        <h2 className="text-3xl font-bold mb-4 dark:text-gray-100">Evaluating your work...</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-8">Our AI examiner is analyzing your writing. This may take a moment.</p>
        <LoadingSpinner text="Analyzing..." />
    </Card>
  );

  const renderComplete = () => evaluationResult && (
      <Card className="text-center">
          <i className="fa-solid fa-check-circle text-6xl text-green-500 mb-4"></i>
          <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Test Complete!</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">We've assessed your level based on your writing.</p>
          <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-6 inline-block">
              <p className="text-lg text-blue-800 dark:text-blue-300">Your estimated CEFR Level is:</p>
              <p className="text-7xl font-bold text-blue-600 dark:text-blue-400">{evaluationResult.level}</p>
          </div>
          <div className="mt-6 text-left max-w-md mx-auto space-y-4">
              <div>
                  <h3 className="font-bold text-lg dark:text-gray-100">Strengths:</h3>
                  <ul className="list-disc list-inside text-gray-800 dark:text-gray-200">
                      {evaluationResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
              </div>
               <div>
                  <h3 className="font-bold text-lg dark:text-gray-100">Areas for Improvement:</h3>
                  <ul className="list-disc list-inside text-gray-800 dark:text-gray-200">
                      {evaluationResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
              </div>
          </div>
           <p className="mt-8 text-gray-600 dark:text-gray-300">You will now get a personalized learning plan based on these results.</p>
      </Card>
  );

  return (
    <div className="container mx-auto p-8 flex justify-center items-start">
      <div className="w-full max-w-3xl">
        {loading && section !== 'Evaluating' && <LoadingSpinner />}
        {!loading && section === 'Intro' && renderIntro()}
        {!loading && section === 'Reading' && renderReading()}
        {!loading && section === 'Writing' && renderWriting()}
        {section === 'Evaluating' && renderEvaluating()}
        {!loading && section === 'Complete' && renderComplete()}
      </div>
    </div>
  );
};

export default PlacementTestPage;