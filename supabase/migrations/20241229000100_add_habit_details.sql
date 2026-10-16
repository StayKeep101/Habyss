-- Add new columns to habits table
ALTER TABLE public.habits 
ADD COLUMN description text,
ADD COLUMN type text DEFAULT 'build', -- 'build' or 'quit'
ADD COLUMN color text DEFAULT '#6B46C1',
ADD COLUMN goal_period text DEFAULT 'daily',
ADD COLUMN goal_value integer DEFAULT 1,
ADD COLUMN unit text DEFAULT 'count',
ADD COLUMN task_days jsonb DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
ADD COLUMN reminders jsonb DEFAULT '[]'::jsonb,
ADD COLUMN chart_type text DEFAULT 'bar',
ADD COLUMN start_date date DEFAULT CURRENT_DATE,
ADD COLUMN end_date date,
ADD COLUMN is_archived boolean DEFAULT false,
ADD COLUMN show_memo boolean DEFAULT false;

-- Update existing rows to have default values where necessary
UPDATE public.habits SET type = 'build' WHERE type IS NULL;
UPDATE public.habits SET color = '#6B46C1' WHERE color IS NULL;
