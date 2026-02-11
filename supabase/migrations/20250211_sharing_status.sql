-- Migration: Add sharing status column for accept/refuse flow
-- Created: 2025-02-11

-- Add status to shared_habits
ALTER TABLE shared_habits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted', 'declined'));

-- Add status to shared_goals
ALTER TABLE shared_goals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted', 'declined'));

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_shared_habits_status ON shared_habits(status);
CREATE INDEX IF NOT EXISTS idx_shared_goals_status ON shared_goals(status);

-- Backfill: existing shares should be treated as already accepted
UPDATE shared_habits SET status = 'accepted' WHERE status IS NULL OR status = 'pending';
UPDATE shared_goals SET status = 'accepted' WHERE status IS NULL OR status = 'pending';

-- Update RLS: allow shared_with user to update status (accept/decline/stop)
DROP POLICY IF EXISTS "Recipients can update share status" ON shared_habits;
CREATE POLICY "Recipients can update share status" ON shared_habits
  FOR UPDATE USING (auth.uid() = shared_with_id)
  WITH CHECK (auth.uid() = shared_with_id);

DROP POLICY IF EXISTS "Recipients can update share status" ON shared_goals;
CREATE POLICY "Recipients can update share status" ON shared_goals
  FOR UPDATE USING (auth.uid() = shared_with_id)
  WITH CHECK (auth.uid() = shared_with_id);
