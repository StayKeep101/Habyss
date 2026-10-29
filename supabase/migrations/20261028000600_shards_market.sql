-- Shards, Habyss's currency, and the market: betting Shards on a friend's goal.
--
-- Marks are experience and only go up. Shards are the currency: earned by
-- adding and completing things, lost by missing them (lib/shards.ts), worked
-- out on each phone from what is recorded. Nothing for completing something
-- made the same day, at most 10 a day for adding things, at most 200 a day in
-- all. The phone publishes what doing has earned (profiles.shards_earned,
-- private: friends never read it), and the server holds it to 200 a day for
-- the account's age, so an edited phone cannot mint them. Everyone starts
-- with a hundred. shards_ledger
-- holds every Shard a bet moved. What you can spend: 100 + earned + ledger.
--
-- The market: the owner of a goal with a deadline at least three days away
-- opens it to bets. Friends put Shards on "makes it" or "misses it"; the owner
-- may back themselves, never bet against themselves. One stake per person per
-- market, added to (up to 100 in all) but never switched. The owner's phone
-- settles it as won when the goal is reached; reached within a day of opening,
-- it is void and everyone is refunded (no instant wins). Still open a day past
-- its deadline, it settles as missed, here, by itself. Payout is a shared
-- pool: the winning side gets its stakes back plus the losing side's Shards in
-- proportion to what each put in (rounded down). If one side is empty,
-- everyone is refunded. Shards are never bought or cashed out.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261028000600_shards_market.sql

-- ------------------------------------------------------------- shards earned
alter table public.profiles add column if not exists shards_earned integer not null default 0 check (shards_earned >= 0);
grant update (shards_earned) on public.profiles to authenticated;


-- No more than 200 a day for every day the account has existed.
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
drop trigger if exists profiles_cap_shards on public.profiles;
create trigger profiles_cap_shards before update of shards_earned on public.profiles
    for each row execute function public.cap_shards_earned();

-- --------------------------------------------------------------- the tables
create table if not exists public.goal_markets (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users(id) on delete cascade,
    -- The goal's id on the owner's phone: goals are not rows here.
    goal_key    text not null check (length(goal_key) between 1 and 100),
    title       text not null check (length(btrim(title)) between 1 and 120),
    icon        text check (icon is null or length(icon) <= 60),
    color       text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
    deadline    date not null,
    status      text not null default 'open' check (status in ('open', 'won', 'missed', 'void')),
    created_at  timestamptz not null default now(),
    settled_at  timestamptz
);
create unique index if not exists goal_markets_one_open on public.goal_markets (owner_id, goal_key) where status = 'open';
create index if not exists goal_markets_owner on public.goal_markets (owner_id, created_at desc);

