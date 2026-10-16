-- Create habits table
create table public.habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  category text not null,
  icon text,
  created_at timestamptz default now(),
  duration_minutes integer,
  start_time text,
  end_time text,
  is_goal boolean default false,
  target_date timestamptz
);

-- Create completions table
create table public.habit_completions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  habit_id uuid references public.habits(id) on delete cascade not null,
  date date not null,
  completed boolean default true,
  created_at timestamptz default now(),
  unique(habit_id, date)
);

-- Enable RLS
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

-- Policies for habits
create policy "Users can view their own habits" on public.habits
  for select using (auth.uid() = user_id);

create policy "Users can insert their own habits" on public.habits
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own habits" on public.habits
  for update using (auth.uid() = user_id);

create policy "Users can delete their own habits" on public.habits
  for delete using (auth.uid() = user_id);

-- Policies for completions
create policy "Users can view their own completions" on public.habit_completions
  for select using (auth.uid() = user_id);

create policy "Users can insert their own completions" on public.habit_completions
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own completions" on public.habit_completions
  for update using (auth.uid() = user_id);

create policy "Users can delete their own completions" on public.habit_completions
  for delete using (auth.uid() = user_id);
