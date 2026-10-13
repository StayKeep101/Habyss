-- =====================================================
-- Habyss Supabase Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. PROFILES TABLE (for friend search & user data)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text,
  avatar_url text,
  push_token text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies for profiles
create policy "Users can view any profile" on profiles
  for select using (true);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- 2. AUTO-CREATE PROFILE ON USER SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id, 
    new.email, 
    lower(split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists (for re-running)
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- 3. FRIENDSHIPS TABLE
-- =====================================================
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user_id, friend_id)
);

alter table friendships enable row level security;

create policy "Users can view own friendships" on friendships
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can create friendships" on friendships
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own friendships" on friendships
  for delete using (auth.uid() = user_id);

-- =====================================================
-- 4. FRIEND REQUESTS TABLE
-- =====================================================
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references profiles(id) on delete cascade,
  to_user_id uuid references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique(from_user_id, to_user_id)
);

alter table friend_requests enable row level security;

create policy "Users can view own requests" on friend_requests
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Users can send requests" on friend_requests
  for insert with check (auth.uid() = from_user_id);

create policy "Users can update received requests" on friend_requests
  for update using (auth.uid() = to_user_id);

-- =====================================================
-- 5. SHARED HABITS TABLE
-- =====================================================
create table if not exists shared_habits (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,
  shared_with_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(habit_id, shared_with_id)
);

alter table shared_habits enable row level security;

create policy "Users can view shared habits" on shared_habits
  for select using (auth.uid() = owner_id or auth.uid() = shared_with_id);

create policy "Users can share own habits" on shared_habits
  for insert with check (auth.uid() = owner_id);

create policy "Users can unshare own habits" on shared_habits
  for delete using (auth.uid() = owner_id);

-- =====================================================
-- Done! Your database is ready for the Community feature.
-- =====================================================
