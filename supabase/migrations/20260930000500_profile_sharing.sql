-- A profile a friend can actually see, and control over how much of it.
--
-- Three things were device-only and so invisible to everybody else: the name
-- (fixed by 20260930000100_display_name), the bio, and the picture. A profile page
-- that shows a friend less than it shows you is a page that is quietly lying
-- about one of the two.
--
-- The picture needs somewhere to live. The app stores a local `file://` URI,
-- which means nothing on anybody else's phone, so there is a bucket now and the
-- app uploads on pick. Public-read because an avatar is shown in a feed to
-- people who may not share a row with you yet, and write-scoped to a folder
-- named after the owner so nobody can replace anybody else's face.
--
-- Sharing is opt-out per field rather than all-or-nothing. "Everything or
-- nothing" is not a privacy setting, it is an ultimatum.
--
-- Applied 2026-09-30.
--   node scripts/apply-migration.mjs supabase/migrations/20260930000500_profile_sharing.sql

alter table public.profiles
    add column if not exists bio text;

alter table public.profiles
    drop constraint if exists profiles_bio_length;
alter table public.profiles
    add constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 300);

/**
 * What this person is willing to show.
 *
 * Defaults to on for everything a friend already sees today, so nothing changes
 * under anybody without them asking. The one exception is the picture, which
 * has never left the phone before — it starts on too, because a profile with
 * sharing off by default is a social feature nobody ever sees working, but it
 * is the first switch in the list so it is easy to find and turn off.
 */
alter table public.profiles
    add column if not exists sharing jsonb not null default
        '{"name": true, "bio": true, "photo": true, "progress": true, "habits": true}'::jsonb;

-- ------------------------------------------------------------------ avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- Anybody may look: an avatar appears in a feed beside people who are not yet
-- friends, and a signed URL per face per render is a great deal of work to hide
-- something its owner is deliberately showing.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
    for select to public
    using (bucket_id = 'avatars');

-- You may only write inside a folder named after you, so nobody can replace
-- anybody else's face.
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
