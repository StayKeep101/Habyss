-- Add goal_id to habits table to link habits to goals
ALTER TABLE public.habits 
ADD COLUMN goal_id uuid REFERENCES public.habits(id) ON DELETE SET NULL;

-- Create index for faster lookup
CREATE INDEX idx_habits_goal_id ON public.habits(goal_id);
