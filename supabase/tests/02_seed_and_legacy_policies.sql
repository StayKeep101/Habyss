alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
alter table public.habits enable row level security;
create policy "Users can view own habits" on public.habits for select using (auth.uid() = user_id);
alter table public.habit_completions enable row level security;
create policy "Users can view own completions" on public.habit_completions for select using (auth.uid() = user_id);
-- Two users with real-looking data, like the two accounts in production.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@example.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@example.com');
insert into public.profiles (id, username, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice', 'alice@example.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob', 'bob@example.com');
insert into public.habits (id, user_id, name, category, goal_value, target_date, is_goal) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Run 50 km', 'body', 50, '2026-09-30 00:00:00+00', true),
  ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Run', 'body', 4, null, false),
  ('22222222-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Read', 'mind', 10, null, false);
update public.habits set goal_id = '11111111-0000-4000-8000-000000000001' where id = '11111111-0000-4000-8000-000000000002';
insert into public.habit_completions (user_id, habit_id, date, value) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '2026-09-17', 4),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', '2026-09-17', 10);
insert into public.friendships (user_id, friend_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002');
