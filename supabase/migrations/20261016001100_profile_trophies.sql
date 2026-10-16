-- Two numbers to be proud of on a profile: the longest streak ever kept and
-- how many goals were finished. Written by the owner's phone with Marks,
-- under the same `progress` switch: off means they are cleared.
--
--   node scripts/apply-migration.mjs

alter table public.profiles add column if not exists best_streak integer check (best_streak is null or best_streak >= 0);
alter table public.profiles add column if not exists goals_completed integer check (goals_completed is null or goals_completed >= 0);

grant select (best_streak, goals_completed) on public.profiles to authenticated;
grant update (best_streak, goals_completed) on public.profiles to authenticated;

notify pgrst, 'reload schema';
