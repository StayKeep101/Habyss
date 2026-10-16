-- Something to lose, and somebody to lose it to.
--
-- A streak is between you and yourself, and on a bad week it is very easy to
-- decide it did not matter. A pact is with a named person, on a habit you both
-- agreed to, with embers you both put up. The embers are not really the point —
-- the point is that somebody will see — but they have to be real enough to
-- sting, which means they have to be genuinely scarce.
--
-- Three decisions are worth writing down, because each of them is the kind of
-- thing that quietly ruins an economy:
--
--   The ledger is append only and the balance is derived from it. A stored
--   balance is a number two devices can disagree about; a sum of rows is not.
--
--   Settlement runs here, in one security-definer function, and neither phone
--   can call anything that pays itself. A client that could write its own
--   ledger rows would not be a currency, it would be a text field.
--
--   A pact nobody kept burns both stakes rather than refunding them. Refunding
--   makes a mutual quiet week free, and two friends who both want out have
--   every reason to take it.
--
-- Embers buy nothing and cannot be bought. The moment either changes this stops
-- being a habit tracker and becomes something with a different rulebook.
--
-- Applied 2026-09-29.
--   node scripts/apply-migration.mjs supabase/migrations/20260929000100_embers_and_pacts.sql

-- ------------------------------------------------------------------ ledger
create table if not exists public.ember_ledger (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles (id) on delete cascade,
    amount      integer not null check (amount <> 0),
    reason      text not null check (reason in ('kept', 'staked', 'returned', 'won', 'opening')),
    /** The pact or the day this line is about, so nothing can be paid twice. */
    reference   text,
    created_at  timestamptz not null default now(),
    -- One line per person per reason per reference: earning a day twice, or
    -- settling a pact twice, is arithmetic rather than a race to be won.
    unique (user_id, reason, reference)
);

create index if not exists idx_ember_ledger_user on public.ember_ledger (user_id, created_at desc);

alter table public.ember_ledger enable row level security;

-- Readable by its owner. Written by nobody: every line is put there by a
-- function below, which is the only way a balance can be trusted at all.
drop policy if exists ember_ledger_read on public.ember_ledger;
create policy ember_ledger_read on public.ember_ledger
    for select to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------------------------- pacts
create table if not exists public.pacts (
    id            uuid primary key default gen_random_uuid(),
    item_id       uuid not null,
    item_type     text not null check (item_type in ('habit', 'task', 'goal')),
    item_name     text not null,
    from_user     uuid not null references public.profiles (id) on delete cascade,
    to_user       uuid not null references public.profiles (id) on delete cascade,
    from_stake    integer not null check (from_stake between 10 and 500),
    to_stake      integer not null check (to_stake between 10 and 500),
    deadline      date not null,
    status        text not null default 'offered' check (status in ('offered', 'live', 'settled', 'cancelled')),
    outcome       text check (outcome in ('both', 'from', 'to', 'neither')),
    settled_at    timestamptz,
    created_at    timestamptz not null default now(),
    constraint pacts_not_with_yourself check (from_user <> to_user)
);

create index if not exists idx_pacts_people on public.pacts (from_user, status);
create index if not exists idx_pacts_to on public.pacts (to_user, status);

alter table public.pacts enable row level security;

drop policy if exists pacts_read on public.pacts;
create policy pacts_read on public.pacts
    for select to authenticated
    using (auth.uid() = from_user or auth.uid() = to_user);

-- Offered by you, to a friend, never to somebody who has blocked you.
drop policy if exists pacts_write on public.pacts;
create policy pacts_write on public.pacts
    for insert to authenticated
    with check (
        auth.uid() = from_user
        and public.are_friends(to_user)
        and not public.blocked_between(auth.uid(), to_user)
        and status = 'offered'
    );

-- Deliberately no update policy. A pact is accepted, declined or settled
-- through the functions below and in no other way — an UPDATE the client could
-- make is an UPDATE that can set `status = 'settled'` and `outcome = 'from'`.

/**
 * What somebody has.
 *
 * Summed every time rather than stored. A balance kept as a column is a number
 * that can drift, and there is no way to tell a drifted balance from a real
 * one after the fact.
 */
create or replace function public.ember_balance(p_user uuid default null)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce(sum(amount), 0)::integer
    from public.ember_ledger
    where user_id = coalesce(p_user, (select auth.uid()));
$function$;

revoke all on function public.ember_balance(uuid) from public;
grant execute on function public.ember_balance(uuid) to authenticated;

/**
 * Pays a day's keeping into the ledger, once.
 *
 * The amount is worked out on the phone — it is the only thing that knows
 * which habits were due and how they were evidenced — but it is bounded here,
 * and the unique index means a day pays exactly once however many times this
 * is called. Those two together are what stop a client simply asking for a
 * million embers.
 */
create or replace function public.claim_day(p_day date, p_amount integer)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    uid uuid := (select auth.uid());
    paid integer := least(greatest(coalesce(p_amount, 0), 0), 60);
begin
    if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
    if paid = 0 then return public.ember_balance(uid); end if;
    -- A day in the future is not a day that has been kept.
    if p_day > (now() at time zone 'utc')::date + 1 then
        raise exception 'That day has not happened' using errcode = '22007';
    end if;

    insert into public.ember_ledger (user_id, amount, reason, reference)
    values (uid, paid, 'kept', p_day::text)
    on conflict (user_id, reason, reference) do nothing;

    return public.ember_balance(uid);
