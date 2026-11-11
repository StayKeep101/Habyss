-- Earn your scroll (lib/appGate.ts): an hour of the blocked apps for 100 Shards,
-- before today's top 3 are done. Spent through the same ledger as bets and duels,
-- so the balance is the server's, never the phone's.

alter table public.shards_ledger drop constraint if exists shards_ledger_reason_check;
alter table public.shards_ledger add constraint shards_ledger_reason_check
    check (reason in ('stake', 'payout', 'refund', 'unlock'));

-- Spends 100 Shards for an hour. Returns what is left to spend.
create or replace function public.buy_scroll_hour()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    price constant integer := 100;
begin
    if me is null then raise exception 'Sign in to spend Shards.'; end if;
    -- One purchase at a time per person, so two quick taps cannot both pass the balance check.
    perform pg_advisory_xact_lock(hashtext('buy_scroll_hour:' || me::text));
    if public.shards_spendable(me) < price then raise exception 'Not enough Shards: an hour costs 100.'; end if;
    insert into public.shards_ledger (user_id, amount, reason) values (me, -price, 'unlock');
    return public.shards_spendable(me);
end;
$$;
revoke all on function public.buy_scroll_hour() from public, anon;
grant execute on function public.buy_scroll_hour() to authenticated;

-- The wallet's list names it.
create or replace function public.my_ledger(p_limit int default 100)
returns table (amount int, reason text, created_at timestamptz, title text)
language sql stable security definer set search_path to ''
as $$
    select l.amount, l.reason, l.created_at,
           case when l.reason = 'unlock' then 'An hour of your apps'
                else coalesce(m.title, case when d.id is not null then 'Duel with ' || coalesce(nullif(btrim(f.display_name), ''), f.username, 'a friend') end)
           end
      from public.shards_ledger l
      left join public.goal_markets m on m.id = l.market_id
      left join public.duels d on d.id = l.duel_id
      left join public.profiles f on f.id = case when d.challenger_id = l.user_id then d.opponent_id else d.challenger_id end
     where l.user_id = (select auth.uid())
     order by l.created_at desc
     limit least(greatest(p_limit, 1), 500);
$$;

notify pgrst, 'reload schema';
