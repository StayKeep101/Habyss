-- Duels: you against one friend, for a few days, on who keeps their own plan
-- better.
--
-- Fair across different plans: each person is scored on what they had to do
-- themselves (habits due and tasks planned that day, from their day cards),
-- as the share of it they did. Ties go to whoever showed up on more days;
-- still tied, it is a draw and both stakes come back.
--
-- - one friend, one open duel at a time between the same two people;
-- - 3, 7 or 14 days, starting the day after it is accepted, so nobody gets a
--   head start;
-- - an optional stake of up to 100 Shards, the same from both: the winner
--   takes both, a draw refunds both, a declined or cancelled duel refunds;
-- - settled the day after it ends, so a late tick on the last day still counts.
--
-- Everything goes through the functions below; nothing is written directly.

create table if not exists public.duels (
    id            uuid primary key default gen_random_uuid(),
    challenger_id uuid not null references auth.users(id) on delete cascade,
    opponent_id   uuid not null references auth.users(id) on delete cascade,
    stake         integer not null default 0 check (stake between 0 and 100),
    days          integer not null default 7 check (days in (3, 7, 14)),
    starts        date,
    ends          date,
    status        text not null default 'proposed' check (status in ('proposed', 'active', 'declined', 'cancelled', 'settled')),
    winner_id     uuid references auth.users(id) on delete set null,
    created_at    timestamptz not null default now(),
    settled_at    timestamptz,
    check (challenger_id <> opponent_id)
);
create index if not exists duels_challenger on public.duels (challenger_id, created_at desc);
create index if not exists duels_opponent on public.duels (opponent_id, created_at desc);
-- One open duel between the same two people, whoever challenged.
create unique index if not exists duels_one_open on public.duels (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id))
    where status in ('proposed', 'active');

alter table public.duels enable row level security;
drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to authenticated
    using (challenger_id = (select auth.uid()) or opponent_id = (select auth.uid()));
revoke insert, update, delete on public.duels from authenticated, anon;
grant select on public.duels to authenticated;

-- Stakes move through the same ledger as bets, marked with their duel.
alter table public.shards_ledger add column if not exists duel_id uuid references public.duels(id) on delete set null;

-- ------------------------------------------------------------------ scoring
-- One person's score over a range, from their day cards: what they did of what they had to do.
create or replace function public.duel_score(p_user uuid, p_from date, p_to date)
returns table (done int, total int, days int)
language sql stable security definer set search_path to ''
as $$
    select coalesce(sum(coalesce((c.card ->> 'habitsDone')::int, 0) + coalesce((c.card ->> 'tasksDone')::int, 0)), 0)::int,
           coalesce(sum(coalesce((c.card ->> 'habitsTotal')::int, 0) + coalesce((c.card ->> 'tasksTotal')::int, 0)), 0)::int,
           count(*) filter (where coalesce((c.card ->> 'habitsDone')::int, 0) + coalesce((c.card ->> 'tasksDone')::int, 0) > 0)::int
      from public.day_cards c
     where c.user_id = p_user and c.day between p_from and p_to;
$$;
revoke all on function public.duel_score(uuid, date, date) from public, anon, authenticated;

-- Settles every duel that ended before yesterday. Internal, called by my_duels.
create or replace function public.settle_due_duels()
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    d public.duels;
    a record;
    b record;
    rate_a numeric;
    rate_b numeric;
    winner uuid;
begin
    for d in select * from public.duels where status = 'active' and ends < current_date - 1 for update skip locked loop
        select * into a from public.duel_score(d.challenger_id, d.starts, d.ends);
        select * into b from public.duel_score(d.opponent_id, d.starts, d.ends);
        rate_a := case when a.total > 0 then a.done::numeric / a.total else 0 end;
        rate_b := case when b.total > 0 then b.done::numeric / b.total else 0 end;
        winner := case
            when rate_a > rate_b then d.challenger_id
            when rate_b > rate_a then d.opponent_id
            when a.days > b.days then d.challenger_id
            when b.days > a.days then d.opponent_id
        end;
        if d.stake > 0 then
            if winner is null then
                insert into public.shards_ledger (user_id, amount, reason, duel_id)
                    values (d.challenger_id, d.stake, 'refund', d.id), (d.opponent_id, d.stake, 'refund', d.id);
            else
                insert into public.shards_ledger (user_id, amount, reason, duel_id) values (winner, d.stake * 2, 'payout', d.id);
            end if;
        end if;
        update public.duels set status = 'settled', winner_id = winner, settled_at = now() where id = d.id;
        insert into public.notifications (user_id, from_user_id, type, title, body)
            select u, case when u = d.challenger_id then d.opponent_id else d.challenger_id end, 'duel',
                   case when winner is null then 'Your duel is a draw' when winner = u then 'You won your duel' else 'Your duel is over' end,
                   case when winner is null then 'Dead even. Any Shards at stake are back.'
                        when winner = u then case when d.stake > 0 then '+' || (d.stake * 2) || ' Shards.' else 'Nicely kept.' end
                        else 'They kept a little more this time. Rematch?' end
              from unnest(array[d.challenger_id, d.opponent_id]) as u;
    end loop;
