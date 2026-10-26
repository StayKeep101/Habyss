-- Invites that change the price: a new person who came through a friend's
-- invite pays half, and so does whoever invited them once three have joined.
--
-- One row per invited person (they can be invited once). Only these two
-- functions write or read it: rows are never visible directly.

create table if not exists public.referrals (
    invitee_id uuid primary key references auth.users(id) on delete cascade,
    inviter_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint referrals_not_self check (invitee_id <> inviter_id)
);
create index if not exists referrals_inviter_idx on public.referrals (inviter_id);

alter table public.referrals enable row level security;
-- No policies: nobody reads or writes the table except through the functions below.
revoke all on public.referrals from anon, authenticated;

-- The signed-in person says who invited them (by username). Counts only for a
-- new account (made in the last 30 days), only once, and never for yourself.
create or replace function public.claim_referral(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    inviter uuid;
    joined timestamptz;
begin
    if me is null then return 'signed_out'; end if;
    select id into inviter from public.profiles where username = lower(trim(leading '@' from p_username));
    if inviter is null then return 'unknown'; end if;
    if inviter = me then return 'self'; end if;
    select created_at into joined from auth.users where id = me;
    if joined is null or joined < now() - interval '30 days' then return 'not_new'; end if;
    insert into public.referrals (invitee_id, inviter_id) values (me, inviter)
        on conflict (invitee_id) do nothing;
    return 'ok';
end;
$$;

-- Who invited me (their username, or null) and how many I have invited.
create or replace function public.referral_status()
returns table (invited_by text, joined integer)
language sql
stable
security definer
set search_path = public
as $$
    select
        (select p.username from public.referrals r join public.profiles p on p.id = r.inviter_id where r.invitee_id = auth.uid()),
        (select count(*)::integer from public.referrals r where r.inviter_id = auth.uid());
$$;

revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.referral_status() from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.referral_status() to authenticated;
