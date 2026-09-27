-- What a habit's reminder says, when the user wrote it themselves.
--
-- Local schema v11 adds `reminder_message` to the device's habits table. It is
-- deliberately left out of lib/cloudMapping.ts until this has been applied:
-- uploading a column the server does not have would fail every habit sync, so
-- the field stays on the device rather than breaking backup for everyone.
--
-- Apply with:  node scripts/apply-migration.mjs supabase/migrations/20260926_habit_reminder_message.sql
-- Then add `reminder_message` to cloudMapping so it backs up and restores.

alter table public.habits
    add column if not exists reminder_message text;
