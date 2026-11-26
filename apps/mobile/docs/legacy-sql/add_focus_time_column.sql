-- Add 'value' column to habit_completions to store focus time (minutes)
ALTER TABLE habit_completions 
ADD COLUMN value INTEGER DEFAULT 0;

-- Optional: Create an index for performance on date ranges if not already present
CREATE INDEX IF NOT EXISTS idx_habit_completions_date_user 
ON habit_completions(date, user_id);
