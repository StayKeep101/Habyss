-- A task reminded like a habit: at a time on its day, and at places (arriving
-- or leaving). Until this is applied the app backs up without the columns.
alter table public.tasks add column if not exists reminder text;
alter table public.tasks add column if not exists location_reminders jsonb;
notify pgrst, 'reload schema';
