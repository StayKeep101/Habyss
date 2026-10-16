-- Allow users to view habits linked to goals that are shared with them
-- This enables viewing the full goal detail with all its linked habits

-- Drop existing policy if it exists
drop policy if exists "Users can view habits of shared goals" on public.habits;

-- Create policy to allow viewing habits linked to shared goals
create policy "Users can view habits of shared goals" on public.habits
  for select using (
    goal_id in (
      select goal_id from shared_goals where shared_with_id = auth.uid()
    )
  );