end;
$$;
revoke all on function public.settle_due_duels() from public, anon, authenticated;

-- --------------------------------------------------------------- the moves
create or replace function public.create_duel(p_friend uuid, p_stake integer default 0, p_days integer default 7)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    made uuid;
begin
    if me is null then raise exception 'Sign in to duel a friend.'; end if;
    if p_friend is null or p_friend = me or not public.are_friends(p_friend) or public.blocked_between(me, p_friend) then
        raise exception 'You can only duel a friend.';
    end if;
    if p_stake is null or p_stake < 0 or p_stake > 100 then raise exception 'A stake is 0 to 100 Shards.'; end if;
    if p_days not in (3, 7, 14) then raise exception 'A duel lasts 3, 7 or 14 days.'; end if;
    if exists (select 1 from public.duels where status in ('proposed', 'active')
               and least(challenger_id, opponent_id) = least(me, p_friend) and greatest(challenger_id, opponent_id) = greatest(me, p_friend)) then
        raise exception 'You already have a duel going with them.';
    end if;
    if p_stake > 0 and public.shards_spendable(me) < p_stake then raise exception 'Not enough Shards.'; end if;

    insert into public.duels (challenger_id, opponent_id, stake, days) values (me, p_friend, p_stake, p_days) returning id into made;
    if p_stake > 0 then insert into public.shards_ledger (user_id, amount, reason, duel_id) values (me, -p_stake, 'stake', made); end if;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        values (p_friend, me, 'duel',
                coalesce((select coalesce(nullif(btrim(display_name), ''), username) from public.profiles where id = me), 'A friend') || ' challenged you to a duel',
                p_days || ' days, who keeps their plan better' || case when p_stake > 0 then ', for ' || p_stake || ' Shards each.' else '.' end);
    return made;
end;
$$;
revoke all on function public.create_duel(uuid, integer, integer) from public, anon;
grant execute on function public.create_duel(uuid, integer, integer) to authenticated;

