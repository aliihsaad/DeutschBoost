-- Quick verification query to check if the fix worked
-- Run this in Supabase SQL Editor to see the results

SELECT
  'Auth Users' as table_name,
  COUNT(*) as count
FROM auth.users

UNION ALL

SELECT
  'Public Users' as table_name,
  COUNT(*) as count
FROM public.users

UNION ALL

SELECT
  'User Profiles' as table_name,
  COUNT(*) as count
FROM public.user_profiles

UNION ALL

SELECT
  'Test Results' as table_name,
  COUNT(*) as count
FROM public.test_results

UNION ALL

SELECT
  'Learning Plans' as table_name,
  COUNT(*) as count
FROM public.learning_plans;
