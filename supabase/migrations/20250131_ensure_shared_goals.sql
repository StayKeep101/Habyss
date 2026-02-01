-- Ensure shared_goals table exists and has proper RLS policies
-- Run this in your Supabase SQL Editor to enable the shared goals feature

-- 1. Create shared_goals table if not exists
create table if not exists shared_goals (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references habits(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,
  shared_with_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(goal_id, shared_with_id)
);

-- 2. Enable RLS
alter table shared_goals enable row level security;

-- 3. Drop existing policies to avoid conflicts (safe to run multiple times)
drop policy if exists "Users can view shared goals" on shared_goals;
drop policy if exists "Users can share own goals" on shared_goals;
drop policy if exists "Users can unshare own goals" on shared_goals;

-- 4. Create fresh policies
create policy "Users can view shared goals" on shared_goals
  for select using (auth.uid() = owner_id or auth.uid() = shared_with_id);

create policy "Users can share own goals" on shared_goals
  for insert with check (auth.uid() = owner_id);

create policy "Users can unshare own goals" on shared_goals
  for delete using (auth.uid() = owner_id);

-- 5. Allow users to view habits/goals that have been shared with them
-- This is needed so getGoalsSharedWithMe() can fetch the goal details
drop policy if exists "Users can view goals shared with them" on public.habits;

create policy "Users can view goals shared with them" on public.habits
  for select using (
    id in (
      select goal_id from shared_goals where shared_with_id = auth.uid()
    )
  );

-- Verify the setup
select 'shared_goals table created successfully' as status;
