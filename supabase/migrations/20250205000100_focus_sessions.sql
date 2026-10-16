-- =============================================
-- Focus Sessions Table
-- Industry-standard session-level tracking for analytics
-- =============================================

-- Create focus_sessions table for individual session records
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Duration tracking (in seconds)
    planned_duration INTEGER NOT NULL,  -- What user set
    actual_duration INTEGER DEFAULT 0,   -- What was actually focused
    
    -- Completion status
    completed BOOLEAN DEFAULT FALSE,     -- Did timer reach 0 naturally?
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date 
    ON public.focus_sessions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_habit 
    ON public.focus_sessions(habit_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_date_range 
    ON public.focus_sessions(user_id, started_at DESC);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_focus_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS focus_sessions_updated_at_trigger ON public.focus_sessions;
CREATE TRIGGER focus_sessions_updated_at_trigger
    BEFORE UPDATE ON public.focus_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_focus_sessions_updated_at();

-- Enable RLS
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own focus sessions" 
    ON public.focus_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own focus sessions" 
    ON public.focus_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own focus sessions" 
    ON public.focus_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own focus sessions" 
    ON public.focus_sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- =============================================
-- Aggregated Focus Stats View (for efficient queries)
-- =============================================

CREATE OR REPLACE VIEW public.focus_stats AS
SELECT 
    user_id,
    -- Today's stats
    COALESCE(SUM(actual_duration) FILTER (WHERE date = CURRENT_DATE), 0) AS today_total,
    COALESCE(COUNT(*) FILTER (WHERE date = CURRENT_DATE), 0) AS today_sessions,
    COALESCE(MAX(actual_duration) FILTER (WHERE date = CURRENT_DATE AND completed = true), 0) AS today_best,
    
    -- This week (last 7 days)
    COALESCE(SUM(actual_duration) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '6 days'), 0) AS week_total,
    COALESCE(COUNT(DISTINCT date) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '6 days' AND actual_duration > 0), 0) AS week_active_days,
    COALESCE(COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '6 days'), 0) AS week_sessions,
    COALESCE(COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '6 days' AND completed = true), 0) AS week_completed_sessions,
    
    -- This month (last 30 days)
    COALESCE(SUM(actual_duration) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '29 days'), 0) AS month_total,
    COALESCE(COUNT(DISTINCT date) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '29 days' AND actual_duration > 0), 0) AS month_active_days,
    
    -- This year
    COALESCE(SUM(actual_duration) FILTER (WHERE date >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS year_total,
    
    -- All-time best completed session
    COALESCE(MAX(actual_duration) FILTER (WHERE completed = true), 0) AS all_time_best
    
FROM public.focus_sessions
GROUP BY user_id;

-- Grant access to authenticated users
GRANT SELECT ON public.focus_stats TO authenticated;