end;
$function$;

revoke all on function public.claim_day(date, integer) from public;
grant execute on function public.claim_day(date, integer) to authenticated;

/** Everybody starts with enough to make one pact mean something. Once. */
create or replace function public.claim_opening()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    uid uuid := (select auth.uid());
begin
    if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
    insert into public.ember_ledger (user_id, amount, reason, reference)
    values (uid, 100, 'opening', 'opening')
    on conflict (user_id, reason, reference) do nothing;
    return public.ember_balance(uid);
end;
$function$;

revoke all on function public.claim_opening() from public;
grant execute on function public.claim_opening() to authenticated;

/**
 * Accepting a pact, which is where both stakes actually leave both balances.
 *
 * Nothing is taken when a pact is offered: an offer nobody answers should not
 * cost the person who made it. The moment it goes live, both sides pay in, and
 * a side that cannot cover its own stake by then means the pact never starts.
 */
create or replace function public.accept_pact(p_pact uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    uid uuid := (select auth.uid());
    rec public.pacts;
begin
    if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;

    select * into rec from public.pacts where id = p_pact and to_user = uid and status = 'offered' for update;
    if not found then return 'gone'; end if;

    if public.ember_balance(rec.to_user) < rec.to_stake then return 'short'; end if;
    if public.ember_balance(rec.from_user) < rec.from_stake then return 'they_are_short'; end if;

    insert into public.ember_ledger (user_id, amount, reason, reference) values
        (rec.from_user, -rec.from_stake, 'staked', rec.id::text),
        (rec.to_user, -rec.to_stake, 'staked', rec.id::text);

    update public.pacts set status = 'live' where id = rec.id;
    return 'live';
end;
$function$;

revoke all on function public.accept_pact(uuid) from public;
grant execute on function public.accept_pact(uuid) to authenticated;

/** Declining, or withdrawing one you offered. Nothing has been staked yet. */
create or replace function public.cancel_pact(p_pact uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    uid uuid := (select auth.uid());
begin
    if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
    update public.pacts set status = 'cancelled'
     where id = p_pact and status = 'offered' and (from_user = uid or to_user = uid);
    return case when found then 'cancelled' else 'gone' end;
end;
$function$;

revoke all on function public.cancel_pact(uuid) from public;
grant execute on function public.cancel_pact(uuid) to authenticated;

/**
 * Settles every pact of yours whose day has gone.
 *
 * Called by either phone, and safe to call from both: the pact row is locked,
 * the status check means only the first call does anything, and the ledger's
 * unique index means a second one could not pay twice even if it got through.
 *
 * Who kept it is read from `shared_completions`, which is written by whoever
 * did the thing and readable by whoever shares it — so neither side reports on
 * the other, and neither side reports on themselves at settlement time.
 */
create or replace function public.settle_due_pacts()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    uid uuid := (select auth.uid());
    rec public.pacts;
    from_kept boolean;
    to_kept boolean;
    settled integer := 0;
begin
    if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;

    for rec in
        select * from public.pacts
         where status = 'live'
           and deadline < (now() at time zone 'utc')::date
           and (from_user = uid or to_user = uid)
         for update
    loop
        select exists (
            select 1 from public.shared_completions c
            where c.user_id = rec.from_user and c.item_id = rec.item_id and c.day <= rec.deadline
        ) into from_kept;
        select exists (
            select 1 from public.shared_completions c
            where c.user_id = rec.to_user and c.item_id = rec.item_id and c.day <= rec.deadline
        ) into to_kept;

        if from_kept and to_kept then
            insert into public.ember_ledger (user_id, amount, reason, reference) values
                (rec.from_user, rec.from_stake, 'returned', rec.id::text),
                (rec.to_user, rec.to_stake, 'returned', rec.id::text)
            on conflict do nothing;
            update public.pacts set status = 'settled', outcome = 'both', settled_at = now() where id = rec.id;

        elsif from_kept then
            insert into public.ember_ledger (user_id, amount, reason, reference)
            values (rec.from_user, rec.from_stake + rec.to_stake, 'won', rec.id::text)
            on conflict do nothing;
            update public.pacts set status = 'settled', outcome = 'from', settled_at = now() where id = rec.id;

        elsif to_kept then
            insert into public.ember_ledger (user_id, amount, reason, reference)
            values (rec.to_user, rec.from_stake + rec.to_stake, 'won', rec.id::text)
            on conflict do nothing;
            update public.pacts set status = 'settled', outcome = 'to', settled_at = now() where id = rec.id;

        else
            -- Nobody kept it, so nobody is owed anything and the stakes are
            -- gone. See the note at the top: refunding here is an invitation
            -- to collude.
            update public.pacts set status = 'settled', outcome = 'neither', settled_at = now() where id = rec.id;
        end if;

        settled := settled + 1;
    end loop;

    return settled;
end;
$function$;

revoke all on function public.settle_due_pacts() from public;
grant execute on function public.settle_due_pacts() to authenticated;

notify pgrst, 'reload schema';
