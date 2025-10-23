import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LiveConnectSession, LiveServerMessage } from '@google/genai';
import { startConversationSession, decode, decodeAudioData, createPcmBlob } from '../services/geminiService';
import { Transcript } from '../types';
import Card from '../components/Card';
import { useAuth } from '../src/contexts/AuthContext';
import { CEFRLevel } from '../types';

const ConversationPage: React.FC = () => {
    const { userData, userProfile } = useAuth();
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    
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
    
    useEffect(() => {
        if (transcriptContainerRef.current) {
            transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
    }, [transcripts]);

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
        setStatus('connecting');
        setTranscripts([]);
        try {
            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
             if (!inputAudioContextRef.current) {
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Get user's level, name, and mother language for personalized conversation
            const userLevel = userProfile?.current_level || CEFRLevel.A2;
            const userName = userData?.full_name?.split(' ')[0]; // First name only
            const motherLanguage = userProfile?.mother_language;

            sessionPromiseRef.current = startConversationSession({
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
                    console.error("Session error:", e);
                    setStatus('error');
                },
                onclose: () => {
                    // This can be handled if needed, but stopping handles cleanup.
                },
            }, userLevel, userName, motherLanguage);

        } catch (err) {
            console.error("Failed to start conversation:", err);
            setStatus('error');
        }
    };
    
    const stopConversation = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        return () => {
            stopConversation();
        };
    }, [stopConversation]);

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

            <Card className="max-w-3xl mx-auto">
                <div className="flex justify-center items-center mb-6 space-x-4">
                    {status === 'idle' || status === 'error' ? (
                         <button onClick={startConversation} className="bg-green-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-700 transition shadow-lg flex items-center space-x-2">
                             <i className="fa-solid fa-microphone-alt"></i>
                             <span>Start Conversation</span>
                         </button>
                    ): (
                        <button onClick={stopConversation} className="bg-red-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-700 transition shadow-lg flex items-center space-x-2">
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
            </Card>
        </div>
    );
};

export default ConversationPage;