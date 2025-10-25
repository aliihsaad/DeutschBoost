import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LiveConnectSession, LiveServerMessage } from '@google/genai';
import { startConversationSession as startGeminiSession, decode, decodeAudioData, createPcmBlob } from '../services/geminiService';
import { Transcript, ConversationMode, ConversationModeInfo } from '../types';
import Card from '../components/Card';
import { useAuth } from '../src/contexts/AuthContext';
import { CEFRLevel } from '../types';
import {
    startConversationSession as startDBSession,
    endConversationSession,
    ConversationFeedback,
    loadConversationHistory,
    getLastConversationFeedback
} from '../services/conversationService';
import toast from 'react-hot-toast';
import ConversationHistoryCard from '../components/ConversationHistoryCard';

const ConversationPage: React.FC = () => {
    const { user, userData, userProfile } = useAuth();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [feedback, setFeedback] = useState<ConversationFeedback | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [previousFeedback, setPreviousFeedback] = useState<ConversationFeedback | null>(null);
    const [selectedMode, setSelectedMode] = useState<ConversationMode>(ConversationMode.FREE_CONVERSATION);
    const [currentReadingText, setCurrentReadingText] = useState<string>('');

    // Define available conversation modes
    const conversationModes: ConversationModeInfo[] = [
        {
            mode: ConversationMode.FREE_CONVERSATION,
            name: 'Free Conversation',
            description: 'Natural conversation practice with Alex',
            icon: '💬'
        },
        {
            mode: ConversationMode.READING_PRACTICE,
            name: 'Reading Practice',
            description: 'Practice reading German texts aloud with feedback',
            icon: '📖'
        },
        {
            mode: ConversationMode.VOCABULARY_BUILDER,
            name: 'Vocabulary Builder',
            description: 'Learn and practice new German words',
            icon: '📚'
        },
        {
            mode: ConversationMode.GRAMMAR_DRILL,
            name: 'Grammar Drill',
            description: 'Interactive grammar exercises with corrections',
            icon: '✏️'
        },
        {
            mode: ConversationMode.LISTENING_COMPREHENSION,
            name: 'Listening Comprehension',
            description: 'Listen to stories and answer questions',
            icon: '👂'
        }
    ];

    // Get learning plan params if conversation started from a learning plan item (legacy, now uses SpeakingActivityPage)
    const itemId = searchParams.get('itemId');
    const activityTopic = searchParams.get('topic');
    const activityDescription = searchParams.get('description');

    // Auto-select SPEAKING_ACTIVITY mode if coming from learning plan
    const isLearningPlanActivity = activityTopic && activityDescription;

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

    // Auto-select SPEAKING_ACTIVITY mode if coming from learning plan
    useEffect(() => {
        if (isLearningPlanActivity) {
            setSelectedMode(ConversationMode.SPEAKING_ACTIVITY);
        }
    }, [isLearningPlanActivity]);

    // Auto-scroll behavior based on selected mode
    useEffect(() => {
        if (transcriptContainerRef.current) {
            // Only auto-scroll in Free Conversation, Listening Comprehension, and Speaking Activity modes
            // In Reading, Vocabulary, and Grammar modes, user needs to see previous content
            const shouldAutoScroll =
                selectedMode === ConversationMode.FREE_CONVERSATION ||
                selectedMode === ConversationMode.LISTENING_COMPREHENSION ||
                selectedMode === ConversationMode.SPEAKING_ACTIVITY;

            if (shouldAutoScroll) {
                transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
            }
        }
    }, [transcripts, selectedMode]);

    // Detect and update current reading text in Reading Practice mode
    useEffect(() => {
        if (selectedMode === ConversationMode.READING_PRACTICE && transcripts.length > 0) {
            const modelMessages = transcripts.filter(t => t.speaker === 'model');

            if (modelMessages.length > 0) {
                const latestModel = modelMessages[modelMessages.length - 1].text;

                // Detect new reading prompts by checking for specific phrases or length
                // Reading prompts are typically:
                // - Longer texts (80+ chars for actual reading content)
                // - Contain "lies" or start of paragraph
                // - Don't contain "möchtest" (which is in the follow-up question)
                const isReadingPrompt =
                    latestModel.length > 80 &&
                    !latestModel.toLowerCase().includes('möchtest') &&
                    !latestModel.toLowerCase().includes('nochmal');

                // Update reading text if it's a new reading prompt
                if (isReadingPrompt && latestModel !== currentReadingText) {
                    setCurrentReadingText(latestModel);
                }

                // Initialize with first model message if no reading text set yet
                if (!currentReadingText && modelMessages.length > 0) {
                    setCurrentReadingText(latestModel);
                }
            }
        }
    }, [transcripts, selectedMode, currentReadingText]);

    // Load conversation history on mount
    useEffect(() => {
        const loadHistory = async () => {
            if (!user) return;

            setIsLoadingHistory(true);
            const { sessions, error } = await loadConversationHistory(user.id, 5);

            if (error) {
                console.error('Error loading conversation history:', error);
            } else if (sessions) {
                setConversationHistory(sessions);
            }
            setIsLoadingHistory(false);
        };

        loadHistory();
    }, [user]);

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

    const startConversation = async () => {
        console.log('🎙️ Starting conversation...');

        // Prevent multiple simultaneous starts
        if (status === 'connecting' || status === 'connected') {
            console.log('⚠️ Conversation already starting/started, ignoring');
            return;
        }

        if (!user) {
            console.error('❌ No user logged in');
            toast.error('Please log in to start a conversation');
            return;
        }

        console.log('✅ User authenticated:', user.id);
        setStatus('connecting');
        setTranscripts([]);
        setFeedback(null);
        setShowFeedback(false);

        try {
            // Load previous feedback for AI context
            console.log('📚 Loading previous feedback...');
            const { feedback: lastFeedback, error: feedbackError } = await getLastConversationFeedback(user.id);

            if (feedbackError) {
                console.warn('⚠️ Could not load previous feedback:', feedbackError);
            } else if (lastFeedback) {
                console.log('✅ Previous feedback loaded, score:', lastFeedback.overall_score);
                setPreviousFeedback(lastFeedback);
            } else {
                console.log('ℹ️ No previous feedback found');
                setPreviousFeedback(null);
            }

            // Start database session
            console.log('💾 Starting database session...');
            sessionStartTimeRef.current = new Date();
            const { sessionId, error: dbError } = await startDBSession(user.id, selectedMode);

            if (dbError || !sessionId) {
                console.error('❌ Failed to start DB session:', dbError);
                toast.error('Failed to start conversation session');
                setStatus('error');
                return;
            }

            console.log('✅ Database session started:', sessionId);
            sessionIdRef.current = sessionId;

            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
             if (!inputAudioContextRef.current) {
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }

            console.log('🎤 Requesting microphone access...');
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Microphone access granted');

            // Get user's level, name, and mother language for personalized conversation
            const userLevel = userProfile?.current_level || CEFRLevel.A2;
            const userName = userData?.full_name?.split(' ')[0]; // First name only
            const motherLanguage = userProfile?.mother_language;

            console.log('🤖 Starting Gemini session with:', {
                userLevel,
                userName,
                motherLanguage,
                hasPreviousFeedback: !!lastFeedback,
                mode: selectedMode,
                topic: activityTopic,
                description: activityDescription
            });
            sessionPromiseRef.current = startGeminiSession({
                onopen: () => {
                    console.log('✅ Gemini session opened - connected!');
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
                    console.error("❌ Gemini session error:", e);
                    toast.error('Connection error: ' + (e.message || 'Unknown error'));
                    setStatus('error');
                },
                onclose: () => {
                    // This can be handled if needed, but stopping handles cleanup.
                },
            }, userLevel, userName, motherLanguage, lastFeedback, selectedMode, activityTopic || undefined, activityDescription || undefined);

        } catch (err) {
            console.error("❌ Failed to start conversation:", err);
            toast.error('Failed to start conversation: ' + (err instanceof Error ? err.message : 'Unknown error'));
            setStatus('error');
        }
    };
    
    const stopConversation = useCallback(async () => {
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

        if(scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if(mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }

        for (const source of audioPlaybackSources.current.values()) {
            source.stop();
        }
        audioPlaybackSources.current.clear();
        nextOutputStartTime.current = 0;

        setStatus('idle');

        // Save session and generate feedback if we have a session ID
        if (sessionIdRef.current && sessionStartTimeRef.current && transcripts.length > 0) {
            setIsGeneratingFeedback(true);
            toast.loading('Generating your feedback...');

            try {
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
                    console.error('Error saving conversation session:', error);
                    toast.error('Failed to save conversation');
                } else {
                    // Load the feedback from the saved session
                    // The feedback was generated in endConversationSession
                    toast.dismiss();
                    toast.success('Conversation saved successfully!');

                    // Import the function to load feedback
                    const { supabase } = await import('../src/lib/supabase');
                    const { data } = await supabase
                        .from('conversation_sessions')
                        .select('feedback')
                        .eq('id', sessionIdRef.current)
                        .single();

                    if (data?.feedback) {
                        const parsedFeedback = typeof data.feedback === 'string'
                            ? JSON.parse(data.feedback)
                            : data.feedback;
                        setFeedback(parsedFeedback);
                        setShowFeedback(true);

                        // Mark learning plan item complete if this conversation was from a learning plan activity
                        if (user && itemId && parsedFeedback.overall_score >= 70) {
                            try {
                                const { updatePlanItemCompletion, updateUserProgress } = await import('../services/learningPlanService');

                                // Mark item complete
                                await updatePlanItemCompletion(user.id, itemId, true);

                                // Update user progress (calculate duration in seconds)
                                const durationSeconds = sessionStartTimeRef.current
                                    ? Math.round((new Date().getTime() - sessionStartTimeRef.current.getTime()) / 1000)
                                    : 0;

                                const { error: progressError, profile } = await updateUserProgress(
                                    user.id,
                                    'conversation',
                                    durationSeconds,
                                    1
                                );

                                if (progressError) {
                                    console.error('Error updating user progress:', progressError);
                                } else if (profile) {
                                    console.log('✅ User progress updated:', profile);
                                }

                                toast.success(`Speaking activity completed! Score: ${parsedFeedback.overall_score}%`);
                            } catch (err) {
                                console.error('Error marking learning plan item complete:', err);
                            }
                        }
                    }

                    // Reload conversation history to show the new session
                    if (user) {
                        const { sessions } = await loadConversationHistory(user.id, 5);
                        if (sessions) {
                            setConversationHistory(sessions);
                        }
                    }
                }
            } catch (err) {
                console.error('Error in stopConversation:', err);
                toast.dismiss();
                toast.error('Failed to generate feedback');
            } finally {
                setIsGeneratingFeedback(false);
                sessionIdRef.current = null;
                sessionStartTimeRef.current = null;
            }
        }
    }, [transcripts, userProfile, user]);

    useEffect(() => {
        // Cleanup function that runs ONLY when component unmounts
        return () => {
            // Close the live session without saving feedback on unmount
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                    session.close();
                });
            }

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }

            if (scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
            }
            if (mediaStreamSourceRef.current) {
                mediaStreamSourceRef.current.disconnect();
            }

            for (const source of audioPlaybackSources.current.values()) {
                source.stop();
            }
            audioPlaybackSources.current.clear();
        };
    }, []); // Empty dependency array - only run on mount/unmount

    // Get level info for display
    const userLevel = userProfile?.current_level || CEFRLevel.A2;
    const levelDescriptions: Record<CEFRLevel, string> = {
        [CEFRLevel.A1]: "Alex will speak slowly with simple sentences and basic vocabulary. Perfect for beginners!",
        [CEFRLevel.A2]: "Alex will use everyday expressions and simple past tense. Great for elementary learners!",
        [CEFRLevel.B1]: "Alex will engage in natural conversations about various topics with some complex grammar.",
        [CEFRLevel.B2]: "Alex will discuss complex topics at near-native speed with idiomatic expressions.",
        [CEFRLevel.C1]: "Alex will engage in sophisticated discussions with advanced vocabulary and nuanced topics.",
        [CEFRLevel.C2]: "Alex will converse as an equal partner at native level on any topic."
    };

    return (
        <div className="container mx-auto p-8">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold">AI Conversation Partner</h1>
                <p className="text-gray-600 mt-2">Practice your German by speaking with our AI tutor, Alex.</p>
            </header>

            {/* Level Info Card */}
            <Card className="max-w-3xl mx-auto mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {userLevel}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800">Your Conversation Level</h3>
                        <p className="text-gray-600 text-sm">{levelDescriptions[userLevel]}</p>
                    </div>
                    <div className="hidden md:block text-4xl">
                        💬
                    </div>
                </div>
            </Card>

            {/* Activity Topic (for learning plan activities) OR Mode Selector */}
            {status === 'idle' || status === 'error' ? (
                isLearningPlanActivity ? (
                    <div className="max-w-3xl mx-auto mb-6">
                        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                                    🎯
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-purple-800 mb-1">Speaking Practice Activity</h3>
                                    <h4 className="text-xl font-bold text-gray-800 mb-2">{activityTopic}</h4>
                                    <p className="text-gray-700">{activityDescription}</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Choose Your Learning Mode</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            {conversationModes.map((modeInfo) => (
                                <button
                                    key={modeInfo.mode}
                                    onClick={() => setSelectedMode(modeInfo.mode)}
                                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                                        selectedMode === modeInfo.mode
                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-600 text-white shadow-lg scale-105'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-md'
                                    }`}
                                >
                                    <div className="text-3xl mb-2">{modeInfo.icon}</div>
                                    <div className="font-bold text-sm mb-1">{modeInfo.name}</div>
                                    <div className={`text-xs ${selectedMode === modeInfo.mode ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {modeInfo.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )
            ) : null}

            <Card className="max-w-3xl mx-auto">
                <div className="flex justify-center items-center mb-6 space-x-4">
                    {status === 'idle' || status === 'error' ? (
                         <button
                            onClick={startConversation}
                            disabled={status === 'connecting'}
                            className="bg-green-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-700 transition shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             <i className="fa-solid fa-microphone-alt"></i>
                             <span>Start Conversation</span>
                         </button>
                    ) : status === 'connecting' ? (
                        <button
                            disabled
                            className="bg-yellow-600 text-white px-8 py-4 rounded-full font-bold text-lg opacity-75 cursor-not-allowed shadow-lg flex items-center space-x-2"
                        >
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <span>Connecting...</span>
                        </button>
                    ) : (
                        <button
                            onClick={stopConversation}
                            className="bg-red-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-700 transition shadow-lg flex items-center space-x-2"
                        >
                            <i className="fa-solid fa-phone-slash"></i>
                            <span>End Conversation</span>
                        </button>
                    )}
                </div>
                <div className="text-center mb-6">
                    <p className="font-semibold">Status: 
                        <span className={`ml-2 px-3 py-1 rounded-full text-sm ${
                            status === 'connected' ? 'bg-green-100 text-green-800' : 
                            status === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {status === 'connected' && <><i className="fa-solid fa-wifi text-green-500 animate-pulse"></i> Connected</>}
                            {status === 'connecting' && 'Connecting...'}
                            {status === 'idle' && 'Idle'}
                            {status === 'error' && 'Error'}
                        </span>
                    </p>
                </div>

                {/* Reading Practice Mode: Static Text + Normal Chat */}
                {selectedMode === ConversationMode.READING_PRACTICE && transcripts.length > 0 ? (
                    <div className="space-y-3">
                        {/* Reading Text (Pinned - Static) */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold">A</div>
                                <h4 className="font-bold text-gray-800">Text to Read:</h4>
                                <div className="ml-auto flex items-center gap-2 text-sm text-blue-600">
                                    <i className="fa-solid fa-book-open"></i>
                                    <span>Scroll down to see chat</span>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm text-lg leading-relaxed">
                                {currentReadingText || 'Waiting for Alex to provide text...'}
                            </div>

                            {/* I'm Done Reading Button */}
                            {status === 'connected' && (
                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={() => {
                                            // Create a manual transcript entry to signal completion
                                            setTranscripts(prev => [...prev, {
                                                id: Date.now(),
                                                speaker: 'user',
                                                text: 'Fertig'
                                            }]);
                                        }}
                                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-check-circle"></i>
                                        <span>I'm Done Reading</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Normal Chat (All Messages - Scrollable) */}
                        <div ref={transcriptContainerRef} className="h-96 bg-gray-200 rounded-lg p-4 overflow-y-auto space-y-4">
                            {transcripts.map((t) => (
                                <div key={t.id} className={`flex items-start gap-3 ${t.speaker === 'user' ? 'justify-end' : ''}`}>
                                    {t.speaker === 'model' && <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold">A</div>}
                                    <div className={`p-3 rounded-lg max-w-sm ${t.speaker === 'model' ? 'bg-white shadow-sm' : 'bg-blue-600 text-white'}`}>
                                        {t.text}
                                    </div>
                                     {t.speaker === 'user' && <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-gray-600"><i className="fa-solid fa-user"></i></div>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Normal Chat View for All Other Modes */
                    <div ref={transcriptContainerRef} className="h-96 bg-gray-200 rounded-lg p-4 overflow-y-auto space-y-4">
                        {transcripts.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                               <i className="fa-solid fa-comments text-5xl mb-4"></i>
                               <p>Your conversation will appear here.</p>
                               <p className="text-sm">Press "Start Conversation" to begin.</p>
                            </div>
                        )}
                        {transcripts.map((t) => (
                            <div key={t.id} className={`flex items-start gap-3 ${t.speaker === 'user' ? 'justify-end' : ''}`}>
                                {t.speaker === 'model' && <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white font-bold">A</div>}
                                <div className={`p-3 rounded-lg max-w-sm ${t.speaker === 'model' ? 'bg-white shadow-sm' : 'bg-blue-600 text-white'}`}>
                                    {t.text}
                                </div>
                                 {t.speaker === 'user' && <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-gray-600"><i className="fa-solid fa-user"></i></div>}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Feedback Modal */}
            {showFeedback && feedback && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowFeedback(false)}>
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2">Conversation Feedback</h2>
                                    <p className="text-blue-100">Here's how you did!</p>
                                </div>
                                <button
                                    onClick={() => setShowFeedback(false)}
                                    className="text-white hover:bg-white/20 rounded-full p-2 transition"
                                >
                                    <i className="fa-solid fa-times text-xl"></i>
                                </button>
                            </div>
                            {/* Overall Score */}
                            <div className="mt-6 flex items-center gap-4">
                                <div className="text-6xl font-bold">{feedback.overall_score}</div>
                                <div className="flex-1">
                                    <div className="text-sm text-blue-100 mb-1">Overall Score</div>
                                    <div className="bg-white/20 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-white h-full rounded-full transition-all"
                                            style={{ width: `${feedback.overall_score}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Encouragement */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="text-3xl">🎉</div>
                                    <p className="text-gray-700 flex-1">{feedback.encouragement}</p>
                                </div>
                            </div>

                            {/* Strengths */}
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-star text-yellow-500"></i>
                                    Strengths
                                </h3>
                                <ul className="space-y-2">
                                    {feedback.strengths.map((strength, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <i className="fa-solid fa-check-circle text-green-500 mt-1"></i>
                                            <span className="text-gray-700">{strength}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Areas for Improvement */}
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-arrow-up text-blue-500"></i>
                                    Areas for Improvement
                                </h3>
                                <ul className="space-y-2">
                                    {feedback.areas_for_improvement.map((area, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <i className="fa-solid fa-lightbulb text-amber-500 mt-1"></i>
                                            <span className="text-gray-700">{area}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Grammar Corrections */}
                            {feedback.grammar_corrections && feedback.grammar_corrections.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-spell-check text-purple-500"></i>
                                        Grammar Corrections
                                    </h3>
                                    <div className="space-y-3">
                                        {feedback.grammar_corrections.map((correction, idx) => (
                                            <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div className="grid md:grid-cols-2 gap-3 mb-2">
                                                    <div>
                                                        <div className="text-xs text-gray-500 mb-1">You said:</div>
                                                        <div className="text-red-600 line-through">{correction.original}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500 mb-1">Should be:</div>
                                                        <div className="text-green-600 font-medium">{correction.corrected}</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600 mt-2">
                                                    <i className="fa-solid fa-info-circle text-blue-500 mr-1"></i>
                                                    {correction.explanation}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Vocabulary Suggestions */}
                            {feedback.vocabulary_suggestions && feedback.vocabulary_suggestions.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-book text-indigo-500"></i>
                                        Vocabulary Suggestions
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {feedback.vocabulary_suggestions.map((word, idx) => (
                                            <span key={idx} className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                                                {word}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Fluency Notes */}
                            {feedback.fluency_notes && (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-comments text-teal-500"></i>
                                        Fluency Assessment
                                    </h3>
                                    <p className="text-gray-700 leading-relaxed">{feedback.fluency_notes}</p>
                                </div>
                            )}

                            {/* Close Button */}
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={() => setShowFeedback(false)}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:shadow-lg transition"
                                >
                                    Got it! Thanks!
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Conversation History Section */}
            <div className="max-w-3xl mx-auto mt-12">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <i className="fa-solid fa-history text-blue-600"></i>
                    Conversation History
                </h2>

                {isLoadingHistory ? (
                    <div className="flex justify-center items-center py-12">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-600"></i>
                    </div>
                ) : conversationHistory.length === 0 ? (
                    <Card className="bg-gray-50 text-center py-12">
                        <i className="fa-solid fa-folder-open text-5xl text-gray-400 mb-4"></i>
                        <p className="text-gray-600 text-lg">No past conversations yet.</p>
                        <p className="text-gray-500 text-sm mt-2">Start your first conversation to see your progress!</p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {conversationHistory.map((session) => (
                            <ConversationHistoryCard key={session.id} session={session} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversationPage;