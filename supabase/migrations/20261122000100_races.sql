-- Race the clock: a challenge you set yourself.
--
-- "My 3 most important tasks in the next 3 hours, and I stake 500 Shards." You
-- pick tasks already in your plan, a time (15 minutes to 12 hours) and a stake
-- (up to everything you can spend). Your friends hear about it and can bet for
-- you or against you (up to 100 each, one side, until the clock runs out).
--
-- Your phone reports the win the moment the last chosen task is ticked; a race
-- still open two minutes after its clock ran out is missed, settled here by
-- whoever looks first (race_feed). Won: you get your stake back and Habyss
-- matches it, up to 500, on your first race of the day (matched at opening, so
-- a second race that day pays only your stake back plus what friends lose).
-- Missed: your stake goes to those who bet against you.
--
-- Friends' bets are a shared pool, as on goals: the winning side gets its
-- stakes back plus the losing side's Shards in proportion to what each put in.
-- Won with nobody backing you: what was bet against you is yours. Missed with
-- nobody against you: your stake is gone and friends who backed you get theirs
-- back. Shards are a game currency: never bought, sold or cashed out.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261122000100_races.sql

create table if not exists public.races (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users(id) on delete cascade,
    title       text not null check (length(btrim(title)) between 1 and 120),
    -- The tasks raced, as the phone names them: [{ "key": "<task id>", "title": "…" }].
    tasks       jsonb not null check (jsonb_typeof(tasks) = 'array' and jsonb_array_length(tasks) between 1 and 10),
    stake       integer not null check (stake > 0),
    -- What Habyss adds on a win (0 for a second race the same day).
    match       integer not null default 0 check (match between 0 and 500),
    starts_at   timestamptz not null default now(),
    ends_at     timestamptz not null,
    status      text not null default 'open' check (status in ('open', 'won', 'missed', 'void')),
    payout      integer,
    created_at  timestamptz not null default now(),
    settled_at  timestamptz,
    check (ends_at > starts_at)
);
create unique index if not exists races_one_open on public.races (owner_id) where status = 'open';
create index if not exists races_owner on public.races (owner_id, created_at desc);

create table if not exists public.race_bets (
    race_id     uuid not null references public.races(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    side        text not null check (side in ('for', 'against')),
    amount      integer not null check (amount > 0),
    payout      integer,
    created_at  timestamptz not null default now(),
    primary key (race_id, user_id)
);
create index if not exists race_bets_user on public.race_bets (user_id);

alter table public.shards_ledger drop constraint if exists shards_ledger_reason_check;
alter table public.shards_ledger add constraint shards_ledger_reason_check
    check (reason in ('stake', 'payout', 'refund', 'unlock', 'challenge', 'match'));
alter table public.shards_ledger add column if not exists race_id uuid references public.races(id) on delete set null;

alter table public.races enable row level security;
alter table public.race_bets enable row level security;
drop policy if exists races_read on public.races;
create policy races_read on public.races for select to authenticated
    using (owner_id = (select auth.uid()) or public.are_friends(owner_id));
drop policy if exists race_bets_read on public.race_bets;
create policy race_bets_read on public.race_bets for select to authenticated
    using (exists (select 1 from public.races r where r.id = race_id
                   and (r.owner_id = (select auth.uid()) or public.are_friends(r.owner_id))));
revoke insert, update, delete on public.races, public.race_bets from authenticated, anon;
grant select on public.races, public.race_bets to authenticated;

-- ---------------------------------------------------------------- settling
create or replace function public.pay_race(p_race uuid, p_won boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    r public.races;
    win_side text := case when p_won then 'for' else 'against' end;
    win_total integer;
    lose_total integer;
    owner_gets integer := 0;
    who text;
begin
    select * into r from public.races where id = p_race for update;
    if not found or r.status <> 'open' then return; end if;

    select coalesce(sum(amount) filter (where side = win_side), 0),
           coalesce(sum(amount) filter (where side <> win_side), 0)
      into win_total, lose_total
      from public.race_bets where race_id = p_race;

    if p_won then
        -- Your stake back, Habyss's match, and the bets against you when nobody backed you.
        owner_gets := r.stake + r.match + case when win_total = 0 then lose_total else 0 end;
        insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, r.stake, 'refund', r.id);
        if r.match > 0 then insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, r.match, 'match', r.id); end if;
        if win_total = 0 and lose_total > 0 then
            insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, lose_total, 'payout', r.id);
            update public.race_bets set payout = 0 where race_id = p_race;
        else
            update public.race_bets
               set payout = case when side = win_side then amount + (lose_total::bigint * amount / win_total)::int else 0 end
             where race_id = p_race;
        end if;
    else
        -- Missed: your stake joins the pool of those who bet against you.
        lose_total := lose_total + r.stake;
        if win_total = 0 then
            -- Nobody against you: friends who backed you get theirs back; your stake is gone.
            update public.race_bets set payout = amount where race_id = p_race;
        else
            update public.race_bets
               set payout = case when side = win_side then amount + (lose_total::bigint * amount / win_total)::int else 0 end
             where race_id = p_race;
        end if;
    end if;
    insert into public.shards_ledger (user_id, amount, reason, race_id)
        select user_id, payout, case when payout = amount then 'refund' else 'payout' end, p_race
          from public.race_bets where race_id = p_race and payout > 0;
    update public.races set status = case when p_won then 'won' else 'missed' end, payout = owner_gets, settled_at = now() where id = p_race;

    select coalesce(nullif(btrim(display_name), ''), username, 'Your friend') into who from public.profiles where id = r.owner_id;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        values (r.owner_id, r.owner_id, 'market',
                case when p_won then 'You beat the clock' else 'The clock won' end,
                r.title || ': ' || case when p_won then '+' || (owner_gets - r.stake) || ' Shards' else '−' || r.stake || ' Shards' end);
    insert into public.notifications (user_id, from_user_id, type, title, body)
        select b.user_id, r.owner_id, 'market', who || case when p_won then ' beat the clock' else ' ran out of time' end,
               r.title || ': ' || case when b.payout > b.amount then '+' || (b.payout - b.amount) || ' Shards'
                                      when b.payout = b.amount then 'your Shards are back'
                                      else '−' || b.amount || ' Shards' end
          from public.race_bets b where b.race_id = p_race;
