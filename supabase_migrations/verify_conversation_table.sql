-- Verify conversation_sessions table exists and check its structure
SELECT
  CASE
    WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_sessions')
    THEN 'TABLE EXISTS'
    ELSE 'TABLE DOES NOT EXIST'
  END as table_status;

-- Show table structure if it exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversation_sessions'
ORDER BY ordinal_position;

-- Check if there are any sessions
SELECT COUNT(*) as session_count
FROM public.conversation_sessions
WHERE EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_sessions');
