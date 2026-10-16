-- Supabase Schema Improvements for Industry-Standard Sync
-- Run these in Supabase SQL Editor

-- 1. Add updated_at to habits (CRITICAL for sync conflict resolution)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Add updated_at to habit_completions
ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 3. Add missing habit fields to match local schema
ALTER TABLE habits ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS task_days JSONB DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]'::jsonb;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'build';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6B46C1';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS goal_period TEXT DEFAULT 'daily';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS goal_value INTEGER DEFAULT 1;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'count';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS chart_type TEXT DEFAULT 'bar';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS show_memo BOOLEAN DEFAULT false;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS frequency TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS week_interval INTEGER DEFAULT 1;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS time_of_day TEXT;

-- 4. Create auto-update trigger for updated_at (industry standard)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to habits
DROP TRIGGER IF EXISTS update_habits_updated_at ON habits;
CREATE TRIGGER update_habits_updated_at
    BEFORE UPDATE ON habits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to habit_completions
DROP TRIGGER IF EXISTS update_habit_completions_updated_at ON habit_completions;
CREATE TRIGGER update_habit_completions_updated_at
    BEFORE UPDATE ON habit_completions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Performance indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_deleted ON habits(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_habits_updated ON habits(updated_at);
CREATE INDEX IF NOT EXISTS idx_completions_user_date ON habit_completions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_completions_updated ON habit_completions(updated_at);

-- 6. Update existing records to have updated_at set
UPDATE habits SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE habit_completions SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;
