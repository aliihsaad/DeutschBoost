-- Add mode column to conversation_sessions table
-- This allows tracking which learning mode was used for each conversation

ALTER TABLE public.conversation_sessions
ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'FREE_CONVERSATION' CHECK (
  mode IN (
    'FREE_CONVERSATION',
    'READING_PRACTICE',
    'VOCABULARY_BUILDER',
    'GRAMMAR_DRILL',
    'LISTENING_COMPREHENSION'
  )
);

-- Add index for mode queries
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_mode ON public.conversation_sessions(mode);

-- Add comment to document the column
COMMENT ON COLUMN public.conversation_sessions.mode IS 'The learning mode used during this conversation session';

-- Add mother_language to user_profiles table if it doesn't exist
-- This helps personalize conversation modes and feedback
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS mother_language TEXT DEFAULT 'English';

-- Add comment to document the column
COMMENT ON COLUMN public.user_profiles.mother_language IS 'The user''s native language for personalized explanations';
