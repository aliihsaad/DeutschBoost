import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { generateActivity, evaluateWriting } from '../services/activityService';
import { speakText } from '../services/geminiService';
import { CEFRLevel } from '../types';
import { ActivityType } from '../src/types/activity.types';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import type { AiProvider } from '../src/domain/ai/aiProvider';
import type { SpeechProvider } from '../src/domain/speech/speechProvider';
import { MOTHER_LANGUAGE_OPTIONS } from '../src/domain/profile/profileRepository';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import { PageHeader, Card, Button, Badge, Notice, cn } from '../components/ui';

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

  const activityType = searchParams.get('type') as ActivityType;
  const topic = searchParams.get('topic') || '';
  const description = searchParams.get('description') || '';
  const level = (searchParams.get('level') as CEFRLevel) || CEFRLevel.A2;
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

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

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

      if (activityType === 'grammar' || activityType === 'listening' || activityType === 'reading') {
        const questionCount = (generatedActivity as any).questions.length;
        setUserAnswers(new Array(questionCount).fill(-1));

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

      const { updatePlanItemCompletion, updateUserProgress } = await import('../services/learningPlanService');

      const { error: completionError } = await updatePlanItemCompletion(learnerId, itemId, true);

      if (completionError) {
        console.error('Error marking item complete:', completionError);
        toast.dismiss(loadingToast);
        toast.error('Failed to mark activity complete. Please try again.');
        setCompletionStatus('error');
        return;
      }

      const activityTypeMap: Record<string, 'conversation' | 'flashcards' | 'grammar' | 'listening' | 'reading' | 'writing'> = {
        grammar: 'grammar',
        vocabulary: 'flashcards',
        listening: 'listening',
        reading: 'reading',
        writing: 'writing',
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
      <div className="flex flex-col gap-3">
        {itemId && passed && (
          <Notice tone={completionStatus === 'error' ? 'error' : 'success'}>
            {completionStatus === 'saving' && 'Saving this plan task locally...'}
            {completionStatus === 'saved' &&
              'Plan task saved. Review the feedback, then continue when you are ready.'}
            {completionStatus === 'error' &&
              'The score was good, but saving the plan task failed. Try again before leaving.'}
            {completionStatus === 'idle' && 'This score is high enough to complete the plan task.'}
          </Notice>
        )}
        {!passed && (
          <Notice tone="info">
            This score stays below the pass target. Practice this area again before marking the task
            complete.
          </Notice>
        )}
        <Button onClick={handleContinueAfterResult} className="w-full">
          {label}
        </Button>
      </div>
    );
  };

  const renderScoreHero = (titleByScore: string) => (
    <div className="mb-8 text-center">
      <div className={cn('mb-2 text-[64px] font-bold', score >= 70 ? 'text-success' : 'text-danger')}>
        {score}%
      </div>
      <h2 className="text-[24px] font-bold text-text">{titleByScore}</h2>
    </div>
  );

  const optionButtonClass = (selected: boolean, disabled = false) =>
    cn(
      'w-full rounded-control border p-4 text-left text-[15px] font-medium transition-colors',
      selected ? 'border-brand bg-brand-soft text-text' : 'border-border bg-surface hover:border-brand',
      disabled && 'cursor-not-allowed opacity-50'
    );

  const renderGrammarActivity = () => {
    if (!activity || !activity.questions) return null;

    const question = activity.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === activity.questions.length - 1;

    if (showResults) {
      return (
        <div className="flex flex-col gap-6">
          {renderScoreHero(score >= 90 ? 'Excellent!' : score >= 70 ? 'Good Job!' : 'Keep Practicing!')}
          <p className="text-center text-[15px] text-text-muted">
            You got {userAnswers.filter((a, i) => a === activity.questions[i].correct_option).length} out
            of {activity.questions.length} correct
          </p>
          <div className="flex flex-col gap-4">
            <h3 className="text-[18px] font-bold text-text">Review Your Answers</h3>
            {activity.questions.map((q: any, index: number) => (
              <Card
                key={index}
                className={cn(
                  'border-2',
                  userAnswers[index] === q.correct_option ? 'border-success' : 'border-danger'
                )}
              >
                <p className="mb-3 text-[16px] font-bold text-text">{q.sentence}</p>
                <p className="mb-2 text-[13px] text-text-muted">
                  Your answer:{' '}
                  <span className={userAnswers[index] === q.correct_option ? 'text-success' : 'text-danger'}>
                    {q.options[userAnswers[index]]}
                  </span>
                </p>
                {userAnswers[index] !== q.correct_option && (
                  <p className="mb-2 text-[13px] text-success">
                    Correct answer: {q.options[q.correct_option]}
                  </p>
                )}
                <p className="mt-2 rounded-control bg-info-soft p-3 text-[13px] text-text">
                  💡 {q.explanation}
                </p>
              </Card>
            ))}
          </div>
          {renderResultFooter()}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">
            Question {currentQuestionIndex + 1} of {activity.questions.length}
          </h2>
          <span className="text-[13px] text-text-muted">
            Progress: {Math.round(((currentQuestionIndex + 1) / activity.questions.length) * 100)}%
          </span>
        </div>

        <Card variant="soft">
          <p className="text-[20px] font-bold text-text">{question.sentence}</p>
        </Card>

        <div className="flex flex-col gap-3">
          {question.options.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={optionButtonClass(userAnswers[currentQuestionIndex] === index)}
            >
              <span className="mr-3 font-bold">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        <Button
          onClick={handleNextQuestion}
          disabled={userAnswers[currentQuestionIndex] === -1}
          className="w-full"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </Button>
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">
            Card {currentCardIndex + 1} of {activity.cards.length}
          </h2>
          <span className="text-[13px] text-text-muted">
            Progress: {Math.round(((currentCardIndex + 1) / activity.cards.length) * 100)}%
          </span>
        </div>

        <div className="relative">
          <Card
            className="flex min-h-80 cursor-pointer flex-col items-center justify-center"
            onClick={() => {
              const newShowAnswer = !showAnswer;
              setShowAnswer(newShowAnswer);
              if (newShowAnswer) {
                setFlippedCards(prev => new Set(prev).add(currentCardIndex));
              }
            }}
          >
            <div className="text-center">
              {!showAnswer ? (
                <>
                  <div className="mb-4 text-[48px] font-bold text-brand-strong">{card.german}</div>
                  <p className="text-[15px] text-text-muted">Click to reveal</p>
                </>
              ) : (
                <>
                  <div className="mb-4 text-[32px] font-bold text-text">{card.german}</div>
                  <div className="mb-6 text-[24px] text-success">{card.translation}</div>
                  <div className="relative max-w-md rounded-control bg-surface-soft p-4">
                    <p className="text-[15px] italic text-text">"{card.example_sentence}"</p>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        speakGermanWord(card.example_sentence, 'vocabulary-example');
                      }}
                      className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-pill bg-brand text-text shadow-soft transition-colors hover:bg-brand-strong hover:text-white"
                      title="Listen to example sentence"
                    >
                      <i className="fa-solid fa-volume-up text-sm" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <button
            onClick={e => {
              e.stopPropagation();
              speakGermanWord(card.german, 'vocabulary-pronunciation');
            }}
            className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-pill bg-brand text-text shadow-soft transition-colors hover:bg-brand-strong hover:text-white"
            title="Listen to pronunciation"
          >
            <i className="fa-solid fa-volume-up text-lg" />
          </button>
        </div>

        <div className="flex gap-4">
          {currentCardIndex > 0 && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setCurrentCardIndex(currentCardIndex - 1);
                setShowAnswer(false);
              }}
            >
              Previous
            </Button>
          )}

          {!isLastCard ? (
            <Button
              className="flex-1"
              onClick={() => {
                setCurrentCardIndex(currentCardIndex + 1);
                setShowAnswer(false);
              }}
            >
              Next Card
            </Button>
          ) : completionStatus === 'saved' ? (
            <Button className="flex-1" onClick={handleContinueAfterResult}>
              Continue to Plan
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => {
                if (flippedCards.size === activity.cards.length) {
                  markActivityComplete(100);
                } else {
                  toast.error(`Please flip all ${activity.cards.length} cards to complete the activity!`);
                }
              }}
              disabled={flippedCards.size !== activity.cards.length || completionStatus === 'saving'}
            >
              {completionStatus === 'saving'
                ? 'Saving...'
                : `Complete (${flippedCards.size}/${activity.cards.length} flipped)`}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderWritingActivity = () => {
    if (!activity) return null;

    if (showResults && evaluation) {
      return (
        <div className="flex flex-col gap-6">
          {renderScoreHero(
            score >= 90 ? 'Excellent Writing!' : score >= 70 ? 'Good Work!' : 'Keep Practicing!'
          )}

          <Card title="✨ Strengths">
            <ul className="list-inside list-disc space-y-1 text-[14px] text-text">
              {evaluation.strengths.map((strength: string, index: number) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </Card>

          <Card title="📚 Areas for Improvement">
            <ul className="list-inside list-disc space-y-1 text-[14px] text-text">
              {evaluation.areas_for_improvement.map((area: string, index: number) => (
                <li key={index}>{area}</li>
              ))}
            </ul>
          </Card>

          <Card title="💬 Detailed Feedback">
            <p className="text-[14px] leading-relaxed text-text">{evaluation.detailed_feedback}</p>
          </Card>

          {evaluation.corrected_text && (
            <Card title="✏️ Corrected Version">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text">
                {evaluation.corrected_text}
              </p>
            </Card>
          )}

          {renderResultFooter()}
        </div>
      );
    }

    const wordCount = userText.trim().split(/\s+/).filter(w => w).length;

    return (
      <div className="flex flex-col gap-6">
        <Card title="✍️ Writing Prompt">
          <p className="mb-4 text-[15px] text-text">{activity.prompt}</p>
          <p className="text-[13px] text-text-muted">Minimum words: {activity.min_words}</p>
        </Card>

        <Card>
          <textarea
            value={userText}
            onChange={e => setUserText(e.target.value)}
            placeholder="Schreibe hier auf Deutsch..."
            className="h-64 w-full rounded-control border border-border bg-surface p-4 text-[15px] text-text outline-none focus:border-brand"
          />
          <div className="mt-2 text-[13px] text-text-muted">
            Word count: {wordCount} / {activity.min_words}
          </div>
        </Card>

        <Button
          onClick={handleSubmitWriting}
          disabled={wordCount < activity.min_words || loading}
          className="w-full"
        >
          {loading ? 'Evaluating...' : 'Submit for Evaluation'}
        </Button>
      </div>
    );
  };

  const handlePlayAudio = async (questionIndex: number, audioText: string) => {
    if (isPlayingAudio) {
      toast.error('Please wait for current audio to finish');
      return;
    }

    const newLoading = [...audioLoading];
    newLoading[questionIndex] = true;
    setAudioLoading(newLoading);
    setIsPlayingAudio(true);

    try {
      await playGermanAudio(audioText, 'listening-practice');

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
      const resetLoading = [...audioLoading];
      resetLoading[questionIndex] = false;
      setAudioLoading(resetLoading);
    }
  };

  const renderListeningActivity = () => {
    if (!activity || !activity.questions) return null;

    const question = activity.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === activity.questions.length - 1;

    if (showResults) {
      return (
        <div className="flex flex-col gap-6">
          {renderScoreHero(score >= 90 ? 'Excellent!' : score >= 70 ? 'Good Job!' : 'Keep Practicing!')}
          <p className="text-center text-[15px] text-text-muted">
            You got {userAnswers.filter((a, i) => a === activity.questions[i].correct_option).length} out
            of {activity.questions.length} correct
          </p>
          <div className="flex flex-col gap-4">
            <h3 className="text-[18px] font-bold text-text">Review Your Answers</h3>
            {activity.questions.map((q: any, index: number) => (
              <Card
                key={index}
                className={cn(
                  'border-2',
                  userAnswers[index] === q.correct_option ? 'border-success' : 'border-danger'
                )}
              >
                <div className="mb-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePlayAudio(index, q.audio_text)}
                    disabled={audioLoading[index] || isPlayingAudio}
                    icon={<i className={`fa-solid ${audioLoading[index] ? 'fa-spinner fa-spin' : 'fa-volume-up'}`} />}
                  >
                    Replay Audio
                  </Button>
                </div>
                <p className="mb-3 text-[16px] font-bold text-text">{q.question}</p>
                <p className="mb-2 text-[13px] text-text-muted">
                  Your answer:{' '}
                  <span className={userAnswers[index] === q.correct_option ? 'text-success' : 'text-danger'}>
                    {q.options[userAnswers[index]]}
                  </span>
                </p>
                {userAnswers[index] !== q.correct_option && (
                  <p className="mb-2 text-[13px] text-success">
                    Correct answer: {q.options[q.correct_option]}
                  </p>
                )}
              </Card>
            ))}
          </div>
          {renderResultFooter()}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">
            Question {currentQuestionIndex + 1} of {activity.questions.length}
          </h2>
          <span className="text-[13px] text-text-muted">
            Progress: {Math.round(((currentQuestionIndex + 1) / activity.questions.length) * 100)}%
          </span>
        </div>

        <Card variant="soft">
          <div className="py-6 text-center">
            <div className="mb-4 text-[40px] text-brand-strong">
              <i className="fa-solid fa-headphones" />
            </div>
            <h3 className="mb-4 text-[18px] font-bold text-text">Listen to the audio</h3>
            <Button
              onClick={() => handlePlayAudio(currentQuestionIndex, question.audio_text)}
              disabled={audioLoading[currentQuestionIndex] || isPlayingAudio}
              icon={
                <i
                  className={`fa-solid ${
                    audioLoading[currentQuestionIndex]
                      ? 'fa-spinner fa-spin'
                      : isPlayingAudio
                        ? 'fa-circle-pause'
                        : 'fa-circle-play'
                  }`}
                />
              }
            >
              {audioLoading[currentQuestionIndex]
                ? 'Loading...'
                : isPlayingAudio
                  ? 'Playing...'
                  : audioPlayed[currentQuestionIndex]
                    ? 'Play Again'
                    : 'Play Audio'}
            </Button>
            {audioPlayed[currentQuestionIndex] && (
              <p className="mt-3 text-[13px] text-success">
                <i className="fa-solid fa-check-circle" /> Audio played
              </p>
            )}
          </div>
        </Card>

        <Card variant="soft">
          <p className="text-[20px] font-bold text-text">{question.question}</p>
        </Card>

        <div className="flex flex-col gap-3">
          {question.options.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={!audioPlayed[currentQuestionIndex]}
              className={optionButtonClass(
                userAnswers[currentQuestionIndex] === index,
                !audioPlayed[currentQuestionIndex]
              )}
            >
              <span className="mr-3 font-bold">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        {!audioPlayed[currentQuestionIndex] && (
          <Notice tone="info">Please listen to the audio before selecting an answer</Notice>
        )}

        <Button
          onClick={handleNextQuestion}
          disabled={userAnswers[currentQuestionIndex] === -1}
          className="w-full"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </Button>
      </div>
    );
  };

  const renderReadingActivity = () => {
    if (!activity || !activity.questions) return null;

    const question = activity.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === activity.questions.length - 1;

    if (showResults) {
      return (
        <div className="flex flex-col gap-6">
          {renderScoreHero(score >= 90 ? 'Excellent!' : score >= 70 ? 'Good Job!' : 'Keep Practicing!')}
          <p className="text-center text-[15px] text-text-muted">
            You got {userAnswers.filter((a, i) => a === activity.questions[i].correct_option).length} out
            of {activity.questions.length} correct
          </p>
          <div className="flex flex-col gap-4">
            <h3 className="text-[18px] font-bold text-text">Review Your Answers</h3>
            {activity.questions.map((q: any, index: number) => (
              <Card
                key={index}
                className={cn(
                  'border-2',
                  userAnswers[index] === q.correct_option ? 'border-success' : 'border-danger'
                )}
              >
                <div className="mb-4 rounded-control bg-surface-soft p-4">
                  <p className="text-[15px] font-medium italic text-text">{q.text}</p>
                </div>
                <p className="mb-3 text-[16px] font-bold text-text">{q.question}</p>
                <p className="mb-2 text-[13px] text-text-muted">
                  Your answer:{' '}
                  <span className={userAnswers[index] === q.correct_option ? 'text-success' : 'text-danger'}>
                    {q.options[userAnswers[index]]}
                  </span>
                </p>
                {userAnswers[index] !== q.correct_option && (
                  <p className="mb-2 text-[13px] text-success">
                    Correct answer: {q.options[q.correct_option]}
                  </p>
                )}
                {q.explanation && (
                  <p className="mt-2 rounded-control bg-info-soft p-3 text-[13px] text-text">
                    💡 {q.explanation}
                  </p>
                )}
              </Card>
            ))}
          </div>
          {renderResultFooter()}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">
            Question {currentQuestionIndex + 1} of {activity.questions.length}
          </h2>
          <span className="text-[13px] text-text-muted">
            Progress: {Math.round(((currentQuestionIndex + 1) / activity.questions.length) * 100)}%
          </span>
        </div>

        <Card title="Reading Passage">
          <div className="rounded-control bg-surface-soft p-6">
            <p className="text-[17px] leading-relaxed text-text">{question.text}</p>
          </div>
        </Card>

        <Card variant="soft">
          <p className="text-[20px] font-bold text-text">{question.question}</p>
        </Card>

        <div className="flex flex-col gap-3">
          {question.options.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={optionButtonClass(userAnswers[currentQuestionIndex] === index)}
            >
              <span className="mr-3 font-bold">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>

        <Button
          onClick={handleNextQuestion}
          disabled={userAnswers[currentQuestionIndex] === -1}
          className="w-full"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner text="Generating your activity..." />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl">
      <PageHeader
        title={topic}
        subtitle={description}
        actions={<Badge tone="brand">Level: {level}</Badge>}
      />

      {activityType === 'grammar' && renderGrammarActivity()}
      {activityType === 'vocabulary' && renderVocabularyActivity()}
      {activityType === 'writing' && renderWritingActivity()}
      {activityType === 'listening' && renderListeningActivity()}
      {activityType === 'reading' && renderReadingActivity()}
    </main>
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
