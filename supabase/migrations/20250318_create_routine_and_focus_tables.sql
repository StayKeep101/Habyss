-- ============================================
-- Habyss Database Migration
-- Create Routines and Focus Sessions Tables
-- Created: 2025-03-18
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ROUTINES TABLE
-- Stores user-defined routines (collections of habits)
-- ============================================
CREATE TABLE IF NOT EXISTS routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '⭐',
    description TEXT,
    time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_user_active ON routines(user_id, is_active);

-- ============================================
-- ROUTINE_HABITS TABLE
-- Links habits to routines with timer configuration
-- ============================================
CREATE TABLE IF NOT EXISTS routine_habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    timer_mode TEXT DEFAULT 'pomodoro' CHECK (timer_mode IN ('pomodoro', 'deep_focus', 'flow', 'sprint', 'check_in')),
    focus_duration INTEGER DEFAULT 1500, -- Duration in seconds (default 25 minutes)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(routine_id, habit_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_routine_habits_routine ON routine_habits(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_habits_habit ON routine_habits(habit_id);

-- ============================================
-- ROUTINE_SESSIONS TABLE
-- Tracks routine execution history
-- ============================================
CREATE TABLE IF NOT EXISTS routine_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_habits INTEGER NOT NULL,
    completed_habits INTEGER DEFAULT 0,
    total_focus_time INTEGER DEFAULT 0, -- Total time in seconds
    completed BOOLEAN DEFAULT false,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_routine_sessions_user ON routine_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_routine_sessions_routine ON routine_sessions(routine_id, date);

-- ============================================
-- FOCUS_SESSIONS TABLE
-- Tracks individual focus/timer sessions
-- ============================================
CREATE TABLE IF NOT EXISTS focus_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
    mode TEXT DEFAULT 'pomodoro' CHECK (mode IN ('pomodoro', 'deep_focus', 'flow', 'sprint', 'check_in')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    planned_duration INTEGER NOT NULL, -- Duration in seconds
    actual_duration INTEGER NOT NULL, -- Actual time spent in seconds
    completed BOOLEAN DEFAULT false, -- true if timer reached 0, false if stopped early
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5), -- Optional session quality rating
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_habit ON focus_sessions(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_date ON focus_sessions(date);

-- ============================================
-- FOCUS_STATS TABLE
-- Aggregate statistics for focus time (cached/denormalized)
-- ============================================
CREATE TABLE IF NOT EXISTS focus_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    today_total INTEGER DEFAULT 0,
    today_sessions INTEGER DEFAULT 0,
    today_best INTEGER DEFAULT 0,
    week_total INTEGER DEFAULT 0,
    week_active_days INTEGER DEFAULT 0,
    week_sessions INTEGER DEFAULT 0,
    week_completed_sessions INTEGER DEFAULT 0,
    month_total INTEGER DEFAULT 0,
    year_total INTEGER DEFAULT 0,
    all_time_best INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own routines" ON routines;
DROP POLICY IF EXISTS "Users can view routine habits through routines" ON routine_habits;
DROP POLICY IF EXISTS "Users can manage their own routine sessions" ON routine_sessions;
DROP POLICY IF EXISTS "Users can manage their own focus sessions" ON focus_sessions;
DROP POLICY IF EXISTS "Users can manage their own focus stats" ON focus_stats;

-- Routines policies
CREATE POLICY "Users can manage their own routines"
    ON routines FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Routine habits policies (inherit access from parent routine)
CREATE POLICY "Users can view routine habits through routines"
    ON routine_habits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM routines
            WHERE routines.id = routine_habits.routine_id
            AND routines.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM routines
            WHERE routines.id = routine_habits.routine_id
            AND routines.user_id = auth.uid()
        )
    );

-- Routine sessions policies
CREATE POLICY "Users can manage their own routine sessions"
    ON routine_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Focus sessions policies
CREATE POLICY "Users can manage their own focus sessions"
    ON focus_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Focus stats policies
CREATE POLICY "Users can manage their own focus stats"
    ON focus_stats FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_routines_updated_at ON routines;
CREATE TRIGGER update_routines_updated_at
    BEFORE UPDATE ON routines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_focus_stats_updated_at ON focus_stats;
CREATE TRIGGER update_focus_stats_updated_at
    BEFORE UPDATE ON focus_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant access to authenticated users
GRANT ALL ON routines TO authenticated;
GRANT ALL ON routine_habits TO authenticated;
GRANT ALL ON routine_sessions TO authenticated;
GRANT ALL ON focus_sessions TO authenticated;
GRANT ALL ON focus_stats TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Insert migration record
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
        CREATE TABLE schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    INSERT INTO schema_migrations (version, applied_at)
    VALUES ('20250318_create_routine_and_focus_tables', NOW())
    ON CONFLICT (version) DO NOTHING;
END $$;

-- Log success
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully: routines, routine_habits, routine_sessions, focus_sessions, and focus_stats tables created with RLS policies';
END $$;
