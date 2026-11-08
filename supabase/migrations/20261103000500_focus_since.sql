-- When a focus session's ring began, beside when it ends.
--
-- Someone joining a friend's session only knew its end (focus_until), so
-- their ring started empty while their friend's was half full. With the
-- start too, both rings stand at the same place. Read straight from
-- profiles (friend_presence keeps its shape; the desktop app reads it).
--
--   node scripts/apply-migration.mjs

alter table public.profiles add column if not exists focus_since timestamptz;
grant select (focus_since), update (focus_since) on public.profiles to authenticated;