-- The friend challenged: accept (and match the stake) or decline (the challenger gets theirs back).
create or replace function public.respond_duel(p_duel uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    d public.duels;
begin
    select * into d from public.duels where id = p_duel for update;
    if not found or d.opponent_id <> me then raise exception 'That duel isn’t yours to answer.'; end if;
    if d.status <> 'proposed' then raise exception 'That duel has already been answered.'; end if;
    if p_accept then
        if d.stake > 0 and public.shards_spendable(me) < d.stake then raise exception 'Not enough Shards to match the stake.'; end if;
        if d.stake > 0 then insert into public.shards_ledger (user_id, amount, reason, duel_id) values (me, -d.stake, 'stake', d.id); end if;
        update public.duels set status = 'active', starts = current_date + 1, ends = current_date + d.days where id = d.id;
    else
        if d.stake > 0 then insert into public.shards_ledger (user_id, amount, reason, duel_id) values (d.challenger_id, d.stake, 'refund', d.id); end if;
        update public.duels set status = 'declined', settled_at = now() where id = d.id;
    end if;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        values (d.challenger_id, me, 'duel',
                coalesce((select coalesce(nullif(btrim(display_name), ''), username) from public.profiles where id = me), 'Your friend')
                    || case when p_accept then ' accepted your duel' else ' passed on your duel' end,
                case when p_accept then 'It starts tomorrow.' else case when d.stake > 0 then 'Your Shards are back.' else 'Maybe next time.' end end);
end;
$$;
revoke all on function public.respond_duel(uuid, boolean) from public, anon;
grant execute on function public.respond_duel(uuid, boolean) to authenticated;

-- The challenger, before it is answered: take it back.
create or replace function public.cancel_duel(p_duel uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    d public.duels;
begin
    select * into d from public.duels where id = p_duel for update;
    if not found or d.challenger_id <> (select auth.uid()) or d.status <> 'proposed' then raise exception 'That duel can’t be cancelled now.'; end if;
    if d.stake > 0 then insert into public.shards_ledger (user_id, amount, reason, duel_id) values (d.challenger_id, d.stake, 'refund', d.id); end if;
    update public.duels set status = 'cancelled', settled_at = now() where id = d.id;
end;
$$;
revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;

-- Your duels, open or finished in the last two weeks, with both live scores.
create or replace function public.my_duels()
returns table (
    id uuid, mine boolean, friend_id uuid, username text, display_name text, avatar_url text,
    stake int, days int, starts date, ends date, status text, winner_id uuid,
    my_done int, my_total int, my_days int, their_done int, their_total int, their_days int
)
language plpgsql security definer set search_path to ''
as $$
#variable_conflict use_column
declare
    me uuid := (select auth.uid());
begin
    if me is null then return; end if;
    perform public.settle_due_duels();
    return query
    select d.id, d.challenger_id = me,
        f.id, f.username,
        case when coalesce((f.sharing ->> 'name')::boolean, true) then f.display_name end,
        case when coalesce((f.sharing ->> 'photo')::boolean, true) then f.avatar_url end,
        d.stake, d.days, d.starts, d.ends, d.status, d.winner_id,
        ms.done, ms.total, ms.days, ts.done, ts.total, ts.days
    from public.duels d
    join public.profiles f on f.id = case when d.challenger_id = me then d.opponent_id else d.challenger_id end
    cross join lateral public.duel_score(me, coalesce(d.starts, current_date + 1), coalesce(least(d.ends, current_date), current_date)) ms
    cross join lateral public.duel_score(f.id, coalesce(d.starts, current_date + 1), coalesce(least(d.ends, current_date), current_date)) ts
    where (d.challenger_id = me or d.opponent_id = me)
      and (d.status in ('proposed', 'active') or d.settled_at > now() - interval '14 days')
    order by (d.status = 'proposed' and d.opponent_id = me) desc, (d.status in ('proposed', 'active')) desc, d.created_at desc;
end;
$$;
revoke all on function public.my_duels() from public, anon;
grant execute on function public.my_duels() to authenticated;

-- --------------------------------------------------- the wallet, with duels
-- What is in play now counts duel stakes too; the ledger names the duel.
create or replace function public.my_wallet()
returns table (ledger int, in_play int, spendable int)
language sql stable security definer set search_path to ''
as $$
    select coalesce((select sum(amount) from public.shards_ledger where user_id = (select auth.uid())), 0)::int,
           (coalesce((select sum(s.amount) from public.market_stakes s join public.goal_markets m on m.id = s.market_id
                      where s.user_id = (select auth.uid()) and m.status = 'open'), 0)
            + coalesce((select sum(d.stake) from public.duels d
                        where d.status = 'active' and (d.challenger_id = (select auth.uid()) or d.opponent_id = (select auth.uid()))), 0)
            + coalesce((select sum(d.stake) from public.duels d
                        where d.status = 'proposed' and d.challenger_id = (select auth.uid())), 0))::int,
           public.shards_spendable((select auth.uid()));
$$;

create or replace function public.my_ledger(p_limit int default 100)
returns table (amount int, reason text, created_at timestamptz, title text)
language sql stable security definer set search_path to ''
as $$
    select l.amount, l.reason, l.created_at,
           coalesce(m.title, case when d.id is not null then 'Duel with ' || coalesce(nullif(btrim(f.display_name), ''), f.username, 'a friend') end)
      from public.shards_ledger l
      left join public.goal_markets m on m.id = l.market_id
      left join public.duels d on d.id = l.duel_id
      left join public.profiles f on f.id = case when d.challenger_id = l.user_id then d.opponent_id else d.challenger_id end
     where l.user_id = (select auth.uid())
     order by l.created_at desc
     limit least(greatest(p_limit, 1), 500);
$$;

notify pgrst, 'reload schema';
