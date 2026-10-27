-- The heading a task sits under in its goal's to-do list ("Research").
-- Without it, a reinstall brought every goal to-do back unsorted.
alter table public.tasks add column if not exists section text
    check (section is null or char_length(section) <= 80);

notify pgrst, 'reload schema';
