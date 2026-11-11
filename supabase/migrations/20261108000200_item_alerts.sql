-- A habit's or task's own reminders before it begins (lib/itemAlerts.ts):
-- minutes before its start, as many as wanted ("Study in 10 min").
-- Until this is applied the app backs up without the column (lib/cloudSync.ts).
alter table public.habits add column if not exists alerts integer[];
alter table public.tasks add column if not exists alerts integer[];
notify pgrst, 'reload schema';
