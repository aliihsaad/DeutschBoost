/**
 * Practice Service
 * Handles AI-powered practice session generation, daily suggestions,
 * and practice tracking for the Practice tab
 */

import { ai } from './geminiService';
import { supabase } from '../src/lib/supabase';
import {
  CEFRLevel,
  SkillType,
  PracticeSession,
  DailyPracticeSuggestion,
  PracticeStats,
  TestResult
} from '../types';
import { Type } from '@google/genai';

/**
 * Generate daily practice suggestions based on user's test results and weaknesses
 */
export const generateDailySuggestions = async (
  userId: string,
  userLevel: CEFRLevel,
  testResult?: TestResult
): Promise<DailyPracticeSuggestion[]> => {
  try {
    // Get user's recent practice sessions to avoid repetitive suggestions
    const { data: recentSessions } = await supabase
      .from('practice_sessions')
      .select('activity_type, topic')
      .eq('user_id', userId)
      .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('completed_at', { ascending: false })
      .limit(10);

    const recentTopics = recentSessions?.map(s => s.topic).filter(Boolean) || [];
    const recentSkills = recentSessions?.map(s => s.activity_type) || [];

    // Get existing suggestions for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingSuggestions } = await supabase
      .from('daily_practice_suggestions')
      .select('*')
      .eq('user_id', userId)
      .eq('suggested_date', today)
      .eq('is_completed', false)
      .eq('is_dismissed', false);

    // If we already have 3+ suggestions for today, return them
    if (existingSuggestions && existingSuggestions.length >= 3) {
      return existingSuggestions as DailyPracticeSuggestion[];
    }

    // Generate AI-powered suggestions
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are a German language learning assistant. Generate 3 personalized daily practice suggestions for a student.

Student Information:
- Current Level: ${userLevel}
- Test Weaknesses: ${testResult?.weaknesses.join(', ') || 'Not available'}
- Test Strengths: ${testResult?.strengths.join(', ') || 'Not available'}
- Recently Practiced Topics: ${recentTopics.length > 0 ? recentTopics.join(', ') : 'None'}
- Recently Practiced Skills: ${recentSkills.length > 0 ? recentSkills.join(', ') : 'None'}

Generate 3 practice suggestions that:
1. Target the student's weaknesses (if available)
2. Are appropriate for their CEFR level (${userLevel})
3. Avoid recently practiced topics (suggest fresh content)
4. Cover different skill types
5. Have clear, specific topics (not generic)

Each suggestion should include:
- skill_type: One of Grammar, Vocabulary, Listening, Writing, Speaking, Reading
- topic: A specific, engaging topic (e.g., "Modal verbs in conditional sentences", "Vocabulary: At the doctor's office")
- reason: Why this practice is beneficial (e.g., "Based on your test results, you need more practice with...")
- priority: 1 (highest) to 5 (lowest)

Prioritize suggestions based on test weaknesses (priority 1-2), then general skill development (priority 3-5).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  skill_type: {
                    type: Type.STRING,
                    enum: ['Grammar', 'Vocabulary', 'Listening', 'Writing', 'Speaking', 'Reading']
                  },
                  topic: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  priority: { type: Type.INTEGER }
                },
                required: ['skill_type', 'topic', 'reason', 'priority']
              }
            }
          },
          required: ['suggestions']
        }
      }
    });

    const aiSuggestions = response.data?.suggestions || [];

    // Save suggestions to database
    const suggestionsToInsert = aiSuggestions.map((s: any) => ({
      user_id: userId,
      skill_type: s.skill_type as SkillType,
      topic: s.topic,
      reason: s.reason,
      level: userLevel,
      priority: s.priority,
      suggested_date: today,
      is_completed: false,
      is_dismissed: false
    }));

    const { data: savedSuggestions, error } = await supabase
      .from('daily_practice_suggestions')
      .insert(suggestionsToInsert)
      .select();

    if (error) {
      console.error('Error saving suggestions:', error);
      return [];
    }

    return (savedSuggestions || []) as DailyPracticeSuggestion[];
  } catch (error) {
    console.error('Error generating daily suggestions:', error);
    return [];
  }
};

