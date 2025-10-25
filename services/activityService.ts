import { ai } from './geminiService';
import { CEFRLevel } from '../types';
import {
  GrammarActivity,
  VocabularyActivity,
  ListeningActivity,
  WritingActivity,
  SpeakingActivity,
  ReadingActivity,
  WritingEvaluation,
  ActivityType,
} from '../src/types/activity.types';

/**
 * Generate a grammar exercise based on topic and level
 */
export const generateGrammarActivity = async (
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<GrammarActivity> => {
  const levelGuidance = {
    A1: 'very basic grammar (present tense, articles, simple word order)',
    A2: 'elementary grammar (perfect tense, modal verbs, basic prepositions)',
    B1: 'intermediate grammar (all tenses, subjunctive mood, relative clauses)',
    B2: 'advanced grammar (passive voice, indirect speech, complex syntax)',
    C1: 'sophisticated grammar (subjunctive II, participle constructions, advanced conjunctions)',
    C2: 'native-level grammar (all grammatical nuances, stylistic variations)',
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a grammar exercise for German learners at ${level} level.

Topic: ${topic}
Description: ${description}
Grammar Level: ${levelGuidance[level]}
User's Native Language: ${motherLanguage}

Generate 5 fill-in-the-blank questions. Each question should have:
- A German sentence with ONE blank (marked as ___)
- 4 multiple choice options (in German)
- The correct answer index (0-3)
- A brief explanation of why the answer is correct (write this explanation in ${motherLanguage})

Return a JSON object with this exact structure:
{
  "topic": "${topic}",
  "level": "${level}",
  "questions": [
    {
      "sentence": "Ich ___ gestern ins Kino gegangen.",
      "blank_position": 1,
      "options": ["habe", "bin", "war", "hatte"],
      "correct_option": 1,
      "explanation": "Use 'bin' with 'gehen' because it's a verb of movement. Perfect tense requires 'sein' as auxiliary."
    }
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Generate vocabulary flashcards based on topic and level
 */
export const generateVocabularyActivity = async (
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<VocabularyActivity> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create vocabulary flashcards for German learners at ${level} level.

Topic: ${topic}
Description: ${description}
User's Native Language: ${motherLanguage}

Generate 10 vocabulary words related to this topic. Each card should have:
- German word (with article if it's a noun, e.g., "der Tisch")
- Translation in ${motherLanguage}
- Example sentence in German using the word in context

IMPORTANT: The translation field must contain the translation in ${motherLanguage}, not English.

Return a JSON object with this structure:
{
  "topic": "${topic}",
  "level": "${level}",
  "cards": [
    {
      "german": "der Apfel",
      "translation": "the apple (in ${motherLanguage})",
      "example_sentence": "Ich esse jeden Tag einen Apfel."
    }
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Generate listening comprehension activity
 */
export const generateListeningActivity = async (
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<ListeningActivity> => {
  const levelGuidance = {
    A1: 'very slow, simple sentences, basic vocabulary',
    A2: 'slow, simple dialogues about everyday topics',
    B1: 'normal pace, conversations about familiar topics',
    B2: 'near-native speed, complex topics and longer passages',
    C1: 'native speed, sophisticated language and nuanced content',
    C2: 'native speed, any topic including academic and professional',
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a listening comprehension exercise for German learners at ${level} level.

Topic: ${topic}
Description: ${description}
Speaking Level: ${levelGuidance[level]}
User's Native Language: ${motherLanguage}

Generate 3 listening questions. Each should have:
- A short German text (2-4 sentences) that will be read aloud to the student
- A comprehension question in ${motherLanguage}
- 4 multiple choice answers in ${motherLanguage}
- The correct answer index (0-3)

Return a JSON object with this structure:
{
  "topic": "${topic}",
  "level": "${level}",
  "questions": [
    {
      "audio_text": "Heute ist das Wetter sehr schön. Die Sonne scheint und es ist warm. Perfekt für einen Spaziergang im Park.",
      "question": "What is the weather like today?",
      "options": ["Cold and rainy", "Sunny and warm", "Cloudy", "Snowy"],
      "correct_option": 1
    }
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Generate writing prompt
 */
export const generateWritingActivity = async (
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<WritingActivity> => {
  const wordCounts = {
    A1: 30,
    A2: 50,
    B1: 80,
    B2: 120,
    C1: 180,
    C2: 250,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a writing prompt for German learners at ${level} level.

Topic: ${topic}
Description: ${description}
User's Native Language: ${motherLanguage}

Generate a writing prompt that:
- Is appropriate for ${level} level
- Relates to the topic
- Requires ${wordCounts[level]} words minimum
- Has clear evaluation criteria
- The prompt should be written in ${motherLanguage} to help the student understand what to write about
- The evaluation criteria should be in ${motherLanguage}

Return a JSON object with this structure:
{
  "topic": "${topic}",
  "level": "${level}",
  "prompt": "Schreiben Sie über Ihren letzten Urlaub. Wo waren Sie? Was haben Sie gemacht?",
  "min_words": ${wordCounts[level]},
  "evaluation_criteria": [
    "Correct use of past tense",
    "Vocabulary variety",
    "Sentence structure",
    "Grammar accuracy"
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Evaluate student's writing
 */
export const evaluateWriting = async (
  studentText: string,
  prompt: string,
  level: CEFRLevel,
  criteria: string[],
  motherLanguage: string = 'English'
): Promise<WritingEvaluation> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `You are a German language teacher evaluating a student's writing at ${level} level.

User's Native Language: ${motherLanguage}

Prompt: ${prompt}

Student's Text:
${studentText}

Evaluation Criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Evaluate the writing and provide all feedback in ${motherLanguage}:
1. Overall score (0-100)
2. List of strengths (what the student did well) - in ${motherLanguage}
3. List of areas for improvement - in ${motherLanguage}
4. Detailed feedback with specific examples - in ${motherLanguage}
5. Corrected version of the text (keep this in German, only fix the errors)

Return a JSON object with this structure:
{
  "score": 85,
  "strengths": [
    "Good use of past tense verbs",
    "Varied vocabulary"
  ],
  "areas_for_improvement": [
    "Watch word order in subordinate clauses",
    "Check article genders"
  ],
  "detailed_feedback": "Your writing shows...",
  "corrected_text": "..."
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Generate speaking activity scenario
 */
export const generateSpeakingActivity = async (
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<SpeakingActivity> => {
  const durations = {
    A1: 60,
    A2: 90,
    B1: 120,
    B2: 180,
    C1: 240,
    C2: 300,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a speaking practice scenario for German learners at ${level} level.

Topic: ${topic}
Description: ${description}
User's Native Language: ${motherLanguage}

Generate:
- A scenario description (in ${motherLanguage})
- 3-5 conversation starter questions (in German)
- Minimum conversation duration

Return a JSON object with this structure:
{
  "topic": "${topic}",
  "level": "${level}",
  "scenario": "You are at a restaurant ordering food. Practice speaking with the AI waiter.",
  "min_duration_seconds": ${durations[level]},
  "conversation_starters": [
    "Was möchten Sie bestellen?",
    "Haben Sie Empfehlungen?",
    "Was ist die Tagessuppe?"
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Generate reading comprehension activity
 */
export const generateReadingActivity = async (
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<ReadingActivity> => {
  const levelGuidance = {
    A1: 'very simple text with basic vocabulary (family, food, numbers), present tense only, 2-3 sentences',
    A2: 'simple text about everyday topics, mostly present and perfect tense, 3-4 sentences',
    B1: 'text about common topics with some complexity, various tenses, 4-6 sentences',
    B2: 'complex text about abstract topics, varied grammar structures, 6-8 sentences',
    C1: 'sophisticated text on any topic, nuanced language, 8-10 sentences',
    C2: 'native-level text with advanced vocabulary and structures, 10+ sentences',
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a reading comprehension exercise for German learners at ${level} level.

Topic: ${topic}
Description: ${description}
Reading Level: ${levelGuidance[level]}
User's Native Language: ${motherLanguage}

Generate 3 reading comprehension questions. Each should have:
- A German text appropriate for ${level} level
- A comprehension question in German about the text (asking about main idea, detail, or inference)
- 4 multiple choice answers in German
- The correct answer index (0-3)
- A brief explanation of why the answer is correct (in ${motherLanguage})

Important: All questions should be based on the SAME German text. This creates a cohesive reading comprehension exercise.

Return a JSON object with this structure:
{
  "topic": "${topic}",
  "level": "${level}",
  "questions": [
    {
      "text": "Maria wohnt in Berlin. Sie ist Lehrerin und arbeitet in einer Grundschule. Jeden Morgen fährt sie mit dem Fahrrad zur Arbeit.",
      "question": "Was ist Marias Beruf?",
      "options": ["Ärztin", "Lehrerin", "Ingenieurin", "Studentin"],
      "correct_option": 1,
      "explanation": "The text states 'Sie ist Lehrerin' which means 'She is a teacher'."
    }
  ]
}`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
};

/**
 * Route activity generation based on skill type
 */
export const generateActivity = async (
  activityType: ActivityType,
  topic: string,
  description: string,
  level: CEFRLevel,
  motherLanguage: string = 'English'
): Promise<GrammarActivity | VocabularyActivity | ListeningActivity | WritingActivity | SpeakingActivity | ReadingActivity> => {
  switch (activityType) {
    case 'grammar':
      return await generateGrammarActivity(topic, description, level, motherLanguage);
    case 'vocabulary':
      return await generateVocabularyActivity(topic, description, level, motherLanguage);
    case 'listening':
      return await generateListeningActivity(topic, description, level, motherLanguage);
    case 'writing':
      return await generateWritingActivity(topic, description, level, motherLanguage);
    case 'speaking':
      return await generateSpeakingActivity(topic, description, level, motherLanguage);
    case 'reading':
      return await generateReadingActivity(topic, description, level, motherLanguage);
    default:
      throw new Error(`Unknown activity type: ${activityType}`);
  }
};
