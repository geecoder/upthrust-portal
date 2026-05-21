-- ============================================================
-- ADDITIONS TO RUN IN SUPABASE SQL EDITOR
-- Run this AFTER the initial supabase-schema.sql
-- ============================================================

-- Add AI feedback columns to assignments table
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
  ADD COLUMN IF NOT EXISTS ai_feedback_at TIMESTAMPTZ;

-- Add onboarding_complete to learners table
ALTER TABLE learners
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add passport_id to learners for the PDF
ALTER TABLE learners
  ADD COLUMN IF NOT EXISTS passport_id TEXT;

-- Generate passport IDs for existing learners (run once)
UPDATE learners
SET passport_id = 'UP-C1-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0') || '-' || pathway
WHERE passport_id IS NULL AND pathway IN ('PM', 'BA');

COMMENT ON COLUMN assignments.ai_feedback IS 'AI-generated first-pass feedback. Shown to learner immediately after submission. Genesis human feedback is stored in the feedback column.';
COMMENT ON COLUMN assignments.ai_feedback_at IS 'When AI feedback was generated';
COMMENT ON COLUMN learners.onboarding_complete IS 'Whether learner has completed the first-login onboarding flow';
COMMENT ON COLUMN learners.passport_id IS 'Unique Capability Passport identifier, e.g. UP-C1-0047-BA';
