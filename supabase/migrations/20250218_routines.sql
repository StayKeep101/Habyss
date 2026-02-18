-- =============================================
-- Routines System
-- Industry-standard sequential habit execution
-- =============================================

-- Routines table
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '☀️',
    description TEXT,
    time_of_day TEXT NOT NULL DEFAULT 'morning'
        CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routines_user
    ON public.routines(user_id, sort_order);

-- Junction table: habits within a routine (ordered)
CREATE TABLE IF NOT EXISTS public.routine_habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
    habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    -- Per-habit overrides within this routine
    timer_mode TEXT DEFAULT 'pomodoro'
        CHECK (timer_mode IN ('pomodoro', 'deep_focus', 'flow', 'sprint', 'check_in')),
    focus_duration INTEGER DEFAULT 1500,  -- seconds (25 min)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(routine_id, habit_id),
    UNIQUE(routine_id, position)
);

CREATE INDEX IF NOT EXISTS idx_routine_habits_routine
    ON public.routine_habits(routine_id, position);

-- Routine session records (each execution of a full routine)
CREATE TABLE IF NOT EXISTS public.routine_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_habits INTEGER NOT NULL DEFAULT 0,
    completed_habits INTEGER DEFAULT 0,
    total_focus_time INTEGER DEFAULT 0,  -- seconds
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_sessions_user
    ON public.routine_sessions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_routine_sessions_routine
    ON public.routine_sessions(routine_id, date DESC);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_routines_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS routines_updated_at ON public.routines;
CREATE TRIGGER routines_updated_at
    BEFORE UPDATE ON public.routines
    FOR EACH ROW EXECUTE FUNCTION update_routines_updated_at();

DROP TRIGGER IF EXISTS routine_sessions_updated_at ON public.routine_sessions;
CREATE TRIGGER routine_sessions_updated_at
    BEFORE UPDATE ON public.routine_sessions
    FOR EACH ROW EXECUTE FUNCTION update_routines_updated_at();

-- RLS
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_sessions ENABLE ROW LEVEL SECURITY;

-- Routines policies
CREATE POLICY "Users manage own routines" ON public.routines
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routine habits policies (user owns the routine)
CREATE POLICY "Users manage own routine habits" ON public.routine_habits
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.routines WHERE id = routine_id AND user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.routines WHERE id = routine_id AND user_id = auth.uid())
    );

-- Routine sessions policies
CREATE POLICY "Users manage own routine sessions" ON public.routine_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