/**
 * Get today's practice suggestions for a user
 */
export const getTodaysSuggestions = async (
  userId: string
): Promise<DailyPracticeSuggestion[]> => {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_practice_suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('suggested_date', today)
    .eq('is_completed', false)
    .eq('is_dismissed', false)
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }

  return (data || []) as DailyPracticeSuggestion[];
};

/**
 * Mark a suggestion as completed
 */
export const completeSuggestion = async (suggestionId: string): Promise<void> => {
  await supabase
    .from('daily_practice_suggestions')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString()
    })
    .eq('id', suggestionId);
};

/**
 * Dismiss a suggestion
 */
export const dismissSuggestion = async (suggestionId: string): Promise<void> => {
  await supabase
    .from('daily_practice_suggestions')
    .update({ is_dismissed: true })
    .eq('id', suggestionId);
};

/**
 * Create a new practice session
 */
export const createPracticeSession = async (
  userId: string,
  activityType: SkillType | 'Mock Exam',
  level: CEFRLevel,
  topic?: string
): Promise<PracticeSession | null> => {
  const startedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userId,
      activity_type: activityType,
      topic: topic || null,
      level,
      is_mock_exam: activityType === 'Mock Exam',
      started_at: startedAt,
      completed_at: startedAt, // Will be updated when session completes
      duration_minutes: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating practice session:', error);
    return null;
  }

  return data as PracticeSession;
};

/**
 * Complete a practice session with results
 */
export const completePracticeSession = async (
  sessionId: string,
  results: {
    score?: number;
    duration_minutes: number;
    items_completed?: number;
    feedback?: string;
    strengths?: string[];
    areas_for_improvement?: string[];
    exam_sections?: Record<string, number>;
  }
): Promise<void> => {
  const { error } = await supabase
    .from('practice_sessions')
    .update({
      ...results,
      completed_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error completing practice session:', error);
  }
};

/**
 * Get practice statistics for a user
 */
export const getPracticeStats = async (
  userId: string,
  days: number = 7
): Promise<PracticeStats | null> => {
  try {
    // Call the Postgres function
    const { data, error } = await supabase
      .rpc('get_practice_stats', {
        p_user_id: userId,
        p_days: days
      });

    if (error) {
      console.error('Error fetching practice stats:', error);
      return null;
    }

    // The function returns a single row with aggregated data
    if (!data || data.length === 0) {
      return {
        total_sessions: 0,
        total_minutes: 0,
        average_score: 0,
        skills_practiced: {},
        recent_sessions: []
      };
    }

    return data[0] as PracticeStats;
  } catch (error) {
    console.error('Error in getPracticeStats:', error);
    return null;
  }
};

/**
 * Get recent practice sessions
 */
export const getRecentPracticeSessions = async (
  userId: string,
  limit: number = 10
): Promise<PracticeSession[]> => {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent sessions:', error);
    return [];
  }

  return (data || []) as PracticeSession[];
};

/**
 * Generate exam-specific feedback aligned with Goethe-Zertifikat criteria
 */
export const generateExamFeedback = async (
  level: CEFRLevel,
  skillType: SkillType,
  userResponse: string,
  score: number
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are a Goethe-Zertifikat examiner. Provide detailed feedback for a ${level} level ${skillType} practice.

Score: ${score}/100

User's Response:
${userResponse}

Provide feedback that:
1. Aligns with official Goethe-Zertifikat evaluation criteria for ${level}
2. Highlights specific strengths in their response
3. Points out specific areas for improvement
4. Gives actionable advice for exam preparation
5. Is encouraging but honest

Format the feedback in 3-4 short paragraphs.`
    });

    return response.text || 'Feedback generation failed. Please try again.';
  } catch (error) {
    console.error('Error generating exam feedback:', error);
    return 'Unable to generate feedback at this time.';
  }
};
