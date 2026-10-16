-- =============================================
-- Enhance Focus Sessions (per HabyssTimer.md v1.0)
-- =============================================

-- Add quality rating (post-session feedback)
ALTER TABLE public.focus_sessions
    ADD COLUMN IF NOT EXISTS quality_rating INTEGER
        CHECK (quality_rating IS NULL OR (quality_rating >= 1 AND quality_rating <= 5));

-- Add session phase tracking
ALTER TABLE public.focus_sessions
    ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'focus'
        CHECK (phase IN ('focus', 'short_break', 'long_break'));

-- Add timer mode
ALTER TABLE public.focus_sessions
    ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'pomodoro'
        CHECK (mode IN ('pomodoro', 'deep_focus', 'flow', 'sprint', 'check_in'));

-- Add session number within cycle
ALTER TABLE public.focus_sessions
    ADD COLUMN IF NOT EXISTS session_number INTEGER DEFAULT 1;

-- Add routine context (which routine this session belongs to, if any)
ALTER TABLE public.focus_sessions
    ADD COLUMN IF NOT EXISTS routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL;

-- Add routine session reference
ALTER TABLE public.focus_sessions
    ADD COLUMN IF NOT EXISTS routine_session_id UUID REFERENCES public.routine_sessions(id) ON DELETE SET NULL;

-- Index for quality analytics
CREATE INDEX IF NOT EXISTS idx_focus_sessions_quality
    ON public.focus_sessions(user_id, quality_rating)
    WHERE quality_rating IS NOT NULL;
