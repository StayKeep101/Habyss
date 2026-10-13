-- Create Routines Tables based on RoutineContext.tsx

-- 1. Routines Table
CREATE TABLE IF NOT EXISTS routines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    time_of_day TEXT NOT NULL CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Routine Habits (Junction Table)
CREATE TABLE IF NOT EXISTS routine_habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id UUID REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
    position INTEGER DEFAULT 0,
    timer_mode TEXT DEFAULT 'pomodoro',
    focus_duration INTEGER DEFAULT 1500, -- seconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Routine Sessions (Tracking)
CREATE TABLE IF NOT EXISTS routine_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    routine_id UUID REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_habits INTEGER DEFAULT 0,
    completed_habits INTEGER DEFAULT 0,
    total_focus_time INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Routines
CREATE POLICY "Users can view own routines" ON routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON routines FOR DELETE USING (auth.uid() = user_id);

-- Routine Habits
-- (Inherit access via routine_id usually, but simple ownership check if we join?)
-- Ideally check if routine belongs to user, but for simplicity/perf:
-- We don't have user_id on routine_habits, so we check via routine.
CREATE POLICY "Users can view own routine habits" ON routine_habits FOR SELECT USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_habits.routine_id AND routines.user_id = auth.uid())
);
CREATE POLICY "Users can manage own routine habits" ON routine_habits FOR ALL USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_habits.routine_id AND routines.user_id = auth.uid())
);

-- Routine Sessions
CREATE POLICY "Users can view own sessions" ON routine_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON routine_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON routine_sessions FOR UPDATE USING (auth.uid() = user_id);
