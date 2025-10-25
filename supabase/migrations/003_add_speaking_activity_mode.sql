-- Add SPEAKING_ACTIVITY to conversation mode constraint
-- This allows the new speaking activity mode for learning plan activities

-- Drop the existing constraint
ALTER TABLE public.conversation_sessions
DROP CONSTRAINT IF EXISTS conversation_sessions_mode_check;

-- Add updated constraint with SPEAKING_ACTIVITY included
ALTER TABLE public.conversation_sessions
ADD CONSTRAINT conversation_sessions_mode_check CHECK (
  mode IN (
    'FREE_CONVERSATION',
    'READING_PRACTICE',
    'VOCABULARY_BUILDER',
    'GRAMMAR_DRILL',
    'LISTENING_COMPREHENSION',
    'SPEAKING_ACTIVITY'
  )
);

-- Update comment
COMMENT ON COLUMN public.conversation_sessions.mode IS 'The learning mode used during this conversation session (includes SPEAKING_ACTIVITY for learning plan activities)';
