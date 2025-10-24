-- =====================================================
-- ADD 'Reading' TO SKILL CHECK CONSTRAINT
-- =====================================================
-- This migration adds 'Reading' to the allowed skill values
-- Run this in Supabase SQL Editor to update existing database
-- =====================================================

-- Drop the existing constraint
ALTER TABLE public.learning_plan_items
DROP CONSTRAINT IF EXISTS learning_plan_items_skill_check;

-- Add the new constraint with 'Reading' included
ALTER TABLE public.learning_plan_items
ADD CONSTRAINT learning_plan_items_skill_check
CHECK (skill IN ('Grammar', 'Vocabulary', 'Listening', 'Reading', 'Writing', 'Speaking'));

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION';
  RAISE NOTICE '========================================';

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_plan_items_skill_check'
    AND conrelid = 'public.learning_plan_items'::regclass
  ) THEN
    RAISE NOTICE '✓ Constraint "learning_plan_items_skill_check" updated successfully';
  ELSE
    RAISE NOTICE '✗ Constraint "learning_plan_items_skill_check" NOT found';
  END IF;
END $$;
