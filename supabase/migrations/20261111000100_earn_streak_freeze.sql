-- Streak freezes you earn: one for every 7 days in a row, besides the ones
-- friends send. The app says how long the run is; the server holds the rules
-- so a freeze is never minted twice:
--   earn_streak_freeze  a run of at least 7 days; at most one earned per 6
--                       days (a 7-day milestone each week); 5 held at most.

create table if not exists public.streak_freeze_earned (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles (id) on delete cascade,
    streak      integer not null,
    created_at  timestamptz not null default now()
);
create index if not exists idx_freeze_earned_user on public.streak_freeze_earned (user_id, created_at desc);
alter table public.streak_freeze_earned enable row level security;
drop policy if exists freeze_earned_read on public.streak_freeze_earned;
create policy freeze_earned_read on public.streak_freeze_earned
    for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.streak_freeze_earned from anon;
revoke insert, update, delete, truncate, references, trigger on public.streak_freeze_earned from authenticated;

create or replace function public.earn_streak_freeze(p_streak integer)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := (select auth.uid());
    held integer;
begin
    if me is null then return 'signed_out'; end if;
    if p_streak is null or p_streak < 7 then return 'not_yet'; end if;
    if exists (select 1 from public.streak_freeze_earned
               where user_id = me and created_at > now() - interval '6 days') then
        return 'too_soon';
    end if;
    select streak_freezes into held from public.profiles where id = me for update;
    if held is null then return 'signed_out'; end if;
    if held >= 5 then return 'full'; end if;
    update public.profiles set streak_freezes = streak_freezes + 1 where id = me;
    insert into public.streak_freeze_earned (user_id, streak) values (me, p_streak);
    return 'earned';
end;
$function$;

revoke all on function public.earn_streak_freeze(integer) from public, anon;
grant execute on function public.earn_streak_freeze(integer) to authenticated;

notify pgrst, 'reload schema';