end;
$$;
revoke all on function public.pay_race(uuid, boolean) from public, anon, authenticated;

-- Races two minutes past their clock are missed. Settled by whoever looks first.
create or replace function public.settle_due_races()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    due record;
    settled integer := 0;
begin
    for due in select id from public.races where status = 'open' and ends_at < now() - interval '2 minutes' loop
        perform public.pay_race(due.id, false);
        settled := settled + 1;
    end loop;
    return settled;
end;
$$;
revoke all on function public.settle_due_races() from public, anon;
grant execute on function public.settle_due_races() to authenticated;

-- ---------------------------------------------------------- what phones call
create or replace function public.open_race(p_title text, p_tasks jsonb, p_minutes integer, p_stake integer)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    made uuid;
    matched integer;
    name text;
begin
    if me is null then raise exception 'Sign in to race the clock.'; end if;
    perform public.settle_due_races();
    if exists (select 1 from public.races where owner_id = me and status = 'open') then raise exception 'You are already racing the clock.'; end if;
    if p_minutes is null or p_minutes < 15 or p_minutes > 720 then raise exception 'Give it between 15 minutes and 12 hours.'; end if;
    if p_stake is null or p_stake < 1 then raise exception 'Stake at least one Shard.'; end if;
    if public.shards_spendable(me) < p_stake then raise exception 'Not enough Shards.'; end if;
    if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) not between 1 and 10 then raise exception 'Pick between 1 and 10 tasks.'; end if;
    -- Habyss matches your first race of the day, up to 500.
    matched := case when exists (select 1 from public.races where owner_id = me and created_at::date = current_date) then 0 else least(p_stake, 500) end;
    insert into public.races (owner_id, title, tasks, stake, match, ends_at)
        values (me, btrim(p_title), p_tasks, p_stake, matched, now() + make_interval(mins => p_minutes))
        returning id into made;
    insert into public.shards_ledger (user_id, amount, reason, race_id) values (me, -p_stake, 'stake', made);
    -- Friends hear about it, and can bet.
    select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into name from public.profiles where id = me;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        select case when f.user_id = me then f.friend_id else f.user_id end, me, 'market',
               name || ' is racing the clock',
               btrim(p_title) || ', ' || p_stake || ' Shards on it. Will they make it?'
          from public.friendships f
         where f.deleted_at is null and (f.user_id = me or f.friend_id = me);
    return made;
end;
$$;
revoke all on function public.open_race(text, jsonb, integer, integer) from public, anon;
grant execute on function public.open_race(text, jsonb, integer, integer) to authenticated;

create or replace function public.bet_on_race(p_race uuid, p_side text, p_amount integer)
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    r public.races;
    had public.race_bets;
