-- Create shared_goals table (was missing)
create table if not exists shared_goals (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references habits(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,
  shared_with_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(goal_id, shared_with_id)
);

alter table shared_goals enable row level security;

create policy "Users can view shared goals" on shared_goals
  for select using (auth.uid() = owner_id or auth.uid() = shared_with_id);

create policy "Users can share own goals" on shared_goals
  for insert with check (auth.uid() = owner_id);

create policy "Users can unshare own goals" on shared_goals
  for delete using (auth.uid() = owner_id);
