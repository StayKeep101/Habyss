-- Add soft-delete support to habits and habit_completions tables
-- This allows proper sync of deleted items between local and cloud

-- Add deleted_at to habits table
ALTER TABLE habits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deleted_at to habit_completions table  
ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying of non-deleted records
CREATE INDEX IF NOT EXISTS idx_habits_deleted_at ON habits(deleted_at);
CREATE INDEX IF NOT EXISTS idx_habit_completions_deleted_at ON habit_completions(deleted_at);

-- Update RLS policies to filter out soft-deleted records by default
-- Drop existing select policy and recreate
DROP POLICY IF EXISTS "Users can view own habits" ON habits;
CREATE POLICY "Users can view own habits" ON habits
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Add policy to also allow viewing deleted items (for sync purposes)
CREATE POLICY "Users can view own deleted habits for sync" ON habits
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Update policy for habit_completions
DROP POLICY IF EXISTS "Users can view own completions" ON habit_completions;
CREATE POLICY "Users can view own completions" ON habit_completions
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can view own deleted completions for sync" ON habit_completions
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NOT NULL);
