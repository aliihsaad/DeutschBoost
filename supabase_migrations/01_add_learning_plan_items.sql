-- =====================================================
-- ADD LEARNING_PLAN_ITEMS TABLE
-- =====================================================
-- This table stores the individual items/tasks within each learning plan
-- Run this in Supabase SQL Editor if the table doesn't exist
-- =====================================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create learning_plan_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.learning_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_plan_id UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_focus TEXT NOT NULL,
  topic TEXT NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('Grammar', 'Vocabulary', 'Listening', 'Reading', 'Writing', 'Speaking')),
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_learning_plan_items_plan_id ON public.learning_plan_items(learning_plan_id);
CREATE INDEX IF NOT EXISTS idx_learning_plan_items_week ON public.learning_plan_items(learning_plan_id, week_number);

-- Enable RLS
ALTER TABLE public.learning_plan_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own learning plan items" ON public.learning_plan_items;
DROP POLICY IF EXISTS "Users can insert own learning plan items" ON public.learning_plan_items;
DROP POLICY IF EXISTS "Users can update own learning plan items" ON public.learning_plan_items;

-- RLS Policies
CREATE POLICY "Users can view own learning plan items" ON public.learning_plan_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.user_id = auth.uid()
      AND learning_plans.id = learning_plan_items.learning_plan_id
    )
  );

CREATE POLICY "Users can insert own learning plan items" ON public.learning_plan_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.user_id = auth.uid()
      AND learning_plans.id = learning_plan_items.learning_plan_id
    )
  );

CREATE POLICY "Users can update own learning plan items" ON public.learning_plan_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.user_id = auth.uid()
      AND learning_plans.id = learning_plan_items.learning_plan_id
    )
  );

-- Grant permissions
GRANT ALL ON public.learning_plan_items TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION';
  RAISE NOTICE '========================================';

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'learning_plan_items') THEN
    RAISE NOTICE '✓ Table "learning_plan_items" exists';
  ELSE
    RAISE NOTICE '✗ Table "learning_plan_items" does NOT exist';
  END IF;
END $$;
