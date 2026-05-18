import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { generateActivity, evaluateWriting } from '../services/activityService';
import { speakText } from '../services/geminiService';
import { CEFRLevel } from '../types';
import { ActivityType, GrammarActivity, VocabularyActivity, ListeningActivity, WritingActivity, SpeakingActivity, ReadingActivity } from '../src/types/activity.types';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import type { AiProvider } from '../src/domain/ai/aiProvider';
import type { SpeechProvider } from '../src/domain/speech/speechProvider';
import {
  MOTHER_LANGUAGE_OPTIONS,
} from '../src/domain/profile/profileRepository';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';

interface ActivityPageProps {
  aiProvider?: AiProvider;
  speechProvider?: SpeechProvider;
  providerRuntimeReady?: boolean;
}

const ActivityPage: React.FC<ActivityPageProps> = ({
  aiProvider,
  speechProvider,
  providerRuntimeReady = true,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const learnerId = 'local-learner';

  // Get params from URL
  const activityType = searchParams.get('type') as ActivityType;
  const topic = searchParams.get('topic') || '';
  const description = searchParams.get('description') || '';
  const level = searchParams.get('level') as CEFRLevel || CEFRLevel.A2;
  const itemId = searchParams.get('itemId');

  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [userText, setUserText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [startTime] = useState(Date.now());
  const [motherLanguage, setMotherLanguage] = useState('English');

  // Vocabulary state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  // Listening state
  const [audioLoading, setAudioLoading] = useState<boolean[]>([]);
  const [audioPlayed, setAudioPlayed] = useState<boolean[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileLanguage() {
      try {
        const profile = await browserProfileRepository.loadProfile();
        const option = MOTHER_LANGUAGE_OPTIONS.find(
          candidate => candidate.value === profile.motherLanguage
        );

        if (!cancelled) {
          setMotherLanguage(option?.label ?? 'English');
        }
      } catch (error) {
        console.error('Error loading local profile language:', error);
      }
    }

    loadProfileLanguage();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerRuntimeReady) {
      return;
    }

    if (!activityType || !topic) {
      toast.error('Invalid activity parameters');
      navigate('/learning-plan');
      return;
    }

    loadActivity();
  }, [activityType, topic, description, level, aiProvider, motherLanguage, providerRuntimeReady]);

  const loadActivity = async () => {
    setLoading(true);
    setCompletionStatus('idle');
    try {
      const generatedActivity = await generateActivity(
        activityType,
        topic,
        description,
        level,
        motherLanguage,
        aiProvider
      );
      setActivity(generatedActivity);

      // Initialize answers array for question-based activities
      if (activityType === 'grammar' || activityType === 'listening' || activityType === 'reading') {
        const questionCount = (generatedActivity as any).questions.length;
        setUserAnswers(new Array(questionCount).fill(-1));

        // Initialize audio state for listening activities
        if (activityType === 'listening') {
          setAudioLoading(new Array(questionCount).fill(false));
          setAudioPlayed(new Array(questionCount).fill(false));
        }
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < activity.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Calculate score and show results
      calculateScore();
    }
  };

  const calculateScore = () => {
    const questions = activity.questions;
    let correct = 0;
    userAnswers.forEach((answer, index) => {
      if (answer === questions[index].correct_option) {
        correct++;
      }
    });
    const percentage = Math.round((correct / questions.length) * 100);
    setScore(percentage);
    setShowResults(true);

    // Auto-mark as complete if score >= 70%
    if (percentage >= 70) {
      markActivityComplete(percentage);
    }
  };

  const handleSubmitWriting = async () => {
    if (!userText.trim()) {
      toast.error('Please write something first');
      return;
    }

    setLoading(true);
    try {
      const result = await evaluateWriting(
        userText,
        activity.prompt,
        level,
        activity.evaluation_criteria,
        motherLanguage,
        aiProvider
      );
      setEvaluation(result);
      setScore(result.score);
      setShowResults(true);

      // Auto-mark as complete if score >= 70%
      if (result.score >= 70) {
        markActivityComplete(result.score);
      }
    } catch (error) {
      console.error('Error evaluating writing:', error);
      toast.error('Failed to evaluate your writing');
    } finally {
      setLoading(false);
    }
  };

  const markActivityComplete = async (finalScore: number) => {
    setScore(finalScore);

    if (!itemId) {
      setCompletionStatus('saved');
      return;
    }

    if (completionStatus === 'saving' || completionStatus === 'saved') {
      return;
    }

    setCompletionStatus('saving');

    const loadingToast = toast.loading('Saving your progress...');

    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);

      // Import the services
      const { updatePlanItemCompletion, updateUserProgress } = await import('../services/learningPlanService');

      // Mark the learning plan item as complete
      const { error: completionError } = await updatePlanItemCompletion(
        learnerId,
        itemId,
        true
      );

      if (completionError) {
        console.error('Error marking item complete:', completionError);
        toast.dismiss(loadingToast);
        toast.error('Failed to mark activity complete. Please try again.');
        setCompletionStatus('error');
        return;
      }

      // Update user progress (study time, streak, session tracking)
      const activityTypeMap: Record<string, 'conversation' | 'flashcards' | 'grammar' | 'listening' | 'reading' | 'writing'> = {
        'grammar': 'grammar',
        'vocabulary': 'flashcards',
        'listening': 'listening',
        'reading': 'reading',
        'writing': 'writing',
      };

      const progressActivityType = activityTypeMap[activityType] || 'grammar';
      const { error: progressError, profile } = await updateUserProgress(
        learnerId,
        progressActivityType,
        timeSpent,
        1
      );

      if (progressError) {
        console.error('Error updating user progress:', progressError);
        // Don't fail the whole operation if progress tracking fails
      } else if (profile) {
        console.log('✅ User progress updated:', profile);
      }

      toast.dismiss(loadingToast);
      setCompletionStatus('saved');
      toast.success(`Activity completed! Score: ${finalScore}%`);
    } catch (error) {
      console.error('Error marking activity complete:', error);
      toast.dismiss(loadingToast);
      setCompletionStatus('error');
      toast.error('An error occurred. Please try again.');
    }
  };

  const handleContinueAfterResult = () => {
    if (score < 70) {
      navigate('/practice');
      return;
    }

    navigate(itemId ? '/learning-plan' : '/practice');
  };

  const renderResultFooter = () => {
    const passed = score >= 70;
    const label = passed ? (itemId ? 'Continue to Plan' : 'Back to Practice') : 'Practice More';

    return (
      <div className="space-y-3">
        {itemId && passed && (
          <div className={`p-4 rounded-lg border ${
            completionStatus === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            {completionStatus === 'saving' && 'Saving this plan task locally...'}
            {completionStatus === 'saved' && 'Plan task saved. Review the feedback, then continue when you are ready.'}
            {completionStatus === 'error' && 'The score was good, but saving the plan task failed. Try again before leaving.'}
            {completionStatus === 'idle' && 'This score is high enough to complete the plan task.'}
          </div>
        )}
        {!passed && (
          <div className="p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-700">
            This score stays below the pass target. Practice this area again before marking the task complete.
          </div>
        )}
        <button
          onClick={handleContinueAfterResult}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
        >
          {label}
        </button>
      </div>
    );
  };

  const renderGrammarActivity = () => {
    if (!activity || !activity.questions) return null;

    const question = activity.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === activity.questions.length - 1;

    if (showResults) {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className={`text-8xl font-bold mb-4 ${score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
              {score}%
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {score >= 90 ? 'Excellent!' : score >= 70 ? 'Good Job!' : 'Keep Practicing!'}
            </h2>
            <p className="text-gray-600 text-lg">
              You got {userAnswers.filter((a, i) => a === activity.questions[i].correct_option).length} out of {activity.questions.length} correct
            </p>
          </div>

          {/* Review answers */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-4">Review Your Answers</h3>
            {activity.questions.map((q: any, index: number) => (
              <Card key={index} className={userAnswers[index] === q.correct_option ? 'border-2 border-green-500' : 'border-2 border-red-500'}>
                <p className="font-bold text-lg mb-3">{q.sentence}</p>
                <p className="text-sm text-gray-600 mb-2">Your answer: <span className={userAnswers[index] === q.correct_option ? 'text-green-600' : 'text-red-600'}>{q.options[userAnswers[index]]}</span></p>
                {userAnswers[index] !== q.correct_option && (
                  <p className="text-sm text-green-600 mb-2">Correct answer: {q.options[q.correct_option]}</p>
                )}
                <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg mt-2">💡 {q.explanation}</p>
              </Card>
            ))}
          </div>

          {renderResultFooter()}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Question {currentQuestionIndex + 1} of {activity.questions.length}</h2>
          <div className="text-sm text-gray-600">
            Progress: {Math.round(((currentQuestionIndex + 1) / activity.questions.length) * 100)}%
          </div>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <p className="text-2xl font-bold text-gray-800">{question.sentence}</p>
        </Card>

        <div className="space-y-3">
          {question.options.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={`w-full p-5 rounded-xl text-left font-medium text-lg transition-all duration-300 ${
                userAnswers[currentQuestionIndex] === index
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        <button
          onClick={handleNextQuestion}
          disabled={userAnswers[currentQuestionIndex] === -1}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </button>
      </div>
    );
  };

  const playGermanAudio = async (text: string, feature: string): Promise<void> => {
    const normalizedText = text.trim();

    if (!normalizedText) {
      return;
    }

    if (speechProvider) {
      const result = await speechProvider.synthesize({
        feature,
        text: normalizedText,
        options: { language: 'de' },
      });
      const playbackUrl = URL.createObjectURL(new Blob([result.audio], { type: result.mimeType }));

      try {
        await playAudioUrl(playbackUrl);
      } finally {
        releaseObjectUrl(playbackUrl);
      }
      return;
    }

    await speakText(normalizedText, 'de-DE');
  };

  const speakGermanWord = (text: string, feature: string) => {
    void playGermanAudio(text, feature).catch(error => {
      console.error('Error playing German audio:', error);
      toast.error('Failed to play German audio');
    });
  };

  const renderVocabularyActivity = () => {
    if (!activity || !activity.cards) return null;

    const card = activity.cards[currentCardIndex];
    const isLastCard = currentCardIndex === activity.cards.length - 1;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Card {currentCardIndex + 1} of {activity.cards.length}</h2>
          <div className="text-sm text-gray-600">
            Progress: {Math.round(((currentCardIndex + 1) / activity.cards.length) * 100)}%
          </div>
        </div>

        <div className="relative">
          <Card className="min-h-96 flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => {
                  const newShowAnswer = !showAnswer;
                  setShowAnswer(newShowAnswer);
                  // Mark card as flipped when user views the answer
                  if (newShowAnswer) {
                    setFlippedCards(prev => new Set(prev).add(currentCardIndex));
                  }
                }}>
            <div className="text-center">
              {!showAnswer ? (
                <>
                  <div className="text-6xl font-bold text-blue-600 mb-4">{card.german}</div>
                  <p className="text-gray-500 text-lg">Click to reveal</p>
                </>
              ) : (
                <>
                  <div className="text-4xl font-bold text-gray-800 mb-4">{card.german}</div>
                  <div className="text-3xl text-green-600 mb-6">{card.translation}</div>
                  <div className="bg-blue-50 p-4 rounded-lg max-w-md relative">
                    <p className="text-lg text-gray-700 italic">"{card.example_sentence}"</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        speakGermanWord(card.example_sentence, 'vocabulary-example');
                      }}
                      className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-full shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                      title="Listen to example sentence"
                    >
                      <i className="fa-solid fa-volume-up text-sm"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Pronunciation Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              speakGermanWord(card.german, 'vocabulary-pronunciation');
            }}
            className="absolute top-4 right-4 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
            title="Listen to pronunciation"
          >
            <i className="fa-solid fa-volume-up text-xl group-hover:scale-110 transition-transform"></i>
          </button>
        </div>

        <div className="flex space-x-4">
          {currentCardIndex > 0 && (
            <button
              onClick={() => {
                setCurrentCardIndex(currentCardIndex - 1);
                setShowAnswer(false);
              }}
              className="flex-1 bg-gray-200 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-300 transition-all duration-300"
            >
              Previous
            </button>
          )}

          {!isLastCard ? (
            <button
              onClick={() => {
                setCurrentCardIndex(currentCardIndex + 1);
                setShowAnswer(false);
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
            >
              Next Card
            </button>
          ) : (
            completionStatus === 'saved' ? (
              <button
                onClick={handleContinueAfterResult}
                className="flex-1 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
              >
                Continue to Plan
              </button>
            ) : (
              <button
                onClick={() => {
                  if (flippedCards.size === activity.cards.length) {
                    markActivityComplete(100);
                  } else {
                    toast.error(`Please flip all ${activity.cards.length} cards to complete the activity!`);
                  }
                }}
                disabled={flippedCards.size !== activity.cards.length || completionStatus === 'saving'}
                className={`flex-1 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg ${
                  flippedCards.size === activity.cards.length
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {completionStatus === 'saving' ? 'Saving...' : `Complete (${flippedCards.size}/${activity.cards.length} flipped)`}
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  const renderWritingActivity = () => {
    if (!activity) return null;

    if (showResults && evaluation) {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className={`text-8xl font-bold mb-4 ${score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
              {score}%
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {score >= 90 ? 'Excellent Writing!' : score >= 70 ? 'Good Work!' : 'Keep Practicing!'}
            </h2>
          </div>

          <Card className="bg-green-50 border-2 border-green-200">
            <h3 className="text-xl font-bold text-green-800 mb-3">✨ Strengths</h3>
            <ul className="list-disc list-inside space-y-1">
              {evaluation.strengths.map((strength: string, index: number) => (
                <li key={index} className="text-gray-700">{strength}</li>
              ))}
            </ul>
          </Card>

          <Card className="bg-orange-50 border-2 border-orange-200">
            <h3 className="text-xl font-bold text-orange-800 mb-3">📚 Areas for Improvement</h3>
            <ul className="list-disc list-inside space-y-1">
              {evaluation.areas_for_improvement.map((area: string, index: number) => (
                <li key={index} className="text-gray-700">{area}</li>
              ))}
            </ul>
          </Card>

          <Card className="bg-blue-50 border-2 border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-3">💬 Detailed Feedback</h3>
            <p className="text-gray-700 leading-relaxed">{evaluation.detailed_feedback}</p>
          </Card>

          {evaluation.corrected_text && (
            <Card className="bg-purple-50 border-2 border-purple-200">
              <h3 className="text-xl font-bold text-purple-800 mb-3">✏️ Corrected Version</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{evaluation.corrected_text}</p>
            </Card>
          )}

          {renderResultFooter()}
        </div>
      );
    }

    const wordCount = userText.trim().split(/\s+/).filter(w => w).length;

    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <h3 className="text-xl font-bold text-purple-800 mb-3">✍️ Writing Prompt</h3>
          <p className="text-lg text-gray-800 mb-4">{activity.prompt}</p>
          <p className="text-sm text-gray-600">Minimum words: {activity.min_words}</p>
        </Card>

        <Card>
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Schreibe hier auf Deutsch..."
            className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium text-lg"
          />
          <div className="mt-2 text-sm text-gray-600">
            Word count: {wordCount} / {activity.min_words}
          </div>
        </Card>

        <button
          onClick={handleSubmitWriting}
          disabled={wordCount < activity.min_words || loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Evaluating...' : 'Submit for Evaluation'}
        </button>
      </div>
    );
  };

  const handlePlayAudio = async (questionIndex: number, audioText: string) => {
    if (isPlayingAudio) {
      toast.error('Please wait for current audio to finish');
      return;
    }

    console.log('🔊 Playing audio for question', questionIndex, ':', audioText);

    // Update loading state
    const newLoading = [...audioLoading];
    newLoading[questionIndex] = true;
    setAudioLoading(newLoading);
    setIsPlayingAudio(true);

    try {
      await playGermanAudio(audioText, 'listening-practice');

      console.log('✅ Speech completed');

      // Mark as played
      const newPlayed = [...audioPlayed];
      newPlayed[questionIndex] = true;
      setAudioPlayed(newPlayed);
      setIsPlayingAudio(false);
    } catch (error) {
      console.error('❌ Error in handlePlayAudio:', error);
      if (error instanceof Error) {
        toast.error(`Audio error: ${error.message}`);
      } else {
        toast.error('Failed to play audio - check console for details');
      }
      setIsPlayingAudio(false);
    } finally {
      const newLoading = [...audioLoading];
      newLoading[questionIndex] = false;
      setAudioLoading(newLoading);
    }
  };

  const renderListeningActivity = () => {
    if (!activity || !activity.questions) return null;

    const question = activity.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === activity.questions.length - 1;

    if (showResults) {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className={`text-8xl font-bold mb-4 ${score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
              {score}%
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {score >= 90 ? 'Excellent!' : score >= 70 ? 'Good Job!' : 'Keep Practicing!'}
            </h2>
            <p className="text-gray-600 text-lg">
              You got {userAnswers.filter((a, i) => a === activity.questions[i].correct_option).length} out of {activity.questions.length} correct
            </p>
          </div>

          {/* Review answers */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-4">Review Your Answers</h3>
            {activity.questions.map((q: any, index: number) => (
              <Card key={index} className={userAnswers[index] === q.correct_option ? 'border-2 border-green-500' : 'border-2 border-red-500'}>
                <div className="mb-3">
                  <button
                    onClick={() => handlePlayAudio(index, q.audio_text)}
                    disabled={audioLoading[index] || isPlayingAudio}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <i className={`fa-solid ${audioLoading[index] ? 'fa-spinner fa-spin' : 'fa-volume-up'}`}></i>
                    Replay Audio
                  </button>
                </div>
                <p className="font-bold text-lg mb-3">{q.question}</p>
                <p className="text-sm text-gray-600 mb-2">Your answer: <span className={userAnswers[index] === q.correct_option ? 'text-green-600' : 'text-red-600'}>{q.options[userAnswers[index]]}</span></p>
                {userAnswers[index] !== q.correct_option && (
                  <p className="text-sm text-green-600 mb-2">Correct answer: {q.options[q.correct_option]}</p>
                )}
              </Card>
            ))}
          </div>

          {renderResultFooter()}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Question {currentQuestionIndex + 1} of {activity.questions.length}</h2>
          <div className="text-sm text-gray-600">
            Progress: {Math.round(((currentQuestionIndex + 1) / activity.questions.length) * 100)}%
          </div>
        </div>

        {/* Audio Player Card */}
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">
              <i className="fa-solid fa-headphones text-indigo-600"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Listen to the audio</h3>
            <button
              onClick={() => handlePlayAudio(currentQuestionIndex, question.audio_text)}
              disabled={audioLoading[currentQuestionIndex] || isPlayingAudio}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
            >
              <i className={`fa-solid ${audioLoading[currentQuestionIndex] ? 'fa-spinner fa-spin' : isPlayingAudio ? 'fa-circle-pause' : 'fa-circle-play'} text-2xl`}></i>
              <span>{audioLoading[currentQuestionIndex] ? 'Loading...' : isPlayingAudio ? 'Playing...' : audioPlayed[currentQuestionIndex] ? 'Play Again' : 'Play Audio'}</span>
            </button>
            {audioPlayed[currentQuestionIndex] && (
              <p className="text-sm text-green-600 mt-3">
                <i className="fa-solid fa-check-circle"></i> Audio played
              </p>
            )}
          </div>
        </Card>

        {/* Question Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <p className="text-2xl font-bold text-gray-800">{question.question}</p>
        </Card>

        <div className="space-y-3">
          {question.options.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={!audioPlayed[currentQuestionIndex]}
              className={`w-full p-5 rounded-xl text-left font-medium text-lg transition-all duration-300 ${
                userAnswers[currentQuestionIndex] === index
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300'
              } ${!audioPlayed[currentQuestionIndex] ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        {!audioPlayed[currentQuestionIndex] && (
          <div className="text-center text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <i className="fa-solid fa-info-circle mr-2"></i>
            Please listen to the audio before selecting an answer
          </div>
        )}

        <button
          onClick={handleNextQuestion}
          disabled={userAnswers[currentQuestionIndex] === -1}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </button>
      </div>
    );
  };

  const renderReadingActivity = () => {
    if (!activity || !activity.questions) return null;

    const question = activity.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === activity.questions.length - 1;

    if (showResults) {
      return (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className={`text-8xl font-bold mb-4 ${score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
              {score}%
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {score >= 90 ? 'Excellent!' : score >= 70 ? 'Good Job!' : 'Keep Practicing!'}
            </h2>
            <p className="text-gray-600 text-lg">
              You got {userAnswers.filter((a, i) => a === activity.questions[i].correct_option).length} out of {activity.questions.length} correct
            </p>
          </div>

          {/* Review answers */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-4">Review Your Answers</h3>
            {activity.questions.map((q: any, index: number) => (
              <Card key={index} className={userAnswers[index] === q.correct_option ? 'border-2 border-green-500' : 'border-2 border-red-500'}>
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-lg font-medium text-gray-800 italic">{q.text}</p>
                </div>
                <p className="font-bold text-lg mb-3">{q.question}</p>
                <p className="text-sm text-gray-600 mb-2">Your answer: <span className={userAnswers[index] === q.correct_option ? 'text-green-600' : 'text-red-600'}>{q.options[userAnswers[index]]}</span></p>
                {userAnswers[index] !== q.correct_option && (
                  <p className="text-sm text-green-600 mb-2">Correct answer: {q.options[q.correct_option]}</p>
                )}
                {q.explanation && (
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg mt-2">💡 {q.explanation}</p>
                )}
              </Card>
            ))}
          </div>

          {renderResultFooter()}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Question {currentQuestionIndex + 1} of {activity.questions.length}</h2>
          <div className="text-sm text-gray-600">
            Progress: {Math.round(((currentQuestionIndex + 1) / activity.questions.length) * 100)}%
          </div>
        </div>

        {/* Reading Text Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-start gap-3 mb-3">
            <i className="fa-solid fa-book-open text-3xl text-amber-600"></i>
            <h3 className="text-xl font-bold text-amber-800">Reading Passage</h3>
          </div>
          <div className="bg-white p-6 rounded-lg border border-amber-200">
            <p className="text-xl leading-relaxed text-gray-800">{question.text}</p>
          </div>
        </Card>

        {/* Question Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <p className="text-2xl font-bold text-gray-800">{question.question}</p>
        </Card>

        <div className="space-y-3">
          {question.options.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={`w-full p-5 rounded-xl text-left font-medium text-lg transition-all duration-300 ${
                userAnswers[currentQuestionIndex] === index
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        <button
          onClick={handleNextQuestion}
          disabled={userAnswers[currentQuestionIndex] === -1}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingSpinner text="Generating your activity..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
            {topic}
          </h1>
          <p className="text-gray-600 text-lg font-medium">{description}</p>
          <div className="mt-3 inline-block px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
            <span className="text-sm font-bold text-gray-700">Level: </span>
            <span className="text-lg font-bold text-blue-600">{level}</span>
          </div>
        </Card>

        {activityType === 'grammar' && renderGrammarActivity()}
        {activityType === 'vocabulary' && renderVocabularyActivity()}
        {activityType === 'writing' && renderWritingActivity()}
        {activityType === 'listening' && renderListeningActivity()}
        {activityType === 'reading' && renderReadingActivity()}
      </div>
    </div>
  );
};

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

function releaseObjectUrl(url: string): void {
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

export default ActivityPage;
