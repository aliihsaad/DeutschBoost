import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CEFRLevel } from '../types';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { useAuth } from '../src/contexts/AuthContext';
import { startConversationSession as startGeminiSession, decode, decodeAudioData, createPcmBlob } from '../services/geminiService';
import { startConversationSession as startDBSession, endConversationSession } from '../services/conversationService';
import { ConversationMode, Transcript } from '../types';
import { LiveConnectSession, LiveServerMessage } from "@google/genai";

const SpeakingActivityPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, userProfile, userData } = useAuth();

  // Get activity params from URL
  const activityTopic = searchParams.get('topic') || '';
  const activityDescription = searchParams.get('description') || '';
  const level = searchParams.get('level') as CEFRLevel || CEFRLevel.A2;
  const itemId = searchParams.get('itemId');

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'stopping' | 'evaluating' | 'error'>('idle');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);
  const sessionPromiseRef = useRef<Promise<LiveConnectSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const nextOutputStartTime = useRef(0);
  const audioPlaybackSources = useRef(new Set<AudioBufferSourceNode>());
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // Auto-scroll transcripts
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Validate params
  useEffect(() => {
    if (!activityTopic || !activityDescription) {
      toast.error('Invalid activity parameters');
      navigate('/learning-plan');
    }
  }, [activityTopic, activityDescription, navigate]);

  const handleMessage = useCallback(async (message: LiveServerMessage) => {
    let inputTranscriptPart = '';
    let outputTranscriptPart = '';

    if (message.serverContent?.inputTranscription) {
      inputTranscriptPart = message.serverContent.inputTranscription.text;
      currentInputTranscription.current += inputTranscriptPart;
    }
    if (message.serverContent?.outputTranscription) {
      outputTranscriptPart = message.serverContent.outputTranscription.text;
      currentOutputTranscription.current += outputTranscriptPart;
    }

    setTranscripts(prev => {
      const newTranscripts = [...prev];
      if (inputTranscriptPart) {
        const last = newTranscripts[newTranscripts.length - 1];
        if (last && last.speaker === 'user') {
          last.text += inputTranscriptPart;
        } else {
          newTranscripts.push({ id: Date.now(), speaker: 'user', text: inputTranscriptPart });
        }
      }
      if (outputTranscriptPart) {
        const last = newTranscripts[newTranscripts.length - 1];
        if (last && last.speaker === 'model') {
          last.text += outputTranscriptPart;
        } else {
          newTranscripts.push({ id: Date.now() + 1, speaker: 'model', text: outputTranscriptPart });
        }
      }
      return newTranscripts;
    });

    if (message.serverContent?.turnComplete) {
      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
    }

    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
    if (base64Audio && outputAudioContextRef.current) {
      const audioCtx = outputAudioContextRef.current;
      nextOutputStartTime.current = Math.max(nextOutputStartTime.current, audioCtx.currentTime);
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.addEventListener('ended', () => {
        audioPlaybackSources.current.delete(source);
      });
      source.start(nextOutputStartTime.current);
      nextOutputStartTime.current += audioBuffer.duration;
      audioPlaybackSources.current.add(source);
    }

    if (message.serverContent?.interrupted) {
      for (const source of audioPlaybackSources.current.values()) {
        source.stop();
        audioPlaybackSources.current.delete(source);
      }
      nextOutputStartTime.current = 0;
    }
  }, []);

  const startActivity = async () => {
    if (!user) {
      toast.error('Please log in to start activity');
      return;
    }

    setStatus('connecting');
    setTranscripts([]);

    try {
      // Start database session
      sessionStartTimeRef.current = new Date();
      const { sessionId, error: dbError } = await startDBSession(user.id, ConversationMode.SPEAKING_ACTIVITY);

      if (dbError || !sessionId) {
        toast.error('Failed to start session');
        setStatus('error');
        return;
      }

      sessionIdRef.current = sessionId;

      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const userLevel = userProfile?.current_level || CEFRLevel.A2;
      const userName = userData?.full_name?.split(' ')[0];
      const motherLanguage = userProfile?.mother_language;

      sessionPromiseRef.current = startGeminiSession({
        onopen: () => {
          setStatus('connected');
          const inputCtx = inputAudioContextRef.current!;
          mediaStreamSourceRef.current = inputCtx.createMediaStreamSource(mediaStreamRef.current!);
          scriptProcessorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            sessionPromiseRef.current?.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputCtx.destination);
        },
        onmessage: handleMessage,
        onerror: (e) => {
          toast.error('Connection error');
          setStatus('error');
        },
        onclose: () => {},
      }, userLevel, userName, motherLanguage, null, ConversationMode.SPEAKING_ACTIVITY, activityTopic, activityDescription);

    } catch (err) {
      console.error('Failed to start activity:', err);
      toast.error('Failed to start activity');
      setStatus('error');
    }
  };

  const stopActivity = async () => {
    setStatus('stopping');

    try {
      // Close the live session
      if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.close();
        sessionPromiseRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }
      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
      }

      for (const source of audioPlaybackSources.current.values()) {
        source.stop();
      }
      audioPlaybackSources.current.clear();
      nextOutputStartTime.current = 0;

      setStatus('evaluating');
      toast.loading('Evaluating your speaking practice...');

      if (sessionIdRef.current && sessionStartTimeRef.current && transcripts.length > 0) {
        const userLevel = userProfile?.current_level || CEFRLevel.A2;
        const motherLanguage = userProfile?.mother_language || 'English';

        const { error } = await endConversationSession(
          sessionIdRef.current,
          transcripts,
          sessionStartTimeRef.current,
          userLevel,
          motherLanguage
        );

        if (error) {
          toast.dismiss();
          toast.error('Failed to save session');
          return;
        }

        // Load feedback
        const { supabase } = await import('../src/lib/supabase');
        const { data } = await supabase
          .from('conversation_sessions')
          .select('feedback')
          .eq('id', sessionIdRef.current)
          .single();

        if (data?.feedback) {
          const parsedFeedback = typeof data.feedback === 'string' ? JSON.parse(data.feedback) : data.feedback;
          setEvaluation(parsedFeedback);
          setScore(parsedFeedback.overall_score);
          setShowResults(true);
          toast.dismiss();

          // Mark activity complete if score >= 70%
          if (parsedFeedback.overall_score >= 70) {
            await markActivityComplete(parsedFeedback.overall_score);
          }
        }
      }
    } catch (err) {
      console.error('Error stopping activity:', err);
      toast.dismiss();
      toast.error('Failed to evaluate');
    }
  };

  const markActivityComplete = async (finalScore: number) => {
    if (!user || !itemId) return;

    const loadingToast = toast.loading('Saving your progress...');

    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const { updatePlanItemCompletion, updateUserProgress } = await import('../services/learningPlanService');

      const { error: completionError } = await updatePlanItemCompletion(
        user.id,
        itemId,
        true
      );

      if (completionError) {
        toast.dismiss(loadingToast);
        toast.error('Failed to mark activity complete');
        return;
      }

      const { error: progressError } = await updateUserProgress(
        user.id,
        'conversation',
        timeSpent,
        1
      );

      if (progressError) {
        console.error('Error updating progress:', progressError);
      }

      toast.dismiss(loadingToast);
      toast.success(`Activity completed! Score: ${finalScore}%`);

      setTimeout(() => {
        navigate('/learning-plan');
      }, 2000);
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.dismiss(loadingToast);
      toast.error('Error saving progress');
    }
  };

  if (showResults && evaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Card glass hover className="backdrop-blur-xl border-2 border-white/30 mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
              {activityTopic}
            </h1>
            <p className="text-gray-600 text-lg">{activityDescription}</p>
          </Card>

          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className={`text-8xl font-bold mb-4 ${score >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                {score}%
              </div>
              <h2 className="text-3xl font-bold mb-2">
                {score >= 90 ? 'Excellent Speaking!' : score >= 70 ? 'Good Work!' : 'Keep Practicing!'}
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

            {evaluation.grammar_corrections && evaluation.grammar_corrections.length > 0 && (
              <Card className="bg-blue-50 border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-800 mb-3">✏️ Grammar Corrections</h3>
                <div className="space-y-2">
                  {evaluation.grammar_corrections.slice(0, 5).map((correction: any, index: number) => (
                    <div key={index} className="p-3 bg-white rounded-lg">
                      <p className="text-sm text-gray-700">{correction.explanation}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <button
              onClick={() => navigate('/learning-plan')}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
            >
              Back to Learning Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <Card glass hover className="backdrop-blur-xl border-2 border-white/30 mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
            Speaking Practice
          </h1>
        </Card>

        <div className="max-w-3xl mx-auto mb-6">
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                🎯
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-purple-800 mb-1">Today's Topic</h3>
                <h4 className="text-xl font-bold text-gray-800 mb-2">{activityTopic}</h4>
                <p className="text-gray-700">{activityDescription}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="max-w-3xl mx-auto">
          <div className="flex justify-center items-center mb-6 space-x-4">
            {status === 'idle' || status === 'error' ? (
              <button
                onClick={startActivity}
                className="bg-green-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-700 transition shadow-lg flex items-center space-x-2"
              >
                <i className="fa-solid fa-microphone-alt"></i>
                <span>Start Speaking Practice</span>
              </button>
            ) : status === 'connecting' ? (
              <button disabled className="bg-yellow-600 text-white px-8 py-4 rounded-full font-bold text-lg opacity-75 cursor-not-allowed shadow-lg flex items-center space-x-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Connecting...</span>
              </button>
            ) : status === 'connected' ? (
              <button
                onClick={stopActivity}
                className="bg-red-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-700 transition shadow-lg flex items-center space-x-2"
              >
                <i className="fa-solid fa-stop"></i>
                <span>End Practice</span>
              </button>
            ) : status === 'stopping' || status === 'evaluating' ? (
              <button disabled className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg opacity-75 cursor-not-allowed shadow-lg flex items-center space-x-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>{status === 'stopping' ? 'Stopping...' : 'Evaluating...'}</span>
              </button>
            ) : null}
          </div>

          {transcripts.length > 0 && (
            <div ref={transcriptContainerRef} className="h-96 bg-gray-200 rounded-lg p-4 overflow-y-auto space-y-4">
              {transcripts.map((t) => (
                <div key={t.id} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-2xl p-4 rounded-xl ${
                    t.speaker === 'user'
                      ? 'bg-blue-600 text-white ml-12'
                      : 'bg-white text-gray-800 mr-12 border-2 border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white font-bold text-sm">
                        {t.speaker === 'user' ? 'U' : 'A'}
                      </div>
                      <span className="font-bold text-sm">{t.speaker === 'user' ? 'You' : 'Alex'}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{t.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SpeakingActivityPage;
