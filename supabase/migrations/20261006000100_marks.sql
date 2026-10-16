-- Marks, where friends can see them.
--
-- Marks are worked out on each phone from what is already recorded, so there
-- was nothing on the server for a friend to read. The phone now publishes its
-- total here (and nothing when its owner has switched progress sharing off), so
-- the Community tab can show everybody's rank and Marks.
--
-- profiles is column-granted (see 20260918), so a new column is unreadable
-- until it is granted.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261006000100_marks.sql

alter table public.profiles add column if not exists marks integer
    check (marks is null or marks >= 0);
alter table public.profiles add column if not exists marks_updated_at timestamptz;

grant select (marks, marks_updated_at) on public.profiles to authenticated;
grant update (marks, marks_updated_at) on public.profiles to authenticated;

notify pgrst, 'reload schema';