create table if not exists public.market_stakes (
    market_id   uuid not null references public.goal_markets(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    side        text not null check (side in ('make', 'miss')),
    amount      integer not null check (amount > 0),
    payout      integer,
    created_at  timestamptz not null default now(),
    primary key (market_id, user_id)
);
create index if not exists market_stakes_user on public.market_stakes (user_id);

create table if not exists public.shards_ledger (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    amount      integer not null,
    reason      text not null check (reason in ('stake', 'payout', 'refund')),
    market_id   uuid references public.goal_markets(id) on delete set null,
    created_at  timestamptz not null default now()
);
create index if not exists shards_ledger_user on public.shards_ledger (user_id, created_at desc);

alter table public.goal_markets enable row level security;
alter table public.market_stakes enable row level security;
alter table public.shards_ledger enable row level security;

-- Read: your own, and your friends'. Every write goes through the functions below.
drop policy if exists goal_markets_read on public.goal_markets;
create policy goal_markets_read on public.goal_markets for select to authenticated
    using (owner_id = (select auth.uid()) or public.are_friends(owner_id));
drop policy if exists market_stakes_read on public.market_stakes;
create policy market_stakes_read on public.market_stakes for select to authenticated
    using (exists (select 1 from public.goal_markets m where m.id = market_id
                   and (m.owner_id = (select auth.uid()) or public.are_friends(m.owner_id))));
drop policy if exists shards_ledger_read on public.shards_ledger;
create policy shards_ledger_read on public.shards_ledger for select to authenticated
    using (user_id = (select auth.uid()));

revoke insert, update, delete on public.goal_markets, public.market_stakes, public.shards_ledger from authenticated, anon;
grant select on public.goal_markets, public.market_stakes, public.shards_ledger to authenticated;

-- ---------------------------------------------------------------- spending
-- What you can spend: the hundred everyone starts with, what you have earned, and the ledger.
create or replace function public.shards_spendable(p_user uuid)
returns integer
language sql stable security definer set search_path to ''
as $$
    select 100 + coalesce((select shards_earned from public.profiles where id = p_user), 0)
         + coalesce((select sum(amount) from public.shards_ledger where user_id = p_user), 0)::int;
$$;
revoke all on function public.shards_spendable(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- settling
-- Pays a market out. Internal: called by settle_market and settle_due_markets.
create or replace function public.pay_market(p_market uuid, p_won boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    m public.goal_markets;
    win_side text := case when p_won then 'make' else 'miss' end;
    win_total integer;
    lose_total integer;
    who text;
begin
    select * into m from public.goal_markets where id = p_market for update;
    if not found or m.status <> 'open' then return; end if;

    select coalesce(sum(amount) filter (where side = win_side), 0),
           coalesce(sum(amount) filter (where side <> win_side), 0)
      into win_total, lose_total
      from public.market_stakes where market_id = p_market;

    if win_total = 0 or lose_total = 0 then
        -- Nobody on one side: nothing was really at stake. Everyone gets theirs back.
        update public.market_stakes set payout = amount where market_id = p_market;
        insert into public.shards_ledger (user_id, amount, reason, market_id)
            select user_id, amount, 'refund', p_market from public.market_stakes where market_id = p_market;
        update public.goal_markets set status = 'void', settled_at = now() where id = p_market;
    else
        update public.market_stakes
           set payout = case when side = win_side then amount + (lose_total::bigint * amount / win_total)::int else 0 end
         where market_id = p_market;
        insert into public.shards_ledger (user_id, amount, reason, market_id)
            select user_id, payout, 'payout', p_market from public.market_stakes
             where market_id = p_market and payout > 0;
        update public.goal_markets set status = case when p_won then 'won' else 'missed' end, settled_at = now() where id = p_market;
    end if;

    -- Everyone who had Shards on it hears how it went.
    select coalesce(nullif(btrim(display_name), ''), username, 'Your friend') into who from public.profiles where id = m.owner_id;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        select s.user_id, m.owner_id, 'market',
               case when s.user_id = m.owner_id then (case when p_won then 'You made it' else 'Time ran out' end)
                    else who || (case when p_won then ' made it' else ' missed it' end) end,
               m.title || ': ' || case when s.payout > s.amount then '+' || (s.payout - s.amount) || ' Shards'
                                      when s.payout = s.amount then 'your Shards are back'
                                      else '−' || s.amount || ' Shards' end
          from public.market_stakes s where s.market_id = p_market;
end;
$$;
revoke all on function public.pay_market(uuid, boolean) from public, anon, authenticated;

-- A market still open a day after its deadline was missed. Settled by whoever looks first.
create or replace function public.settle_due_markets()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    due record;
    settled integer := 0;
begin
    for due in select id from public.goal_markets where status = 'open' and deadline < current_date - 1 loop
        perform public.pay_market(due.id, false);
        settled := settled + 1;
    end loop;
    return settled;
end;
$$;
revoke all on function public.settle_due_markets() from public, anon;
grant execute on function public.settle_due_markets() to authenticated;

-- ---------------------------------------------------------- what phones call
create or replace function public.open_market(p_goal_key text, p_title text, p_icon text, p_color text, p_deadline date)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    made uuid;
begin
    if me is null then raise exception 'Sign in to open a goal to bets.'; end if;
    if p_deadline < current_date + 3 then raise exception 'Bets need a deadline at least three days away.'; end if;
    select id into made from public.goal_markets where owner_id = me and goal_key = p_goal_key and status = 'open';
    if made is not null then return made; end if;
    insert into public.goal_markets (owner_id, goal_key, title, icon, color, deadline)
        values (me, p_goal_key, btrim(p_title), p_icon, p_color, p_deadline)
        returning id into made;
    -- Friends who share progress hear about it.
    insert into public.notifications (user_id, from_user_id, type, title, body)
        select case when f.user_id = me then f.friend_id else f.user_id end, me, 'market',
               coalesce((select coalesce(nullif(btrim(display_name), ''), username) from public.profiles where id = me), 'A friend') || ' opened a goal to bets',
               btrim(p_title) || '. Will they make it?'
          from public.friendships f
         where f.deleted_at is null and (f.user_id = me or f.friend_id = me);
    return made;
end;
$$;
revoke all on function public.open_market(text, text, text, text, date) from public, anon;
grant execute on function public.open_market(text, text, text, text, date) to authenticated;

create or replace function public.place_stake(p_market uuid, p_side text, p_amount integer)
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    m public.goal_markets;
    had public.market_stakes;
begin
    if me is null then raise exception 'Sign in to bet.'; end if;
    if p_side not in ('make', 'miss') or p_amount is null or p_amount <= 0 then raise exception 'Choose a side and an amount.'; end if;
    select * into m from public.goal_markets where id = p_market for update;
    if not found then raise exception 'That bet is gone.'; end if;
    if m.status <> 'open' or m.deadline < current_date then raise exception 'Betting on this goal has closed.'; end if;
    if m.owner_id = me then
        if p_side <> 'make' then raise exception 'You can only back yourself.'; end if;
    elsif not public.are_friends(m.owner_id) or public.blocked_between(me, m.owner_id) then
        raise exception 'You can only bet on friends'' goals.';
    end if;
    select * into had from public.market_stakes where market_id = p_market and user_id = me;
    if found and had.side <> p_side then raise exception 'You already picked a side.'; end if;
    if coalesce(had.amount, 0) + p_amount > 100 then raise exception 'You can put at most 100 Shards on one goal.'; end if;
    if public.shards_spendable(me) < p_amount then raise exception 'Not enough Shards.'; end if;

    insert into public.market_stakes (market_id, user_id, side, amount) values (p_market, me, p_side, p_amount)
        on conflict (market_id, user_id) do update set amount = public.market_stakes.amount + excluded.amount;
    insert into public.shards_ledger (user_id, amount, reason, market_id) values (me, -p_amount, 'stake', p_market);
    return public.shards_spendable(me);
end;
$$;
revoke all on function public.place_stake(uuid, text, integer) from public, anon;
grant execute on function public.place_stake(uuid, text, integer) to authenticated;

-- The owner's phone, when the goal is reached (or given up on: won = false).
create or replace function public.settle_market(p_goal_key text, p_won boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    m public.goal_markets;
begin
    select * into m from public.goal_markets
     where owner_id = (select auth.uid()) and goal_key = p_goal_key and status = 'open';
    if not found then return; end if;
    if p_won and m.created_at > now() - interval '1 day' then
        -- Reached the day it was opened: nothing was really at stake. Everyone is refunded.
        update public.market_stakes set payout = amount where market_id = m.id;
        insert into public.shards_ledger (user_id, amount, reason, market_id)
            select user_id, amount, 'refund', m.id from public.market_stakes where market_id = m.id;
        update public.goal_markets set status = 'void', settled_at = now() where id = m.id;
        return;
    end if;
    perform public.pay_market(m.id, p_won);
end;
$$;
revoke all on function public.settle_market(text, boolean) from public, anon;
grant execute on function public.settle_market(text, boolean) to authenticated;

-- The market as one person sees it: their own goals and their friends', open
-- or settled in the last week, with both sides' pools and their own stake.
create or replace function public.market_feed()
returns table (
    id uuid, owner_id uuid, username text, display_name text, avatar_url text,
    goal_key text, title text, icon text, color text, deadline date, status text,
    make_total int, miss_total int, backers int, doubters int,
    my_side text, my_amount int, my_payout int
)
language plpgsql security definer set search_path to ''
as $$
begin
    perform public.settle_due_markets();
    return query
    select m.id, m.owner_id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        m.goal_key, m.title, m.icon, m.color, m.deadline, m.status,
        coalesce(sum(s.amount) filter (where s.side = 'make'), 0)::int,
        coalesce(sum(s.amount) filter (where s.side = 'miss'), 0)::int,
        count(*) filter (where s.side = 'make')::int,
        count(*) filter (where s.side = 'miss')::int,
        max(s.side) filter (where s.user_id = (select auth.uid())),
        max(s.amount) filter (where s.user_id = (select auth.uid()))::int,
        max(s.payout) filter (where s.user_id = (select auth.uid()))::int
    from public.goal_markets m
    join public.profiles p on p.id = m.owner_id
    left join public.market_stakes s on s.market_id = m.id
    where (m.owner_id = (select auth.uid())
           or (public.are_friends(m.owner_id) and not public.blocked_between((select auth.uid()), m.owner_id)))
      and (m.status = 'open' or m.settled_at > now() - interval '7 days')
    group by m.id, p.id
    order by (m.status = 'open') desc, m.deadline asc;
end;
$$;
revoke all on function public.market_feed() from public, anon;
grant execute on function public.market_feed() to authenticated;

-- Your wallet's own record: every Shard a bet moved, newest first.
create or replace function public.my_ledger(p_limit int default 100)
returns table (amount int, reason text, created_at timestamptz, title text)
language sql stable security definer set search_path to ''
as $$
    select l.amount, l.reason, l.created_at, m.title
      from public.shards_ledger l
      left join public.goal_markets m on m.id = l.market_id
     where l.user_id = (select auth.uid())
     order by l.created_at desc
     limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function public.my_ledger(int) from public, anon;
grant execute on function public.my_ledger(int) to authenticated;

-- The wallet's totals: every Shard bets have moved, and what is in play right now.
create or replace function public.my_wallet()
returns table (ledger int, in_play int, spendable int)
language sql stable security definer set search_path to ''
as $$
    select coalesce((select sum(amount) from public.shards_ledger where user_id = (select auth.uid())), 0)::int,
           coalesce((select sum(s.amount) from public.market_stakes s join public.goal_markets m on m.id = s.market_id
                      where s.user_id = (select auth.uid()) and m.status = 'open'), 0)::int,
           public.shards_spendable((select auth.uid()));
$$;
revoke all on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

notify pgrst, 'reload schema';
