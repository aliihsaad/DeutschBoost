-- DeutschBoost Initial Database Schema
-- This migration creates all tables and sets up Row Level Security

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'expired')),
  subscription_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles with learning preferences
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_level TEXT DEFAULT 'A1' CHECK (current_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  target_level TEXT CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  target_exam_date DATE,
  daily_goal_minutes INTEGER DEFAULT 30,
  notification_preferences JSONB DEFAULT '{"email": true, "push": false}'::JSONB,
  study_streak INTEGER DEFAULT 0,
  total_study_time INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test results
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL CHECK (test_type IN ('placement', 'practice', 'mock_exam')),
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  sections JSONB NOT NULL DEFAULT '{}'::JSONB,
  overall_score INTEGER,
  strengths TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  recommendations TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning plans
CREATE TABLE IF NOT EXISTS public.learning_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  test_result_id UUID REFERENCES public.test_results(id) ON DELETE SET NULL,
  target_level TEXT NOT NULL CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  goals TEXT[] NOT NULL DEFAULT '{}',
  duration_weeks INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning plan items
CREATE TABLE IF NOT EXISTS public.learning_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_plan_id UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_focus TEXT NOT NULL,
  topic TEXT NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('Grammar', 'Vocabulary', 'Listening', 'Writing', 'Speaking')),
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

-- Flashcards for vocabulary learning
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  word_german TEXT NOT NULL,
  word_english TEXT NOT NULL,
  example_sentence TEXT,
  audio_url TEXT,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  next_review_date TIMESTAMPTZ DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  ease_factor DECIMAL DEFAULT 2.5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation sessions with AI
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0,
  transcript JSONB NOT NULL DEFAULT '[]'::JSONB,
  feedback TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Achievements catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  criteria JSONB NOT NULL,
  points INTEGER DEFAULT 0
);

-- User achievements (many-to-many)
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Study sessions for tracking
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('conversation', 'flashcards', 'listening', 'reading', 'writing', 'grammar')),
  duration_minutes INTEGER NOT NULL,
  items_completed INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE
);

-- =====================================================
-- INDEXES for better query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON public.test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_completed_at ON public.test_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_plans_user_id ON public.learning_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_is_active ON public.learning_plans(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON public.flashcards(next_review_date);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON public.conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id_date ON public.study_sessions(user_id, date DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- User profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Test results policies
CREATE POLICY "Users can view own test results" ON public.test_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test results" ON public.test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Learning plans policies
CREATE POLICY "Users can view own learning plans" ON public.learning_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning plans" ON public.learning_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning plans" ON public.learning_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- Learning plan items policies
CREATE POLICY "Users can view own learning plan items" ON public.learning_plan_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.id = learning_plan_items.learning_plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own learning plan items" ON public.learning_plan_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.id = learning_plan_items.learning_plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own learning plan items" ON public.learning_plan_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.id = learning_plan_items.learning_plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

-- Flashcards policies
CREATE POLICY "Users can view own flashcards" ON public.flashcards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcards" ON public.flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcards" ON public.flashcards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards" ON public.flashcards
  FOR DELETE USING (auth.uid() = user_id);

-- Conversation sessions policies
CREATE POLICY "Users can view own conversation sessions" ON public.conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation sessions" ON public.conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation sessions" ON public.conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Achievements policies (read-only for all authenticated users)
CREATE POLICY "Anyone can view achievements" ON public.achievements
  FOR SELECT USING (auth.role() = 'authenticated');

-- User achievements policies
CREATE POLICY "Users can view own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions policies
CREATE POLICY "Users can view own study sessions" ON public.study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());

  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user's last active timestamp
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET last_active = NOW()
  WHERE id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update learning plan item completed_at timestamp
CREATE OR REPLACE FUNCTION public.set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
    NEW.completed_at = NOW();
  ELSIF NEW.completed = FALSE THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for learning plan items completion
DROP TRIGGER IF EXISTS on_learning_item_completed ON public.learning_plan_items;
CREATE TRIGGER on_learning_item_completed
  BEFORE UPDATE ON public.learning_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_completed_at();

-- =====================================================
-- SEED DATA - Default Achievements
-- =====================================================

INSERT INTO public.achievements (name, description, icon, criteria, points) VALUES
  ('First Steps', 'Complete your first placement test', 'fa-solid fa-medal', '{"test_count": 1}'::JSONB, 10),
  ('Week Warrior', 'Maintain a 7-day study streak', 'fa-solid fa-fire', '{"streak_days": 7}'::JSONB, 25),
  ('Dedicated Learner', 'Study for 5 hours total', 'fa-solid fa-clock', '{"total_minutes": 300}'::JSONB, 20),
  ('Conversation Starter', 'Complete your first AI conversation', 'fa-solid fa-comments', '{"conversation_count": 1}'::JSONB, 15),
  ('Vocabulary Master', 'Create 50 flashcards', 'fa-solid fa-book', '{"flashcard_count": 50}'::JSONB, 30),
  ('Level Up!', 'Progress to the next CEFR level', 'fa-solid fa-arrow-up', '{"level_progress": 1}'::JSONB, 50)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
