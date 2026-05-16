
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CEFRLevel, LearningPlan, TestResult } from '../types';
import type { AiProvider } from '../src/domain/ai/aiProvider';
import { createGeminiAiProvider, type GeminiClientLike } from '../src/domain/ai/geminiProvider';
import { generateJsonWithProvider } from '../src/domain/ai/jsonGeneration';

let geminiClient: GoogleGenAI | null = null;

function getGeminiApiKey(): string | undefined {
    return process.env.API_KEY || process.env.GEMINI_API_KEY;
}

export function getGeminiAiClient(): GoogleGenAI {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
        throw new Error('No AI provider is configured. Add an OpenRouter API key in Settings before using AI generation.');
    }

    if (!geminiClient) {
        geminiClient = new GoogleGenAI({ apiKey });
    }

    return geminiClient;
}

export const ai = {
    get models() {
        return getGeminiAiClient().models;
    },
} as GoogleGenAI;

const createDefaultGeminiServiceAiProvider = () => createGeminiAiProvider({
    client: getGeminiAiClient() as unknown as GeminiClientLike,
});

const generateGeminiServiceJson = <T>(
    aiProvider: AiProvider,
    feature: string,
    schemaName: string,
    prompt: string
): Promise<T> => {
    return generateJsonWithProvider<T>(aiProvider, {
        feature,
        schemaName,
        messages: [
            {
                role: 'user',
                content: prompt,
            },
        ],
        options: {
            model: 'gemini-2.5-pro',
        },
    });
};

// Generate reading comprehension question
export const generateReadingQuestion = async (level: CEFRLevel): Promise<GenerateContentResponse> => {
    const levelGuidance = {
        [CEFRLevel.A1]: 'very simple text with basic vocabulary (family, food, numbers), present tense only, 2-3 sentences',
        [CEFRLevel.A2]: 'simple text about everyday topics (shopping, work, hobbies), present and perfect tense, 3-4 sentences',
        [CEFRLevel.B1]: 'text about opinions, travel, or experiences with some complex sentences, 4-5 sentences',
        [CEFRLevel.B2]: 'text with abstract concepts, idiomatic expressions, and complex structures, 5-6 sentences',
        [CEFRLevel.C1]: 'sophisticated text with nuanced arguments and advanced vocabulary, 6-7 sentences',
        [CEFRLevel.C2]: 'highly complex text with subtle meanings and native-level expressions, 7-8 sentences'
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a multiple-choice German reading comprehension question for ${level} CEFR level.

Guidelines for ${level}:
${levelGuidance[level]}

The question should test reading comprehension authentically. Provide:
- A German text appropriate for the level
- A question in German about the text (asking about main idea, detail, or inference)
- Four possible answers in German
- Make sure only ONE answer is clearly correct

Format like Goethe-Zertifikat exams.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: 'The German text for reading comprehension.' },
                    question: { type: Type.STRING, description: 'The question about the text in German.' },
                    options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'An array of four possible answers in German.'
                    },
                    correctOptionIndex: { type: Type.INTEGER, description: 'The 0-based index of the correct answer.' }
                },
                required: ['text', 'question', 'options', 'correctOptionIndex']
            }
        }
    });
    return response;
};

// Generate grammar question
export const generateGrammarQuestion = async (level: CEFRLevel): Promise<GenerateContentResponse> => {
    const grammarTopics = {
        [CEFRLevel.A1]: 'present tense, articles (der/die/das), basic word order, or simple pronouns',
        [CEFRLevel.A2]: 'perfect tense, dative/accusative prepositions, modal verbs, or possessive pronouns',
        [CEFRLevel.B1]: 'past tense (Präteritum), subordinate clauses (weil, dass), or two-way prepositions',
        [CEFRLevel.B2]: 'subjunctive II (Konjunktiv II), passive voice, or relative clauses',
        [CEFRLevel.C1]: 'Plusquamperfekt, participle constructions, or subjunctive I',
        [CEFRLevel.C2]: 'subtle modal particles, advanced conjunctions, or stylistic variations'
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a multiple-choice German grammar question for ${level} CEFR level.

Topic for ${level}: ${grammarTopics[level]}

Provide:
- A German sentence with a blank (use _____ for the blank)
- A question asking what belongs in the blank
- Four possible answers
- Make sure only ONE answer is grammatically correct

The question should test authentic grammar usage, not just memorization.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    sentence: { type: Type.STRING, description: 'German sentence with a blank (_____)'  },
                    question: { type: Type.STRING, description: 'Question asking what belongs in the blank' },
                    options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Four possible answers'
                    },
                    correctOptionIndex: { type: Type.INTEGER, description: '0-based index of correct answer' }
                },
                required: ['sentence', 'question', 'options', 'correctOptionIndex']
            }
        }
    });
    return response;
};

