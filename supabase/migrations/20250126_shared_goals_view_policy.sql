-- Add policy to allow users to view habits/goals shared with them
-- This enables the "Goals shared with you" feature in the Community tab

create policy "Users can view goals shared with them" on public.habits
  for select using (
    id in (
      select goal_id from shared_goals where shared_with_id = auth.uid()
    )
  );
