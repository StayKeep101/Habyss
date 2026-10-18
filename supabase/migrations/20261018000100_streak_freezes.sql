-- Streak freezes: a day you miss is covered, so the run you built survives it.
--
-- Freezes come from friends (Echo's "help your friend out"). Everything goes
-- through SECURITY DEFINER functions that hold the rules, so the app's key
-- cannot be used to mint freezes:
--   gift_streak_freeze  friends only; one gift per giver per friend per 7 days;
--                       a person holds at most 5; the friend is notified.
--   use_streak_freeze   spends one of your own on a missed day in the last 3
--                       days, once per day.
--   my_streak_freezes   how many you hold and the days they covered.

alter table public.profiles add column if not exists streak_freezes integer not null default 0
    check (streak_freezes between 0 and 5);

create table if not exists public.streak_freeze_gifts (
    id          uuid primary key default gen_random_uuid(),
    giver       uuid not null references public.profiles (id) on delete cascade,
    receiver    uuid not null references public.profiles (id) on delete cascade,
    created_at  timestamptz not null default now()
);
create index if not exists idx_freeze_gifts_pair on public.streak_freeze_gifts (giver, receiver, created_at desc);
alter table public.streak_freeze_gifts enable row level security;
drop policy if exists freeze_gifts_read on public.streak_freeze_gifts;
create policy freeze_gifts_read on public.streak_freeze_gifts
    for select to authenticated using ((select auth.uid()) in (giver, receiver));

create table if not exists public.streak_freeze_days (
    user_id     uuid not null references public.profiles (id) on delete cascade,
    day         date not null,
    created_at  timestamptz not null default now(),
    primary key (user_id, day)
);
alter table public.streak_freeze_days enable row level security;
drop policy if exists freeze_days_read on public.streak_freeze_days;
create policy freeze_days_read on public.streak_freeze_days
    for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.streak_freeze_gifts, public.streak_freeze_days from anon;
revoke insert, update, delete, truncate, references, trigger on public.streak_freeze_gifts, public.streak_freeze_days from authenticated;

create or replace function public.gift_streak_freeze(p_friend uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := (select auth.uid());
    held integer;
    giver_name text;
begin
    if me is null then return 'signed_out'; end if;
    if p_friend is null or p_friend = me or not public.are_friends(p_friend) then return 'not_friends'; end if;
    if public.blocked_between(me, p_friend) then return 'not_friends'; end if;
    if exists (select 1 from public.streak_freeze_gifts
               where giver = me and receiver = p_friend and created_at > now() - interval '7 days') then
        return 'too_soon';
    end if;
    select streak_freezes into held from public.profiles where id = p_friend for update;
    if held is null then return 'not_friends'; end if;
    if held >= 5 then return 'full'; end if;

    update public.profiles set streak_freezes = streak_freezes + 1 where id = p_friend;
    insert into public.streak_freeze_gifts (giver, receiver) values (me, p_friend);
    select coalesce(nullif(btrim(name), ''), username, 'A friend') into giver_name from public.profiles where id = me;
    insert into public.notifications (user_id, from_user_id, type, title, body)
    values (p_friend, me, 'freeze_gift', giver_name || ' sent you a streak freeze',
            'If you miss a day, it covers it. Your streak stays.');
    return 'sent';
end;
$function$;

create or replace function public.use_streak_freeze(p_day date)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := (select auth.uid());
    held integer;
begin
    if me is null or p_day is null then return false; end if;
    -- Only a recent, already-finished day (allowing for time zones either side).
    if p_day < (now() at time zone 'utc')::date - 3 or p_day > (now() at time zone 'utc')::date then return false; end if;
    if exists (select 1 from public.streak_freeze_days where user_id = me and day = p_day) then return true; end if;
    select streak_freezes into held from public.profiles where id = me for update;
    if coalesce(held, 0) < 1 then return false; end if;
    update public.profiles set streak_freezes = streak_freezes - 1 where id = me;
    insert into public.streak_freeze_days (user_id, day) values (me, p_day);
    return true;
end;
$function$;

create or replace function public.my_streak_freezes()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
    select jsonb_build_object(
        'count', coalesce((select streak_freezes from public.profiles where id = (select auth.uid())), 0),
        'days', coalesce((select jsonb_agg(day order by day) from public.streak_freeze_days where user_id = (select auth.uid())), '[]'::jsonb)
    );
$function$;

revoke all on function public.gift_streak_freeze(uuid), public.use_streak_freeze(date), public.my_streak_freezes() from public, anon;
grant execute on function public.gift_streak_freeze(uuid), public.use_streak_freeze(date), public.my_streak_freezes() to authenticated;

notify pgrst, 'reload schema';
