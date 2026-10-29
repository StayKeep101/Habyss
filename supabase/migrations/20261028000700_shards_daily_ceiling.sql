-- Shards follow the full table now (lib/shards.ts): adding and completing
-- earn, missing costs, as Marks used to; Marks are XP and only go up. A real
-- day can earn far more than twenty, so the ceiling the server holds earned
-- Shards to is the phone's own daily cap: 200 for every day the account has
-- existed. Still enough to stop an edited phone minting them.
--
--   node scripts/apply-migration.mjs

create or replace function public.cap_shards_earned()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
    born date;
begin
    if new.shards_earned is not distinct from old.shards_earned then return new; end if;
    select created_at::date into born from auth.users where id = new.id;
    new.shards_earned := least(greatest(new.shards_earned, 0), 200 * (current_date - coalesce(born, current_date) + 1));
    return new;
end;
$$;

notify pgrst, 'reload schema';