// Legacy function for backward compatibility
export const generatePlacementTest = generateReadingQuestion;

// Evaluate comprehensive placement test
export const evaluateComprehensivePlacementTest = async (
    readingScore: number,
    grammarScore: number,
    writingText: string,
    writingPrompt: string,
    aiProvider?: AiProvider
): Promise<TestResult> => {
    return generateGeminiServiceJson<TestResult>(
        aiProvider ?? createDefaultGeminiServiceAiProvider(),
        'placement test evaluation',
        'TestResult',
        `As a certified German language examiner following CEFR guidelines, evaluate this student's comprehensive placement test.

READING COMPREHENSION: ${readingScore}/5 questions correct
GRAMMAR: ${grammarScore}/5 questions correct
WRITING SAMPLE:
Prompt: "${writingPrompt}"
Student's text: "${writingText}"

Analyze all three sections to determine the student's overall CEFR level (A1, A2, B1, B2, C1, or C2).

Consider:
- Reading/Grammar scores indicate receptive skills
- Writing quality indicates productive skills
- Final level should reflect consistent performance across all areas
- Be accurate and realistic - don't over-inflate the level

Provide detailed feedback on strengths, weaknesses, and specific recommendations for improvement.`,
    );
};

// Legacy function for simple writing evaluation
export const evaluateWriting = async (
    prompt: string,
    userText: string,
    aiProvider?: AiProvider
): Promise<TestResult> => {
    return generateGeminiServiceJson<TestResult>(
        aiProvider ?? createDefaultGeminiServiceAiProvider(),
        'writing evaluation',
        'TestResult',
        `As a certified German language examiner, please evaluate the following text written by a student.
        Writing Prompt: "${prompt}"
        Student's text: "${userText}"

        Analyze the text based on CEFR criteria (grammar, vocabulary, coherence, task achievement).
        Provide a detailed evaluation and assign a CEFR level.
        `
    );
};


export const generateLearningPlan = async (
    evaluation: TestResult,
    aiProvider?: AiProvider
): Promise<LearningPlan> => {
    const parsedJson = await generateGeminiServiceJson<LearningPlan>(
        aiProvider ?? createDefaultGeminiServiceAiProvider(),
        'learning plan',
        'LearningPlan',
        `Based on this student's German language evaluation, create a personalized 4-week learning plan to help them reach the next CEFR level.
        Current Level: ${evaluation.level}
        Strengths: ${evaluation.strengths.join(', ')}
        Weaknesses: ${evaluation.weaknesses.join(', ')}
        
        The plan should be structured, focusing on improving their weak areas. Include specific grammar topics, vocabulary themes, and practice types for each week.
        `
    );
    // Add 'completed' field to each item
    if (parsedJson.weeks) {
        parsedJson.weeks.forEach((week: any) => {
            if (week.items) {
                week.items.forEach((item: any) => {
                    item.completed = false;
                });
            }
        });
    }

    return parsedJson;
};


/**
 * Generate spoken audio using browser's Web Speech API
 * This is more reliable and free compared to Gemini TTS API
 * Returns a promise that resolves when speech is ready
 */
export const speakText = (text: string, lang: string = 'de-DE'): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
            reject(new Error('Speech synthesis not supported in this browser'));
            return;
        }

        console.log('🎵 Speaking text:', text, 'in language:', lang);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9; // Slightly slower for language learning
        utterance.pitch = 1.0;

        // Try to find a German voice
        const voices = window.speechSynthesis.getVoices();
        const germanVoice = voices.find(voice =>
            voice.lang.startsWith('de') || voice.lang.startsWith('de-DE')
        );

        if (germanVoice) {
            utterance.voice = germanVoice;
            console.log('✅ Using German voice:', germanVoice.name);
        } else {
            console.log('⚠️ No German voice found, using default');
        }

        utterance.onend = () => {
            console.log('✅ Speech finished');
            resolve();
        };

        utterance.onerror = (event) => {
            console.error('❌ Speech error:', event);
            reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        window.speechSynthesis.speak(utterance);
    });
};

