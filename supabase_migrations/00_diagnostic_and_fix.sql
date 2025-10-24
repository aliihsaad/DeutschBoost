-- =====================================================
-- DIAGNOSTIC AND FIX SCRIPT FOR DEUTSCHBOOST DATABASE
-- =====================================================
-- Run this in Supabase SQL Editor to diagnose and fix database issues
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- 4. Review the output to see what was fixed
-- =====================================================

-- STEP 1: Check if tables exist
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STEP 1: Checking if required tables exist';
  RAISE NOTICE '========================================';

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    RAISE NOTICE '✓ Table "users" exists';
  ELSE
    RAISE NOTICE '✗ Table "users" does NOT exist - will create';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
    RAISE NOTICE '✓ Table "user_profiles" exists';
  ELSE
    RAISE NOTICE '✗ Table "user_profiles" does NOT exist - will create';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_results') THEN
    RAISE NOTICE '✓ Table "test_results" exists';
  ELSE
    RAISE NOTICE '✗ Table "test_results" does NOT exist - will create';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'learning_plans') THEN
    RAISE NOTICE '✓ Table "learning_plans" exists';
  ELSE
    RAISE NOTICE '✗ Table "learning_plans" does NOT exist - will create';
  END IF;
END $$;

-- STEP 2: Check if trigger function exists
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STEP 2: Checking if trigger function exists';
  RAISE NOTICE '========================================';

  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'handle_new_user') THEN
    RAISE NOTICE '✓ Function "handle_new_user()" exists';
  ELSE
    RAISE NOTICE '✗ Function "handle_new_user()" does NOT exist - will create';
  END IF;
END $$;

-- STEP 3: Check for existing authenticated users
DO $$
DECLARE
  auth_user_count INT;
  public_user_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STEP 3: Checking user counts';
  RAISE NOTICE '========================================';

  SELECT COUNT(*) INTO auth_user_count FROM auth.users;
  RAISE NOTICE 'Users in auth.users: %', auth_user_count;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    SELECT COUNT(*) INTO public_user_count FROM public.users;
    RAISE NOTICE 'Users in public.users: %', public_user_count;

    IF auth_user_count > public_user_count THEN
      RAISE NOTICE '⚠ MISMATCH: % auth users but only % public users', auth_user_count, public_user_count;
      RAISE NOTICE '  This means some users are missing from public.users';
    ELSE
      RAISE NOTICE '✓ User counts match';
    END IF;
  END IF;
END $$;

-- STEP 4: Create tables if they don't exist
-- (Re-running table creation is safe - it will skip if exists)

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_level TEXT,
  mother_language TEXT DEFAULT 'en',
  target_daily_minutes INTEGER DEFAULT 30,
  learning_goals TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL,
  level TEXT NOT NULL,
  sections JSONB DEFAULT '{}',
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_result_id UUID REFERENCES public.test_results(id),
  plan_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON public.test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_user_id ON public.learning_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_active ON public.learning_plans(user_id, is_active) WHERE is_active = TRUE;

-- STEP 5: Create or replace trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into users table
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 6: Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 7: Create fallback function
CREATE OR REPLACE FUNCTION public.ensure_user_exists(user_id UUID, user_email TEXT)
RETURNS VOID AS $$
BEGIN
  -- Insert into users if not exists
  INSERT INTO public.users (id, email, created_at)
  VALUES (user_id, user_email, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Insert into user_profiles if not exists
  INSERT INTO public.user_profiles (id)
  VALUES (user_id)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 8: Fix existing auth users that are missing from public.users
DO $$
DECLARE
  missing_user RECORD;
  fixed_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STEP 8: Fixing missing user records';
  RAISE NOTICE '========================================';

  FOR missing_user IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    -- Insert into public.users
    INSERT INTO public.users (id, email, created_at)
    VALUES (missing_user.id, missing_user.email, NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Insert into public.user_profiles
    INSERT INTO public.user_profiles (id)
    VALUES (missing_user.id)
    ON CONFLICT (id) DO NOTHING;

    fixed_count := fixed_count + 1;
    RAISE NOTICE 'Fixed missing records for user: % (%)', missing_user.email, missing_user.id;
  END LOOP;

  IF fixed_count = 0 THEN
    RAISE NOTICE '✓ All auth users already have corresponding public records';
  ELSE
    RAISE NOTICE '✓ Fixed % missing user record(s)', fixed_count;
  END IF;
END $$;

-- STEP 9: Setup RLS policies
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update own user data" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own test results" ON public.test_results;
DROP POLICY IF EXISTS "Users can insert own test results" ON public.test_results;
DROP POLICY IF EXISTS "Users can view own learning plans" ON public.learning_plans;
DROP POLICY IF EXISTS "Users can insert own learning plans" ON public.learning_plans;
DROP POLICY IF EXISTS "Users can update own learning plans" ON public.learning_plans;

-- Create policies
CREATE POLICY "Users can view own user data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own user data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own test results" ON public.test_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test results" ON public.test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own learning plans" ON public.learning_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning plans" ON public.learning_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning plans" ON public.learning_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- STEP 10: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.test_results TO authenticated;
GRANT ALL ON public.learning_plans TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(UUID, TEXT) TO authenticated;

-- STEP 11: Final verification
DO $$
DECLARE
  auth_count INT;
  users_count INT;
  profiles_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL VERIFICATION';
  RAISE NOTICE '========================================';

  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO users_count FROM public.users;
  SELECT COUNT(*) INTO profiles_count FROM public.user_profiles;

  RAISE NOTICE 'Auth users: %', auth_count;
  RAISE NOTICE 'Public users: %', users_count;
  RAISE NOTICE 'User profiles: %', profiles_count;

  IF auth_count = users_count AND auth_count = profiles_count THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ SUCCESS! All user counts match ✓✓✓';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '⚠ WARNING: User counts still do not match';
    RAISE NOTICE '  Please check for errors above';
    RAISE NOTICE '';
  END IF;
END $$;
