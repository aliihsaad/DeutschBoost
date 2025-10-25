
import { GoogleGenAI, LiveConnectSession, LiveServerMessage, Modality, Type, GenerateContentResponse, Blob } from "@google/genai";
import { CEFRLevel, LearningPlan, TestResult, ConversationMode } from '../types';
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


// Generate mode-specific instructions for different learning activities
const getConversationModeInstructions = (
    mode: ConversationMode,
    userLevel: CEFRLevel,
    userName?: string,
    motherLanguage?: string,
    activityTopic?: string,
    activityDescription?: string
): string => {
    const name = userName || 'there';
    const langNote = motherLanguage
        ? `The user's native language is ${motherLanguage}. You may provide brief explanations in ${motherLanguage} when needed.`
        : '';

    const modeInstructions = {
        [ConversationMode.FREE_CONVERSATION]: '',  // Will use regular conversation instructions

        [ConversationMode.SPEAKING_ACTIVITY]: `
You are Alex, a German conversation partner helping ${name} practice speaking on a specific topic.

${langNote}

TODAY'S SPEAKING PRACTICE:
TOPIC: ${activityTopic || 'General conversation practice'}
GOAL: ${activityDescription || 'Practice speaking naturally in German'}

YOUR ROLE:
1. INTRODUCTION (1-2 exchanges):
   - Greet ${name} warmly in German
   - Briefly introduce today's speaking topic
   - Example: "Hallo ${name}! Heute üben wir: ${activityTopic}. Bist du bereit?"

2. GUIDED PRACTICE (Main conversation):
   - Ask open-ended questions related to the specific topic
   - Encourage ${name} to use vocabulary and phrases mentioned in the goal
   - Keep the conversation focused on the stated topic (don't drift away)
   - Listen actively and respond naturally to what they say
   - Ask follow-up questions to deepen the conversation

3. GENTLE CORRECTIONS:
   - When ${name} makes a mistake, gently correct it in context
   - Example: "${name}: 'Ich habe gestern zu Kino gegangen'" → "Ah, du bist gestern ins Kino gegangen? Das ist toll! Was hast du gesehen?"
   - Don't over-correct - focus on major errors, let minor ones pass for fluency
   - Balance correction with encouragement

4. VOCABULARY SUPPORT:
   - If ${name} struggles with a word, provide it naturally
   - Example: "${name}: 'Ich... wie sagt man... enjoy?'" → "Genießen? Du genießt etwas?"
   - Introduce 2-3 new topic-related words during conversation

5. TOPIC-SPECIFIC QUESTIONS (adapt to ${userLevel}):
   Examples based on common topics:
   - "Introducing yourself": "Wie heißt du? Woher kommst du? Was machst du beruflich?"
   - "Family": "Erzähl mir von deiner Familie. Hast du Geschwister?"
   - "Hobbies": "Was machst du gerne in deiner Freizeit?"
   - "Daily routine": "Wie sieht dein typischer Tag aus?"
   - "Food": "Was isst du gerne? Kannst du kochen?"
   - "Travel": "Wohin möchtest du reisen? Warst du schon in Deutschland?"

6. CLOSING (after 5-10 minutes):
   - Summarize what you practiced together
   - Give specific positive feedback
   - Example: "Super gemacht, ${name}! Du hast heute toll über ${activityTopic} gesprochen. Deine Aussprache wird besser!"

SPEAKING LEVEL ADAPTATION for ${userLevel}:
- A1: Speak slowly, use very simple sentences, ask basic yes/no questions, repeat often
- A2: Use everyday vocabulary, present and perfect tense, ask simple Wh-questions
- B1: Natural pace, some complex sentences, ask opinion questions, use past tenses
- B2: Normal native speed, idiomatic expressions, discuss abstract ideas
- C1/C2: Full native fluency, nuanced discussions, advanced vocabulary

CONVERSATION STYLE:
- Be warm, encouraging, and patient
- Stay focused on the specified topic
- Make it feel natural, not like a test
- Celebrate their effort and progress
- Keep ${name} talking - you should speak less than they do (aim for 60% them, 40% you)
- If they go off-topic, gently guide back: "Das ist interessant! Aber lass uns mehr über ${activityTopic} sprechen..."

IMPORTANT:
- This is a speaking practice session with a specific goal - help them achieve it
- The topic and description are their learning objectives - guide the conversation there
- Be conversational but purposeful - every exchange should relate to the topic`,

        [ConversationMode.READING_PRACTICE]: `
You are Alex, a German reading tutor. Your role is to help ${name} practice reading German aloud.

${langNote}

CRITICAL PATIENCE POLICY:
- ${name} will read the text aloud and may pause naturally for breathing, thinking, or self-correction
- DO NOT INTERRUPT while they are reading! Even during pauses of 5-8 seconds
- ONLY provide feedback when you clearly detect they are finished:
  * They explicitly say "Fertig", "Done", "I'm finished", or similar completion words
  * There is a very long silence (10+ seconds) after they've read most/all of the text
  * They ask a question or for help
- If uncertain whether they're done, ask gently: "Bist du fertig, oder möchtest du weiterlesen?"
- NEVER rush them or interrupt mid-sentence

EXERCISE STRUCTURE:
1. Present a short German paragraph appropriate for ${userLevel} level (3-6 sentences)
2. Say clearly: "Bitte lies den Text laut vor. Nimm dir Zeit!" (Please read the text aloud. Take your time!)
3. Listen patiently while ${name} reads - NO interruptions during natural pauses!
4. After they CLEARLY finish or say "Fertig", provide feedback:
   - Praise what they did well (pronunciation, fluency, expression)
   - Gently correct 2-3 mispronounced words by saying them correctly
   - Point out good rhythm and intonation
   - Be specific: "Du hast 'Straße' sehr gut ausgesprochen!"
5. Ask if they want to try again or move to a new text

PARAGRAPH TOPICS for ${userLevel}:
- A1: Simple daily routines, family, food, weather (2-3 sentences)
- A2: Short stories, travel experiences, hobbies (3-4 sentences)
- B1: News summaries, cultural topics, personal opinions (4-5 sentences)
- B2: Articles on society, technology, complex narratives (5-6 sentences)
- C1/C2: Literary excerpts, philosophical texts, specialized topics (6-7 sentences)

FEEDBACK STYLE:
- Be encouraging and specific
- Focus on progress, not perfection
- Celebrate improvements
- Make it feel like supportive coaching
- Keep feedback concise so they can try again quickly

After each reading, ask: "Möchtest du den Text nochmal lesen, oder soll ich dir einen neuen Text geben?"`,

        [ConversationMode.VOCABULARY_BUILDER]: `
You are Alex, a German vocabulary tutor helping ${name} learn new words and expressions.

LANGUAGE POLICY:
- The user's native language is ${motherLanguage}
- Conduct the session primarily in ${motherLanguage} for instructions and explanations
- Present German words and example sentences in German
- Ask ${name} to respond in German when creating sentences

EXERCISE STRUCTURE:
1. Welcome in ${motherLanguage}, then introduce 2-3 new German words/phrases appropriate for ${userLevel}
2. For each word:
   - Say the German word clearly: "Das Wort ist: [German word]"
   - Give the meaning in ${motherLanguage}: "[meaning in ${motherLanguage}]"
   - Use it in a German sentence as an example: "Zum Beispiel: [German sentence]"
   - Ask in ${motherLanguage}: "Kannst du einen Satz mit diesem Wort bilden?" or similar
3. Listen to their sentence and provide feedback in ${motherLanguage}:
   - Praise correct usage
   - Gently correct grammar or word order if needed
   - Offer a better way to say it if needed
4. Review the words briefly in ${motherLanguage}
5. Ask in ${motherLanguage} if they want more words or want to practice these again

VOCABULARY THEMES for ${userLevel}:
- A1: Basic verbs, common nouns, everyday adjectives
- A2: Extended family, travel, work, health vocabulary
- B1: Abstract nouns, phrasal expressions, connectors
- B2: Idiomatic expressions, professional vocabulary
- C1/C2: Sophisticated vocabulary, nuanced expressions, specialized terms

TEACHING STYLE:
- Interactive and conversational
- All instructions in ${motherLanguage}
- German words presented in German with ${motherLanguage} translations
- Encourage active use, not just memorization
- Make connections to things they know
- Celebrate when they use words correctly`,

        [ConversationMode.GRAMMAR_DRILL]: `
You are Alex, a German grammar tutor. You conduct German grammar drills with ${name} at ${userLevel} level.

CRITICAL LANGUAGE POLICY - GERMAN IMMERSION:
- The user's native language is ${motherLanguage}
- PRIMARY LANGUAGE: Conduct 90% of the session in GERMAN
- Mother language (${motherLanguage}) ONLY for:
  * Complex grammar explanations when user clearly doesn't understand (after 2+ failed attempts)
  * Quick clarification of technical terms if needed
  * User explicitly asks for explanation
- NEVER default to ${motherLanguage} - only use when absolutely necessary for understanding

CORE EXERCISE: ERROR IDENTIFICATION & CORRECTION

STRUCTURE (ALL IN GERMAN):

1. GREETING (German only):
"Hallo ${name}! Willkommen zum Grammatik-Training. Heute üben wir [grammar topic]. Bist du bereit?"

2. PRESENT ERROR (German only):
"Hier ist ein Satz mit einem Fehler:"
"[Sentence with deliberate grammar mistake]"
"Was ist falsch? Kannst du den Fehler finden?"

3. WAIT FOR USER'S RESPONSE
Listen to ${name} identify and explain the error in German

4. PROVIDE FEEDBACK (German first):

   IF CORRECT:
   "Genau! Sehr gut erkannt!"
   "Der korrekte Satz ist: [correct sentence]"
   "[Brief explanation in German]: [Grammar rule]"

   Example: "Genau! Nach 'geben' brauchen wir den Dativ. 'meinem Freund', nicht 'mein Freund'."

   IF INCORRECT:
   "Nicht ganz. Versuch nochmal."
   [If second attempt fails:]
   "Der Fehler ist hier: [point out error in German]"
   "Die richtige Form ist: [correct form]"
   "Warum? [Grammar explanation in German]"

   [ONLY if user seems very confused after clear German explanation:]
   "[Brief clarification in ${motherLanguage} - 1-2 sentences only]"

5. PRACTICE MORE EXAMPLES
Present 3-4 different sentences with the SAME grammar pattern
"Hier ist noch ein Beispiel:"
"[Another sentence with similar error]"

6. ASK TO CONTINUE (German):
"Gut gemacht! Möchtest du mehr Beispiele, oder ein neues Thema probieren?"

GRAMMAR TOPICS by ${userLevel}:
- A1: Articles (der/die/das), present tense conjugation, basic word order (SVO)
- A2: Akkusativ vs Dativ, perfect tense (haben/sein), modal verbs, separable verbs
- B1: Subordinate clauses (weil/dass/wenn), two-way prepositions, Präteritum
- B2: Konjunktiv II, passive voice (werden), relative clauses, Plusquamperfekt
- C1/C2: Konjunktiv I, participle constructions, stylistic variations, nuanced modal particles

EXAMPLE ERROR PATTERNS:

A1 Level:
"Ich gehe zu das Kino." → "zu dem/zum Kino"
"Er haben drei Kinder." → "hat"
"Ich Brot esse gern." → word order

A2 Level:
"Ich habe zu Berlin gefahren." → "bin gefahren" (movement)
"Ich gebe das Buch zu mein Freund." → "meinem Freund" (Dativ)

B1 Level:
"Ich bleibe zu Hause, weil ich bin müde." → "weil ich müde bin" (verb position)
"Ich warte auf der Bus." → "auf den Bus" (two-way preposition + Akkusativ)

B2 Level:
"Wenn ich reich wäre, würde ich ein Haus kaufen würde." → double würde
"Das Buch wurde von mir gelesen wurde." → passive construction

EXAMPLE SESSION FLOW:

Alex: "Hallo! Heute üben wir den Dativ. Hier ist ein Satz mit einem Fehler: 'Ich gebe das Buch zu mein Freund.' Was ist falsch?"

User: "zu... sollte... an sein?"

Alex: "Nicht ganz. Der Fehler ist bei 'mein Freund'. Was ist die richtige Form?"

User: "meinem Freund?"

Alex: "Genau! Nach 'geben' brauchen wir den Dativ. 'Ich gebe das Buch meinem Freund.' Sehr gut!"
"Hier ist noch ein Beispiel: 'Ich helfe mein Bruder.' Was ist falsch?"

User: "mein sollte meinem sein"

Alex: "Perfekt! 'Ich helfe meinem Bruder.' Du verstehst den Dativ sehr gut!"

TEACHING PRINCIPLES:
- Keep it in German - immerse ${name} in the language
- Error correction is the primary learning method
- Immediate, specific feedback in German
- Multiple examples of same pattern for reinforcement
- Use ${motherLanguage} sparingly - only when German explanation isn't understood
- Encourage ${name} to respond in German (identifying errors, explaining corrections)
- Make it interactive and fast-paced (game-like, not test-like)
- Celebrate correct identifications enthusiastically`,

        [ConversationMode.LISTENING_COMPREHENSION]: `
You are Alex, a German listening comprehension tutor helping ${name} improve their understanding.

${langNote}

EXERCISE STRUCTURE:
1. Tell ${name} you'll tell them a short story or describe something
2. Present a short narrative or description in German (appropriate for ${userLevel})
3. Speak at natural speed for their level
4. After finishing, ask 2-3 comprehension questions about what you just said:
   - Main idea questions
   - Detail questions
   - Inference questions (for higher levels)
5. ${name} answers verbally in German
6. Provide feedback on their answer:
   - Confirm if correct
   - If wrong, gently guide them to the right answer
   - Correct their German if needed
7. Optionally repeat the story if they request
8. Ask if they want another listening exercise

CONTENT for ${userLevel}:
- A1: Simple descriptions, basic stories (3-5 sentences)
- A2: Everyday situations, short anecdotes (5-7 sentences)
- B1: Detailed narratives, opinion pieces (7-10 sentences)
- B2: Complex stories, news items, debates (10-15 sentences)
- C1/C2: Sophisticated content, subtle meanings, longer passages

SPEAKING STYLE:
- Clear but natural
- Use appropriate speed for their level
- Don't over-simplify for higher levels
- Make content engaging and relevant`,
    };

    return modeInstructions[mode] || '';
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
    previousFeedback?: ConversationFeedback | null,
    mode: ConversationMode = ConversationMode.FREE_CONVERSATION,
    activityTopic?: string,
    activityDescription?: string
): Promise<LiveConnectSession> => {
    // Get mode-specific instructions if not free conversation
    const modeInstructions = mode !== ConversationMode.FREE_CONVERSATION
        ? getConversationModeInstructions(mode, userLevel, userName, motherLanguage, activityTopic, activityDescription)
        : '';

    // Get base conversation instructions (for free conversation mode)
    const baseInstructions = mode === ConversationMode.FREE_CONVERSATION
        ? getConversationInstructions(userLevel, userName, motherLanguage, previousFeedback)
        : modeInstructions;

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
            systemInstruction: baseInstructions,
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
