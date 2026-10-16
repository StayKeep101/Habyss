-- A small Marks history on the profile, for the graph a profile shows when
-- it has no cover photo.
--
-- At most 60 numbers (the running total, one per day, oldest first). Written
-- by the owner's phone with the total, under the same `progress` switch: off
-- means both are cleared.
--
--   node scripts/apply-migration.mjs

alter table public.profiles add column if not exists marks_series integer[];
alter table public.profiles drop constraint if exists profiles_marks_series_length;
alter table public.profiles add constraint profiles_marks_series_length
    check (marks_series is null or cardinality(marks_series) <= 60);

grant select (marks_series) on public.profiles to authenticated;
grant update (marks_series) on public.profiles to authenticated;

notify pgrst, 'reload schema';
