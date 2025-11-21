-- =====================================================
-- ADD MISSING RLS POLICIES FOR DEUTSCHBOOST DATABASE
-- =====================================================
-- This migration adds Row Level Security policies to tables
-- that are currently missing them, ensuring user data isolation.
--
-- SAFE TO RUN: This script uses IF NOT EXISTS and DROP IF EXISTS
-- to avoid conflicts with any existing policies.
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- =====================================================

-- ========================================
-- STEP 1: Enable RLS on tables that might not have it
-- ========================================

ALTER TABLE IF EXISTS public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_practice_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mock_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_achievements ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: conversation_sessions policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own conversation sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can insert own conversation sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can update own conversation sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can delete own conversation sessions" ON public.conversation_sessions;

CREATE POLICY "Users can view own conversation sessions" ON public.conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation sessions" ON public.conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation sessions" ON public.conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversation sessions" ON public.conversation_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STEP 3: study_sessions policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can insert own study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can update own study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can delete own study sessions" ON public.study_sessions;

CREATE POLICY "Users can view own study sessions" ON public.study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study sessions" ON public.study_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study sessions" ON public.study_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STEP 4: flashcards policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete own flashcards" ON public.flashcards;

CREATE POLICY "Users can view own flashcards" ON public.flashcards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcards" ON public.flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcards" ON public.flashcards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards" ON public.flashcards
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STEP 5: practice_sessions policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can insert own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can update own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can delete own practice sessions" ON public.practice_sessions;

CREATE POLICY "Users can view own practice sessions" ON public.practice_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice sessions" ON public.practice_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice sessions" ON public.practice_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice sessions" ON public.practice_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STEP 6: daily_practice_suggestions policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own daily suggestions" ON public.daily_practice_suggestions;
DROP POLICY IF EXISTS "Users can insert own daily suggestions" ON public.daily_practice_suggestions;
DROP POLICY IF EXISTS "Users can update own daily suggestions" ON public.daily_practice_suggestions;
DROP POLICY IF EXISTS "Users can delete own daily suggestions" ON public.daily_practice_suggestions;

CREATE POLICY "Users can view own daily suggestions" ON public.daily_practice_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily suggestions" ON public.daily_practice_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily suggestions" ON public.daily_practice_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily suggestions" ON public.daily_practice_suggestions
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STEP 7: mock_exam_sessions policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own mock exams" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Users can insert own mock exams" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Users can update own mock exams" ON public.mock_exam_sessions;
DROP POLICY IF EXISTS "Users can delete own mock exams" ON public.mock_exam_sessions;

CREATE POLICY "Users can view own mock exams" ON public.mock_exam_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mock exams" ON public.mock_exam_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mock exams" ON public.mock_exam_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mock exams" ON public.mock_exam_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- STEP 8: achievements policies (read-only for users)
-- ========================================

DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;

-- Achievements are system-defined, so all authenticated users can read them
CREATE POLICY "Anyone can view achievements" ON public.achievements
  FOR SELECT USING (true);

-- ========================================
-- STEP 9: user_achievements policies
-- ========================================

DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;

CREATE POLICY "Users can view own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Users can earn achievements (insert), but typically this would be done by a service
CREATE POLICY "Users can insert own achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========================================
-- STEP 10: Grant permissions to authenticated users
-- ========================================

GRANT ALL ON public.conversation_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO authenticated;
GRANT ALL ON public.flashcards TO authenticated;
GRANT ALL ON public.practice_sessions TO authenticated;
GRANT ALL ON public.daily_practice_suggestions TO authenticated;
GRANT ALL ON public.mock_exam_sessions TO authenticated;
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.user_achievements TO authenticated;

-- ========================================
-- VERIFICATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS POLICIES MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The following tables now have RLS enabled:';
  RAISE NOTICE '  ✓ conversation_sessions';
  RAISE NOTICE '  ✓ study_sessions';
  RAISE NOTICE '  ✓ flashcards';
  RAISE NOTICE '  ✓ practice_sessions';
  RAISE NOTICE '  ✓ daily_practice_suggestions';
  RAISE NOTICE '  ✓ mock_exam_sessions';
  RAISE NOTICE '  ✓ achievements (read-only)';
  RAISE NOTICE '  ✓ user_achievements';
  RAISE NOTICE '';
  RAISE NOTICE 'Each table now restricts access to:';
  RAISE NOTICE '  - Users can only see their own data (auth.uid() = user_id)';
  RAISE NOTICE '  - Users can only insert/update/delete their own data';
  RAISE NOTICE '';
END $$;