begin
    if me is null then raise exception 'Sign in to bet.'; end if;
    if p_side not in ('for', 'against') or p_amount is null or p_amount <= 0 then raise exception 'Choose a side and an amount.'; end if;
    select * into r from public.races where id = p_race for update;
    if not found then raise exception 'That race is gone.'; end if;
    if r.status <> 'open' or r.ends_at <= now() then raise exception 'This race has finished.'; end if;
    if r.owner_id = me then raise exception 'Your own stake is already on it.'; end if;
    if not public.are_friends(r.owner_id) or public.blocked_between(me, r.owner_id) then raise exception 'You can only bet on friends'' races.'; end if;
    select * into had from public.race_bets where race_id = p_race and user_id = me;
    if found and had.side <> p_side then raise exception 'You already picked a side.'; end if;
    if coalesce(had.amount, 0) + p_amount > 100 then raise exception 'You can put at most 100 Shards on one race.'; end if;
    if public.shards_spendable(me) < p_amount then raise exception 'Not enough Shards.'; end if;
    insert into public.race_bets (race_id, user_id, side, amount) values (p_race, me, p_side, p_amount)
        on conflict (race_id, user_id) do update set amount = public.race_bets.amount + excluded.amount;
    insert into public.shards_ledger (user_id, amount, reason, race_id) values (me, -p_amount, 'stake', p_race);
    return public.shards_spendable(me);
end;
$$;
revoke all on function public.bet_on_race(uuid, text, integer) from public, anon;
grant execute on function public.bet_on_race(uuid, text, integer) to authenticated;

-- Your phone, the moment the last task is ticked (won), or when you give up (won = false).
create or replace function public.finish_race(p_race uuid, p_won boolean)
returns text
language plpgsql security definer set search_path to ''
as $$
declare
    r public.races;
begin
    select * into r from public.races where id = p_race and owner_id = (select auth.uid());
    if not found or r.status <> 'open' then return coalesce(r.status, 'gone'); end if;
    -- Too late is missed, whatever the phone says (two minutes' grace for a slow network).
    if p_won and now() > r.ends_at + interval '2 minutes' then p_won := false; end if;
    perform public.pay_race(r.id, p_won);
    return case when p_won then 'won' else 'missed' end;
end;
$$;
revoke all on function public.finish_race(uuid, boolean) from public, anon;
grant execute on function public.finish_race(uuid, boolean) to authenticated;

-- Races as one person sees them: their own and their friends', running or
-- finished in the last week, with both sides' pools and their own bet.
create or replace function public.race_feed()
returns table (
    id uuid, owner_id uuid, username text, display_name text, avatar_url text,
    title text, tasks jsonb, stake int, match int, starts_at timestamptz, ends_at timestamptz, status text, payout int,
    for_total int, against_total int, backers int, doubters int,
    my_side text, my_amount int, my_payout int
)
language plpgsql security definer set search_path to ''
as $$
begin
    perform public.settle_due_races();
    return query
    select r.id, r.owner_id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        r.title, r.tasks, r.stake, r.match, r.starts_at, r.ends_at, r.status, r.payout,
        coalesce(sum(b.amount) filter (where b.side = 'for'), 0)::int,
        coalesce(sum(b.amount) filter (where b.side = 'against'), 0)::int,
        count(b.user_id) filter (where b.side = 'for')::int,
        count(b.user_id) filter (where b.side = 'against')::int,
        max(b.side) filter (where b.user_id = (select auth.uid())),
        max(b.amount) filter (where b.user_id = (select auth.uid()))::int,
        max(b.payout) filter (where b.user_id = (select auth.uid()))::int
    from public.races r
    join public.profiles p on p.id = r.owner_id
    left join public.race_bets b on b.race_id = r.id
    where (r.owner_id = (select auth.uid())
           or (public.are_friends(r.owner_id) and not public.blocked_between((select auth.uid()), r.owner_id)))
      and (r.status = 'open' or r.settled_at > now() - interval '7 days')
    group by r.id, p.id
    order by (r.status = 'open') desc, r.ends_at asc;
end;
$$;
revoke all on function public.race_feed() from public, anon;
grant execute on function public.race_feed() to authenticated;

-- ------------------------------------------------------------- the wallet
-- In play now counts races too (your stake, and your bets on friends' races).
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
                        where d.status = 'proposed' and d.challenger_id = (select auth.uid())), 0)
            + coalesce((select sum(r.stake) from public.races r where r.owner_id = (select auth.uid()) and r.status = 'open'), 0)
            + coalesce((select sum(b.amount) from public.race_bets b join public.races r on r.id = b.race_id
                        where b.user_id = (select auth.uid()) and r.status = 'open'), 0))::int,
           public.shards_spendable((select auth.uid()));
$$;

create or replace function public.my_ledger(p_limit int default 100)
returns table (amount int, reason text, created_at timestamptz, title text)
language sql stable security definer set search_path to ''
as $$
    select l.amount, l.reason, l.created_at,
           case when l.reason = 'unlock' then 'An hour of your apps'
                when l.reason = 'challenge' then coalesce((select c.title from public.challenge_runs r join public.challenge_catalog c on c.id = r.challenge_id where r.id = l.challenge_run_id), 'A challenge')
                when l.race_id is not null then coalesce((select ra.title from public.races ra where ra.id = l.race_id), 'Race the clock')
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
