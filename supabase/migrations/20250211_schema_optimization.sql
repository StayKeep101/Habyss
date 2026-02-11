-- Schema Optimization Migration
-- Aligns Supabase with SQLite V2 columns, adds constraints and performance indexes

-- =============================================
-- 1. ADD MISSING HABIT COLUMNS (match SQLite V2)
-- =============================================

ALTER TABLE habits ADD COLUMN IF NOT EXISTS graph_style TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS tracking_method TEXT DEFAULT 'boolean';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_offset INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS location_reminders JSONB DEFAULT '[]'::jsonb;

-- =============================================
-- 2. CHECK CONSTRAINTS (data integrity)
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_tracking_method_check') THEN
        ALTER TABLE habits ADD CONSTRAINT habits_tracking_method_check
        CHECK (tracking_method IN ('boolean', 'quantity', 'duration', 'rating'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_goal_value_check') THEN
        ALTER TABLE habits ADD CONSTRAINT habits_goal_value_check
        CHECK (goal_value >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_duration_check') THEN
        ALTER TABLE habits ADD CONSTRAINT habits_duration_check
        CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_graph_style_check') THEN
        ALTER TABLE habits ADD CONSTRAINT habits_graph_style_check
        CHECK (graph_style IS NULL OR graph_style IN ('progress', 'bar', 'line', 'heatmap', 'streak'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_week_interval_check') THEN
        ALTER TABLE habits ADD CONSTRAINT habits_week_interval_check
        CHECK (week_interval IS NULL OR week_interval >= 1);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 3. COMPOSITE PERFORMANCE INDEXES
-- =============================================

-- Active habits query (most common read: user's non-archived, non-deleted habits)
CREATE INDEX IF NOT EXISTS idx_habits_user_active
    ON habits(user_id, is_archived, deleted_at)
    WHERE deleted_at IS NULL;

-- Category filter (browsing habits by category)
CREATE INDEX IF NOT EXISTS idx_habits_user_category
    ON habits(user_id, category)
    WHERE deleted_at IS NULL;

-- Completions daily lookup (most common: check if habit done today)
CREATE INDEX IF NOT EXISTS idx_completions_habit_date_active
    ON habit_completions(habit_id, date DESC)
    WHERE deleted_at IS NULL;

-- Completions by user and date range (analytics, history views)
CREATE INDEX IF NOT EXISTS idx_completions_user_date_range
    ON habit_completions(user_id, date DESC)
    WHERE deleted_at IS NULL;

-- Sync: find records updated since last sync
CREATE INDEX IF NOT EXISTS idx_habits_sync_updated
    ON habits(user_id, updated_at DESC)
    WHERE deleted_at IS NULL;

-- =============================================
-- 4. ENSURE VALUE COLUMN ON COMPLETIONS
-- =============================================

-- Supports quantity tracking (e.g., 3 glasses of water)
ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 1;
ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS memo TEXT;

-- =============================================
-- 5. BACKFILL DEFAULTS
-- =============================================

UPDATE habits SET tracking_method = 'boolean' WHERE tracking_method IS NULL;
UPDATE habits SET graph_style = 'bar' WHERE graph_style IS NULL;
