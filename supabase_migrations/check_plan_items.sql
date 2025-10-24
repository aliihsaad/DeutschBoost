-- Check if learning_plan_items table exists and query data
-- Run this in Supabase SQL Editor

-- Check if table exists
SELECT
  CASE
    WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'learning_plan_items')
    THEN 'TABLE EXISTS'
    ELSE 'TABLE DOES NOT EXIST'
  END as table_status;

-- If table exists, show count
SELECT
  'Total plan items' as description,
  COUNT(*) as count
FROM public.learning_plan_items
WHERE EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'learning_plan_items');

-- Show items for your specific plan
SELECT
  lpi.week_number,
  lpi.week_focus,
  lpi.topic,
  lpi.skill,
  lpi.completed
FROM public.learning_plan_items lpi
WHERE lpi.learning_plan_id = 'd721077c-3eb8-40dd-aa20-fe5695112b9b'
ORDER BY lpi.week_number, lpi.id;
