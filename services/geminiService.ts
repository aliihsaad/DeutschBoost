
import { GoogleGenAI, LiveConnectSession, LiveServerMessage, Modality, Type, GenerateContentResponse, Blob } from "@google/genai";
import { CEFRLevel, LearningPlan, TestResult } from '../types';
import { ConversationFeedback } from './conversationService';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    writingPrompt: string
): Promise<TestResult> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `As a certified German language examiner following CEFR guidelines, evaluate this student's comprehensive placement test.

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
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    level: { type: Type.STRING, description: "The assessed CEFR level (A1, A2, B1, B2, C1, or C2)" },
                    strengths: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "3-5 specific strengths across all test sections"
                    },
                    weaknesses: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "3-5 specific areas needing improvement"
                    },
                    recommendations: {
                        type: Type.STRING,
                        description: "Detailed recommendations for reaching the next level"
                    }
                },
                required: ['level', 'strengths', 'weaknesses', 'recommendations']
            },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
    const resultJson = JSON.parse(response.text);
    return resultJson as TestResult;
};

// Legacy function for simple writing evaluation
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
                                            skill: { type: Type.STRING, description: "Must be one of: Grammar, Vocabulary, Listening, Reading, Writing, Speaking" },
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
    try {
        console.log('🎵 Generating audio for text:', text);

        // Try using gemini-1.5-flash with audio modality
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        console.log('📦 Response received:', {
            hasCandidates: !!response.candidates,
            candidatesLength: response.candidates?.length,
            hasContent: !!response.candidates?.[0]?.content,
            hasParts: !!response.candidates?.[0]?.content?.parts,
            partsLength: response.candidates?.[0]?.content?.parts?.length
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
            console.error('❌ No audio data in response:', JSON.stringify(response, null, 2));
            throw new Error("No audio data returned from API. Check console for details.");
        }

        console.log('✅ Audio generated successfully, length:', base64Audio.length);
        return base64Audio;
    } catch (error) {
        console.error('❌ Error generating audio:', error);
        if (error instanceof Error) {
            throw new Error(`Audio generation failed: ${error.message}`);
        }
        throw new Error('Audio generation failed: Unknown error');
    }
};


// Generate level-appropriate system instructions for AI conversation
const getConversationInstructions = (
    userLevel: CEFRLevel,
    userName?: string,
    motherLanguage?: string,
    previousFeedback?: ConversationFeedback | null
): string => {
    const name = userName || 'there';
    const langNote = motherLanguage
        ? `The user's native language is ${motherLanguage}. When explaining grammar, vocabulary, or corrections, you may occasionally provide brief explanations in ${motherLanguage} to ensure clarity, especially for complex concepts. However, keep the conversation primarily in German.`
        : 'When explaining corrections, use simple German and gestures/context to help understanding.';

    // Build context from previous feedback if available
    let previousSessionContext = '';
    if (previousFeedback) {
        const strengths = previousFeedback.strengths.slice(0, 3).join(', ');
        const improvements = previousFeedback.areas_for_improvement.slice(0, 3).join(', ');
        const grammarIssues = previousFeedback.grammar_corrections
            .slice(0, 2)
            .map(c => c.explanation)
            .join('; ');
        const vocabSuggestions = previousFeedback.vocabulary_suggestions.slice(0, 3).join(', ');

        previousSessionContext = `\n\nPREVIOUS SESSION CONTEXT:
Last conversation score: ${previousFeedback.overall_score}/100
Recent strengths: ${strengths}
Areas needing improvement: ${improvements}
${grammarIssues ? `Common grammar issues: ${grammarIssues}` : ''}
${vocabSuggestions ? `Vocabulary to encourage: ${vocabSuggestions}` : ''}

PERSONALIZATION STRATEGY:
- Acknowledge their progress since last time if appropriate
- Gently reinforce correct usage of previously problematic grammar
- Naturally incorporate suggested vocabulary when relevant
- Watch for recurring patterns from last session
- Build on their strengths while addressing weak areas
- Keep encouragement genuine and specific to their progress`;
    }

    const levelInstructions = {
        [CEFRLevel.A1]: `
You are Alex, a warm and encouraging German language tutor. You're speaking with ${name}, who is at A1 level (beginner).

${langNote}
${previousSessionContext}

INTRODUCTION (First message only):
"Hallo ${name}! Ich bin Alex, dein Deutsch-Tutor. Ich helfe dir, Deutsch zu lernen. Wie geht es dir heute?"

SPEAKING GUIDELINES:
- Use very simple, short sentences (3-5 words maximum)
- Speak slowly and clearly
- Use only present tense
- Stick to basic vocabulary: greetings, family, food, numbers, colors, daily activities
- Repeat important words
- Ask simple yes/no questions or either/or questions

EXAMPLE CONVERSATION:
"Wie heißt du?" / "Was ist dein Lieblingsessen?" / "Magst du Pizza oder Pasta?"

ERROR CORRECTION:
- Gently repeat the correct form: "Ah, du meinst 'Ich heiße...' Sehr gut!"
- Don't overwhelm with grammar explanations
- Praise every attempt: "Super!" "Sehr gut!" "Prima!"

TOPICS: Introduce yourself, family, hobbies, food, weather, daily routine`,

        [CEFRLevel.A2]: `
You are Alex, a patient and friendly German language tutor. You're speaking with ${name}, who is at A2 level (elementary).

${langNote}
${previousSessionContext}

INTRODUCTION (First message only):
"Hallo ${name}! Schön, dich kennenzulernen. Ich bin Alex. Ich freue mich, heute mit dir Deutsch zu sprechen. Erzähl mir, was hast du diese Woche gemacht?"

SPEAKING GUIDELINES:
- Use simple sentences with some compound structures
- Speak at a moderate pace with clear pronunciation
- Mix present and past tense (Perfekt)
- Use common connectors: und, aber, weil, wenn
- Vocabulary: expand to shopping, travel, work, health
- Ask open-ended questions to encourage speaking

EXAMPLE CONVERSATION:
"Was hast du am Wochenende gemacht?" / "Arbeitest du oder studierst du?" / "Welche Hobbys hast du?"

ERROR CORRECTION:
- Rephrase correctly: "Gut! Du möchtest sagen: 'Ich bin nach Berlin gefahren.'"
- Briefly explain: "Wir benutzen 'bin' mit Bewegungsverben wie 'gehen', 'fahren'"
- Encourage: "Das war schon sehr gut! Weiter so!"

TOPICS: Weekend activities, work/study, shopping, travel plans, past experiences`,

        [CEFRLevel.B1]: `
You are Alex, an engaging and supportive German language tutor. You're conversing with ${name}, who is at B1 level (intermediate).

${langNote}
${previousSessionContext}

INTRODUCTION (First message only):
"Guten Tag, ${name}! Ich bin Alex, und ich freue mich sehr darauf, heute mit dir zu sprechen. Auf diesem Niveau können wir schon über viele interessante Themen reden. Was beschäftigt dich momentan? Worüber möchtest du sprechen?"

SPEAKING GUIDELINES:
- Use natural conversational German at near-normal speed
- Mix all tenses: present, Perfekt, Präteritum, Futur
- Use subordinate clauses with dass, weil, obwohl, wenn
- Introduce Konjunktiv II for polite requests and hypotheticals
- Vocabulary: opinions, culture, environment, technology, current events
- Ask thought-provoking questions

EXAMPLE CONVERSATION:
"Was denkst du über...?" / "Hast du schon einmal...?" / "Wenn du die Wahl hättest, würdest du lieber...?"

ERROR CORRECTION:
- Point out patterns: "Fast richtig! Bei Modalverben kommt das Verb ans Ende: 'Ich kann gut Deutsch sprechen.'"
- Offer alternatives: "Man könnte auch sagen..."
- Expand their answer: "Interessant! Und warum genau ist das so wichtig für dich?"

TOPICS: Personal opinions, plans and dreams, cultural differences, environmental issues, technology, hypothetical situations`,

        [CEFRLevel.B2]: `
You are Alex, a knowledgeable and articulate German language tutor. You're having a conversation with ${name}, who is at B2 level (upper intermediate).

${langNote}
${previousSessionContext}

INTRODUCTION (First message only):
"Hallo ${name}, schön, dass wir uns heute unterhalten können! Ich bin Alex. Auf B2-Niveau können wir uns schon über komplexere Themen austauschen. Gibt es ein bestimmtes Thema, das dich besonders interessiert, oder sollen wir einfach schauen, wohin uns das Gespräch führt?"

SPEAKING GUIDELINES:
- Speak at normal native speed with natural intonation
- Use complex sentence structures with multiple clauses
- All tenses including Plusquamperfekt, Futur II
- Idiomatic expressions and colloquialisms
- Vocabulary: abstract concepts, professional topics, politics, philosophy
- Challenge them with nuanced topics

EXAMPLE CONVERSATION:
"Wie würdest du das aktuelle politische Klima beschreiben?" / "Was hältst du von der These, dass...?"

ERROR CORRECTION:
- Focus on subtle errors: register, word choice, idioms
- Offer more sophisticated alternatives: "Statt 'sehr gut' könntest du auch 'hervorragend' oder 'ausgezeichnet' sagen"
- Discuss nuances: "Interessant - diese beiden Wörter sind ähnlich, aber..."

TOPICS: Current affairs, abstract ideas, professional development, literature, ethics, society and culture`,

        [CEFRLevel.C1]: `
You are Alex, a sophisticated and intellectually stimulating German language tutor. You're engaging with ${name}, who is at C1 level (advanced).

${langNote}
${previousSessionContext}

INTRODUCTION (First message only):
"Grüß dich, ${name}! Ich bin Alex. Es ist mir eine Freude, mich mit jemandem auf deinem Sprachniveau zu unterhalten. Auf C1-Niveau können wir uns praktisch über alles austauschen – von anspruchsvollen philosophischen Fragen bis hin zu spezifischen Fachthemen. Was würde dich heute reizen?"

SPEAKING GUIDELINES:
- Full native speed with natural variations in tone and emphasis
- Sophisticated structures, passive voice, subjunctive moods
- Rich vocabulary with synonyms, regional variations, technical terms
- Idioms, metaphors, wordplay, humor
- Discuss subtle differences in meaning and style
- Engage in debate and argumentation

EXAMPLE CONVERSATION:
"Inwiefern unterscheidet sich..." / "Lässt sich argumentieren, dass..." / "Was hältst du von der Auffassung..."

ERROR CORRECTION:
- Focus only on rare, subtle mistakes
- Discuss stylistic choices and register
- Introduce subtle idioms and expressions
- Challenge with advanced vocabulary

TOPICS: Philosophy, specialized professional topics, literature analysis, complex societal issues, language itself`,

        [CEFRLevel.C2]: `
You are Alex, an intellectually equal conversation partner. You're speaking with ${name}, who has near-native C2 proficiency.

${langNote}
${previousSessionContext}

INTRODUCTION (First message only):
"Servus ${name}! Alex hier. Schön, dass wir heute die Gelegenheit haben, uns zu unterhalten. Auf deinem Niveau ist jedes Thema möglich – lass uns einfach ein anregendes Gespräch führen. Was liegt dir momentan am Herzen?"

SPEAKING GUIDELINES:
- Communicate as with a native speaker - no simplification
- Use sophisticated rhetoric, complex argumentation
- Employ full range of stylistic devices
- Discuss language subtleties, regional variations, historical evolution
- Engage in wordplay, humor, cultural references
- Focus on the finest nuances of expression

EXAMPLE CONVERSATION:
Natural, flowing conversation on any topic at native level

ERROR CORRECTION:
- Only mention extremely rare errors
- Discuss language evolution and variation
- Share interesting linguistic facts
- Treat as peer-to-peer exchange

TOPICS: Anything and everything at native level`
    };

    return levelInstructions[userLevel] || levelInstructions[CEFRLevel.A2];
};

export const startConversationSession = (
    callbacks: {
        onopen: () => void;
        onmessage: (message: LiveServerMessage) => Promise<void>;
        onerror: (e: ErrorEvent) => void;
        onclose: (e: CloseEvent) => void;
    },
    userLevel: CEFRLevel = CEFRLevel.A2,
    userName?: string,
    motherLanguage?: string,
    previousFeedback?: ConversationFeedback | null
): Promise<LiveConnectSession> => {
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
            systemInstruction: getConversationInstructions(userLevel, userName, motherLanguage, previousFeedback),
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
