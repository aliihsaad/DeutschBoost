-- Migration: Add Practice Feature Tables
-- Description: Tables for tracking practice sessions separate from learning plan,
--              and storing AI-generated daily practice suggestions

-- Practice Sessions Table
-- Tracks all practice activities done outside of the learning plan
CREATE TABLE practice_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Session details
    activity_type TEXT NOT NULL CHECK (activity_type IN ('Grammar', 'Vocabulary', 'Listening', 'Writing', 'Speaking', 'Reading', 'Mock Exam')),
    topic TEXT,
    level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),

    -- Performance metrics
    score INTEGER CHECK (score >= 0 AND score <= 100),
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    items_completed INTEGER DEFAULT 0,

    -- Exam-specific fields (for mock exams)
    is_mock_exam BOOLEAN DEFAULT FALSE,
    exam_sections JSONB, -- {reading: score, writing: score, listening: score, speaking: score}

    -- Feedback and details
    feedback TEXT,
    strengths TEXT[],
    areas_for_improvement TEXT[],

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_completion_time CHECK (completed_at >= started_at)
);

-- Daily Practice Suggestions Table
-- Stores AI-generated personalized practice recommendations
CREATE TABLE daily_practice_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Suggestion details
    skill_type TEXT NOT NULL CHECK (skill_type IN ('Grammar', 'Vocabulary', 'Listening', 'Writing', 'Speaking', 'Reading')),
    topic TEXT NOT NULL,
    reason TEXT NOT NULL, -- Why this was suggested (e.g., "Based on your writing test results")
    level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),

    -- Priority and status
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5), -- 1 = highest priority
    is_completed BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,

    -- Timestamps
    suggested_date DATE DEFAULT CURRENT_DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one suggestion per skill per day per user
    UNIQUE(user_id, skill_type, suggested_date)
);

-- Indexes for better query performance
CREATE INDEX idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX idx_practice_sessions_completed_at ON practice_sessions(completed_at DESC);
CREATE INDEX idx_practice_sessions_activity_type ON practice_sessions(activity_type);
CREATE INDEX idx_daily_suggestions_user_date ON daily_practice_suggestions(user_id, suggested_date DESC);
CREATE INDEX idx_daily_suggestions_user_active ON daily_practice_suggestions(user_id) WHERE is_completed = FALSE AND is_dismissed = FALSE;

-- Row Level Security (RLS) Policies
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_practice_suggestions ENABLE ROW LEVEL SECURITY;

-- Practice Sessions Policies
CREATE POLICY "Users can view their own practice sessions"
    ON practice_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own practice sessions"
    ON practice_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own practice sessions"
    ON practice_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own practice sessions"
    ON practice_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Daily Practice Suggestions Policies
CREATE POLICY "Users can view their own suggestions"
    ON daily_practice_suggestions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
    ON daily_practice_suggestions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
    ON daily_practice_suggestions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggestions"
    ON daily_practice_suggestions FOR DELETE
    USING (auth.uid() = user_id);

-- Create a function to get practice statistics for a user
CREATE OR REPLACE FUNCTION get_practice_stats(
    p_user_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_sessions INTEGER,
    total_minutes INTEGER,
    average_score NUMERIC,
    skills_practiced JSONB,
    recent_sessions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_sessions,
        COALESCE(SUM(duration_minutes), 0)::INTEGER AS total_minutes,
        ROUND(AVG(score)::NUMERIC, 1) AS average_score,
        jsonb_object_agg(
            activity_type,
            count
        ) AS skills_practiced,
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'activity_type', activity_type,
                'topic', topic,
                'score', score,
                'completed_at', completed_at
            )
            ORDER BY completed_at DESC
        ) FILTER (WHERE row_num <= 5) AS recent_sessions
    FROM (
        SELECT
            ps.*,
            ROW_NUMBER() OVER (ORDER BY ps.completed_at DESC) AS row_num,
            COUNT(*) OVER (PARTITION BY ps.activity_type) AS count
        FROM practice_sessions ps
        WHERE ps.user_id = p_user_id
            AND ps.completed_at >= NOW() - (p_days || ' days')::INTERVAL
    ) subquery;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_practice_stats(UUID, INTEGER) TO authenticated;

COMMENT ON TABLE practice_sessions IS 'Tracks practice activities separate from structured learning plans';
COMMENT ON TABLE daily_practice_suggestions IS 'AI-generated personalized daily practice recommendations';
COMMENT ON FUNCTION get_practice_stats IS 'Returns aggregated practice statistics for a user over a specified period';
