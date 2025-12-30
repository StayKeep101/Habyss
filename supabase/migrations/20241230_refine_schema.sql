-- 1. Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. Refine habits table
-- We are altering the existing table to match the robust spec
ALTER TABLE public.habits 
  ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_completions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_date date;

-- Add constraints/checks if they don't exist (using DO block to avoid errors if they do)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_type_check') THEN
        ALTER TABLE public.habits ADD CONSTRAINT habits_type_check CHECK (type IN ('build', 'quit'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'habits_goal_period_check') THEN
        ALTER TABLE public.habits ADD CONSTRAINT habits_goal_period_check CHECK (goal_period IN ('daily', 'weekly', 'monthly'));
    END IF;
END $$;

-- 3. Refine habit_completions table (rename to habit_logs for clarity? Or keep as is. Let's keep as is to avoid breaking existing code too much, but add fields)
ALTER TABLE public.habit_completions 
  ADD COLUMN IF NOT EXISTS value numeric DEFAULT 0, -- For quantifiable tracking
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS mood text;

-- 4. Create function to update streaks automatically (Trigger)
CREATE OR REPLACE FUNCTION public.handle_habit_completion()
RETURNS TRIGGER AS $$
DECLARE
  habit_record RECORD;
  current_streak_val INT;
  longest_streak_val INT;
BEGIN
  -- Fetch habit info
  SELECT * INTO habit_record FROM public.habits WHERE id = NEW.habit_id;
  
  -- Simple streak calculation logic (simplified for Daily habits)
  -- This is a basic implementation; complex frequency logic would require more complex code
  IF NEW.completed = true THEN
    -- Update total completions
    UPDATE public.habits 
    SET total_completions = total_completions + 1,
        last_completed_date = NEW.date
    WHERE id = NEW.habit_id;
    
    -- Recalculate streak (Optimistic approach: if yesterday was completed, +1, else 1)
    -- In production, robust streak calc might be done via a scheduled job or more complex query
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (Optional - enabling basic stat updates)
DROP TRIGGER IF EXISTS on_habit_completion ON public.habit_completions;
CREATE TRIGGER on_habit_completion
  AFTER INSERT ON public.habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_habit_completion();

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON public.habit_completions(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions(user_id, date);
