-- =============================================
-- Per-Habit Timer Profiles (per HabyssTimer.md §4.1)
-- =============================================

-- Add timer configuration columns to habits
ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS timer_mode TEXT DEFAULT 'pomodoro'
        CHECK (timer_mode IN ('pomodoro', 'deep_focus', 'flow', 'sprint', 'check_in'));

ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS focus_duration INTEGER DEFAULT 1500;  -- 25 min in seconds

ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS break_duration INTEGER DEFAULT 300;  -- 5 min

ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS long_break_duration INTEGER DEFAULT 900;  -- 15 min

ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS sessions_before_long_break INTEGER DEFAULT 4;

ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS auto_start_breaks BOOLEAN DEFAULT FALSE;

ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS daily_session_goal INTEGER DEFAULT 4;
