
import { GoogleGenAI, LiveConnectSession, LiveServerMessage, Modality, Type, GenerateContentResponse, Blob } from "@google/genai";
import { CEFRLevel, LearningPlan, TestResult } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePlacementTest = async (level: CEFRLevel): Promise<GenerateContentResponse> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a single multiple-choice German reading comprehension (Lesen) question for a ${level} CEFR level exam. The question should resemble a Goethe-Zertifikat or TELC exam format. Provide a short text (2-3 sentences), a question about the text, and three possible answers (A, B, C).`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: 'The German text for reading comprehension.' },
                    question: { type: Type.STRING, description: 'The question about the text.' },
                    options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'An array of three possible answers (A, B, C).'
                    },
                    correctOptionIndex: { type: Type.INTEGER, description: 'The 0-based index of the correct answer in the options array.' }
                },
                required: ['text', 'question', 'options', 'correctOptionIndex']
            }
        }
    });
    return response;
};

export const evaluateWriting = async (prompt: string, userText: string): Promise<TestResult> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `As a certified German language examiner, please evaluate the following text written by a student.
        Writing Prompt: "${prompt}"
        Student's text: "${userText}"
        
        Analyze the text based on CEFR criteria (grammar, vocabulary, coherence, task achievement).
        Provide a detailed evaluation and assign a CEFR level.
        `,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    level: { type: Type.STRING, description: "The assessed CEFR level (e.g., A1, A2, B1)." },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of strengths in the user's writing." },
                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of areas for improvement." },
                    recommendations: { type: Type.STRING, description: "A summary of recommendations for the user." }
                },
                required: ['level', 'strengths', 'weaknesses', 'recommendations']
            },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
    const resultJson = JSON.parse(response.text);
    return resultJson as TestResult;
};


export const generateLearningPlan = async (evaluation: TestResult): Promise<LearningPlan> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Based on this student's German language evaluation, create a personalized 4-week learning plan to help them reach the next CEFR level.
        Current Level: ${evaluation.level}
        Strengths: ${evaluation.strengths.join(', ')}
        Weaknesses: ${evaluation.weaknesses.join(', ')}
        
        The plan should be structured, focusing on improving their weak areas. Include specific grammar topics, vocabulary themes, and practice types for each week.
        `,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    level: { type: Type.STRING, description: "The target CEFR level for this plan." },
                    goals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top-level goals for the user." },
                    weeks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                week: { type: Type.INTEGER },
                                focus: { type: Type.STRING },
                                items: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            topic: { type: Type.STRING },
                                            skill: { type: Type.STRING, description: "e.g., Grammar, Vocabulary, Listening" },
                                            description: { type: Type.STRING },
                                        },
                                        required: ['topic', 'skill', 'description']
                                    }
                                }
                            },
                            required: ['week', 'focus', 'items']
                        }
                    }
                },
                required: ['level', 'goals', 'weeks']
            },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
    
    const parsedJson = JSON.parse(response.text);
    // Add 'completed' field to each item
    parsedJson.weeks.forEach((week: any) => {
        week.items.forEach((item: any) => {
            item.completed = false;
        });
    });

    return parsedJson as LearningPlan;
};


export const generateSpokenAudio = async (text: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `In a clear, standard German accent, please say: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Failed to generate audio.");
    }
    return base64Audio;
};


export const startConversationSession = (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => Promise<void>;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}): Promise<LiveConnectSession> => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: 'You are a friendly and patient German language tutor named Alex. Your goal is to help me practice my conversational German. Speak clearly in German, and if I make a mistake, gently correct me and explain why. Keep the conversation engaging and related to everyday topics.',
        },
    });
};

// Audio decoding utilities
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// Audio encoding utilities
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
