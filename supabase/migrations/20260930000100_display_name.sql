-- The name somebody chose, where their friends can see it.
--
-- `profiles` has had a username since friends existed, and the app has had a
-- *name* — the one typed on the profile page — since before that. They live in
-- two different places: the username on the server, the name in AsyncStorage on
-- the phone. So every friend was shown a handle, and the name they had actually
-- written for themselves was visible only to them.
--
-- A username is still the address: it is unique, lowercase, and how somebody is
-- found. A display name is what a person is called, and neither is a substitute
-- for the other — which is why this is a second column and not a rename.
--
-- Applied 2026-09-30.
--   node scripts/apply-migration.mjs supabase/migrations/20260930000100_display_name.sql

alter table public.profiles
    add column if not exists display_name text;

-- Long enough for a name, short enough not to be a paragraph in a list row.
alter table public.profiles
    drop constraint if exists profiles_display_name_length;
alter table public.profiles
    add constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 40);

notify pgrst, 'reload schema';
