-- The cover photo, shared like the profile picture.
--
-- It lived only on the phone (a file:// path), so a friend's view of your
-- profile could never match yours. It is uploaded to the same avatars bucket,
-- into the owner's own folder, and follows the same `photo` sharing switch:
-- off means the column is cleared, not merely hidden.
--
--   node scripts/apply-migration.mjs

alter table public.profiles add column if not exists cover_url text;

grant select (cover_url) on public.profiles to authenticated;
grant update (cover_url) on public.profiles to authenticated;

notify pgrst, 'reload schema';
