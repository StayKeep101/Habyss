-- A username is one handle, not one per capitalisation.
--
-- The bug this fixes, exactly: the app lowercases a username everywhere it
-- reads one — `usernameFrom` ends with `.toLowerCase()`, because a handle typed
-- as "@Pen" and a handle typed as "@pen" are obviously meant to be the same
-- person — and then looks it up with `eq('username', ...)`, which is case
-- sensitive. Three of the three accounts on this project were stored with a
-- capital, so scanning a QR code for @Pen searched for "pen" and was told
-- nobody is called that.
--
-- `setMyUsername` has lowercased since it was written, so these rows came from
-- an older build or from the dashboard. That is the argument for fixing it
-- here rather than only in the app: the database is the one place that can
-- promise it about rows the app did not write.
--
-- The unique constraint was case sensitive too, which is worse than it looks —
-- @Pen and @pen could be two different accounts, and a QR code would resolve to
-- whichever of them the search happened to match. Forcing lowercase makes the
-- existing unique index case insensitive by construction.
--
-- Applied 2026-09-29.
--   node scripts/apply-migration.mjs supabase/migrations/20260929000400_usernames_are_lowercase.sql

-- Checked for collisions first: no two accounts here differ only by case.
update public.profiles
   set username = lower(username)
 where username is not null
   and username <> lower(username);

-- Null stays allowed: a profile exists before its owner has chosen a handle.
alter table public.profiles
    drop constraint if exists profiles_username_lowercase;
alter table public.profiles
    add constraint profiles_username_lowercase
    check (username is null or username = lower(username));

-- The same rule the app applies (USERNAME_RULE in lib/friendsService.ts), so
-- the two cannot drift apart and leave the app able to save a handle it can
-- never find again.
alter table public.profiles
    drop constraint if exists profiles_username_shape;
alter table public.profiles
    add constraint profiles_username_shape
    check (username is null or username ~ '^[a-z0-9_.]{3,20}$');

notify pgrst, 'reload schema';
