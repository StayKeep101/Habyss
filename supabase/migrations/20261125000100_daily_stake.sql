-- 500 Shards a day to put at stake.
--
-- Stakes had no ceiling but your balance: All in on a race, and Habyss adding
-- up to 1,000 more for winning it fast. A box you tick yourself, worth that
-- much, is worth faking; losing that much makes a miss desperate.
--
-- Now everyone has 500 Shards a day to put on things: races, bets on friends'
-- races, bets on friends' goals, duels, all from the same 500. Use them or
-- don't; tomorrow there are 500 again (they never carry over). A refund (a
-- race or a market nobody took, a declined duel) gives that room back.
-- "Today" is the account's own day (profiles.timezone), not UTC's.
--
-- Enforced on the ledger itself, so every way of staking, now or later, obeys
-- it. Because the match and the speed bonus never exceed the stake, Habyss
-- can add at most 1,000 Shards a day.

create or replace function public.stake_left_today(p_user uuid)
returns integer
language sql stable security definer set search_path to ''
as $$
    with zone as (
        -- A zone Postgres does not know would make every stake fail: UTC instead.
        select coalesce((select n.name from pg_catalog.pg_timezone_names n where n.name = p.timezone), 'UTC') as tz
          from (select 1) one left join public.profiles p on p.id = p_user
    ), day as (
        select (date_trunc('day', now() at time zone z.tz)) at time zone z.tz as starts from zone z
    )
    select greatest(0, 500 - greatest(0,
        coalesce((select sum(-l.amount) from public.shards_ledger l, day
                   where l.user_id = p_user and l.reason = 'stake' and l.created_at >= day.starts), 0)
      - coalesce((select sum(l.amount) from public.shards_ledger l, day
                   where l.user_id = p_user and l.reason = 'refund' and l.created_at >= day.starts), 0)
    ))::int;
$$;
revoke all on function public.stake_left_today(uuid) from public, anon, authenticated;

-- What the app shows: what you can still put at stake today.
create or replace function public.my_stake_today()
returns integer
language sql stable security definer set search_path to ''
as $$
    select public.stake_left_today((select auth.uid()));
$$;
revoke all on function public.my_stake_today() from public, anon;
grant execute on function public.my_stake_today() to authenticated;

create or replace function public.guard_daily_stake()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
    left_today integer;
begin
    if new.reason <> 'stake' then return new; end if;
    -- One stake at a time per person, so two at once cannot both fit.
    perform pg_advisory_xact_lock(hashtext('daily_stake:' || new.user_id::text));
    left_today := public.stake_left_today(new.user_id);
    if -new.amount > left_today then
        raise exception '%', case when left_today = 0
            then 'That''s today''s 500 Shards at stake. More tomorrow.'
            else 'You have ' || left_today || ' Shards left to stake today.' end;
    end if;
    return new;
end;
$$;

drop trigger if exists daily_stake on public.shards_ledger;
create trigger daily_stake before insert on public.shards_ledger
    for each row execute function public.guard_daily_stake();
