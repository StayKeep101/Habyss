-- Challenges, and the end of duels.
--
-- Habyss writes the list (challenge_catalog). You start one alone or with as many
-- friends as you like; joining is free. It adds its habits and tasks to your plan
-- (the phone does that, from `items`). All or nothing: every member must keep every
-- day; when the last of them finishes, each member gets the reward. One member
-- missing a day (a day's grace for time zones and late reporting) or leaving once
-- it has started ends it for everyone, and nobody is paid.
--
-- Alone, it starts today. With friends invited, it starts tomorrow, and an invite
-- can be accepted until then. The phone reports each day kept (report_challenge_day)
-- once that day's challenge items are all done, ticked with proof (Apple Health, the
-- focus timer, the place, or a photo, lib/challengeProof.ts). Photos are kept in the
-- `proofs` bucket and listed in challenge_proofs for the group to see.
--
-- Duels are gone: every duel still proposed or running is cancelled and its stakes
-- refunded, and none can be started.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261117000100_challenges.sql

-- ------------------------------------------------------------------ the list
create table if not exists public.challenge_catalog (
    id          text primary key,
    title       text not null,
    summary     text not null,
    icon        text not null default 'trophy',
    difficulty  text not null check (difficulty in ('easy', 'medium', 'hard')),
    days        integer not null check (days between 1 and 90),
    reward      integer not null check (reward between 0 and 5000),
    -- What it adds to your plan, read by the phone (lib/challenges.ts ChallengeItem).
    items       jsonb not null default '[]',
    sort        integer not null default 0,
    active      boolean not null default true
);
alter table public.challenge_catalog enable row level security;
drop policy if exists challenge_catalog_read on public.challenge_catalog;
create policy challenge_catalog_read on public.challenge_catalog for select to authenticated using (active);
revoke insert, update, delete on public.challenge_catalog from authenticated, anon;
grant select on public.challenge_catalog to authenticated;

insert into public.challenge_catalog (id, title, summary, icon, difficulty, days, reward, items, sort) values
  ('steps-8k-7', '8,000 steps a day', 'Walk 8,000 steps every day for a week. Apple Health counts them.', 'footsteps', 'easy', 7, 250,
   '[{"kind":"habit","name":"8,000 steps","icon":"footsteps","proof":"health","metric":"steps","target":8000,"unit":"steps"}]', 10),
  ('read-20-7', 'Read 20 minutes a day', 'Read for 20 minutes every day for a week, with the focus timer running.', 'book', 'easy', 7, 250,
   '[{"kind":"habit","name":"Read 20 min","icon":"book","proof":"focus","minutes":20}]', 20),
  ('lights-out-7', 'No phone in bed', 'Phone away and lights out by bedtime, every night for a week. A photo proves it.', 'moon', 'easy', 7, 250,
   '[{"kind":"habit","name":"Phone away, lights out","icon":"moon","proof":"photo"}]', 30),
  ('steps-10k-14', '10,000 steps a day', 'Walk 10,000 steps every day for two weeks.', 'footsteps', 'medium', 14, 500,
   '[{"kind":"habit","name":"10,000 steps","icon":"footsteps","proof":"health","metric":"steps","target":10000,"unit":"steps"}]', 40),
  ('deep-work-60-14', 'Deep work, 1 hour a day', 'One hour of focused work every day for two weeks, timed by Habyss.', 'hourglass', 'medium', 14, 500,
   '[{"kind":"habit","name":"Deep work 1h","icon":"hourglass","proof":"focus","minutes":60},{"kind":"task","name":"Write down what the two weeks are for","icon":"create","proof":"photo"}]', 50),
  ('workout-30-14', 'Work out 30 minutes a day', '30 exercise minutes every day for two weeks. Your green ring counts them.', 'barbell', 'medium', 14, 500,
   '[{"kind":"habit","name":"Work out 30 min","icon":"barbell","proof":"health","metric":"exercise","target":30,"unit":"minutes"}]', 60),
  ('cold-shower-14', 'Cold shower every day', 'A cold shower every day for two weeks. A photo proves it.', 'water', 'medium', 14, 500,
   '[{"kind":"habit","name":"Cold shower","icon":"water","proof":"photo"}]', 70),
  ('steps-12k-30', '12,000 steps a day', 'Walk 12,000 steps every day for a month.', 'footsteps', 'hard', 30, 1000,
   '[{"kind":"habit","name":"12,000 steps","icon":"footsteps","proof":"health","metric":"steps","target":12000,"unit":"steps"}]', 80),
  ('deep-work-120-30', 'Deep work, 2 hours a day', 'Two hours of focused work every day for a month, timed by Habyss.', 'hourglass', 'hard', 30, 1000,
   '[{"kind":"habit","name":"Deep work 2h","icon":"hourglass","proof":"focus","minutes":120},{"kind":"task","name":"Write down what the month is for","icon":"create","proof":"photo"}]', 90),
  ('sleep-7h-30', '7 hours of sleep', 'Sleep at least 7 hours every night for a month. Apple Health counts it.', 'bed', 'hard', 30, 1000,
   '[{"kind":"habit","name":"Sleep 7h","icon":"bed","proof":"health","metric":"sleep","target":420,"unit":"minutes"}]', 100)
on conflict (id) do update set title = excluded.title, summary = excluded.summary, icon = excluded.icon, difficulty = excluded.difficulty,
    days = excluded.days, reward = excluded.reward, items = excluded.items, sort = excluded.sort, active = excluded.active;

-- --------------------------------------------------------------- the runs
create table if not exists public.challenge_runs (
    id            uuid primary key default gen_random_uuid(),
    challenge_id  text not null references public.challenge_catalog(id),
    owner_id      uuid not null references auth.users(id) on delete cascade,
    starts        date not null,
    ends          date not null,
    status        text not null default 'open' check (status in ('open', 'active', 'won', 'failed', 'cancelled')),
    created_at    timestamptz not null default now(),
    settled_at    timestamptz
);
create index if not exists challenge_runs_status on public.challenge_runs (status, ends);

create table if not exists public.challenge_members (
    run_id      uuid not null references public.challenge_runs(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    status      text not null default 'invited' check (status in ('invited', 'joined', 'declined', 'left')),
    created_at  timestamptz not null default now(),
    primary key (run_id, user_id)
);
create index if not exists challenge_members_user on public.challenge_members (user_id);

create table if not exists public.challenge_days (
    run_id   uuid not null references public.challenge_runs(id) on delete cascade,
    user_id  uuid not null references auth.users(id) on delete cascade,
    day      date not null,
    primary key (run_id, user_id, day)
);

create table if not exists public.challenge_proofs (
    id          bigint generated always as identity primary key,
    run_id      uuid not null references public.challenge_runs(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    day         date not null,
    title       text not null check (length(title) <= 120),
    path        text not null check (length(path) <= 300),
    created_at  timestamptz not null default now()
);
create index if not exists challenge_proofs_run on public.challenge_proofs (run_id, created_at desc);

create or replace function public.in_challenge(p_run uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
    select exists (select 1 from public.challenge_members where run_id = p_run and user_id = (select auth.uid()));
$$;

alter table public.challenge_runs enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_days enable row level security;
alter table public.challenge_proofs enable row level security;
drop policy if exists challenge_runs_read on public.challenge_runs;
create policy challenge_runs_read on public.challenge_runs for select to authenticated using (public.in_challenge(id));
drop policy if exists challenge_members_read on public.challenge_members;
create policy challenge_members_read on public.challenge_members for select to authenticated using (public.in_challenge(run_id));
drop policy if exists challenge_days_read on public.challenge_days;
create policy challenge_days_read on public.challenge_days for select to authenticated using (public.in_challenge(run_id));
drop policy if exists challenge_proofs_read on public.challenge_proofs;
create policy challenge_proofs_read on public.challenge_proofs for select to authenticated using (public.in_challenge(run_id));
revoke insert, update, delete on public.challenge_runs, public.challenge_members, public.challenge_days, public.challenge_proofs from authenticated, anon;
grant select on public.challenge_runs, public.challenge_members, public.challenge_days, public.challenge_proofs to authenticated;

-- Photos: anyone may read one by its (unguessable) path; you write only in your own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', true, 5242880, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic'];
drop policy if exists proofs_read on storage.objects;
create policy proofs_read on storage.objects for select to public using (bucket_id = 'proofs');
drop policy if exists proofs_write on storage.objects;
create policy proofs_write on storage.objects for insert to authenticated
    with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------ the ledger
alter table public.shards_ledger drop constraint if exists shards_ledger_reason_check;
alter table public.shards_ledger add constraint shards_ledger_reason_check
    check (reason in ('stake', 'payout', 'refund', 'unlock', 'challenge'));
alter table public.shards_ledger add column if not exists challenge_run_id uuid references public.challenge_runs(id) on delete set null;

-- ---------------------------------------------------------------- settling
-- Says something to every joined member of a run.
create or replace function public.tell_challenge(p_run uuid, p_title text, p_body text)
returns void
language sql security definer set search_path to ''
as $$
    insert into public.notifications (user_id, from_user_id, type, title, body)
    select m.user_id, r.owner_id, 'challenge', p_title, p_body
      from public.challenge_members m join public.challenge_runs r on r.id = m.run_id
     where m.run_id = p_run and m.status = 'joined';
$$;
revoke all on function public.tell_challenge(uuid, text, text) from public, anon, authenticated;

-- Won when every joined member has kept every day: each is paid the reward.
create or replace function public.check_challenge_won(p_run uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
    r public.challenge_runs;
    c public.challenge_catalog;
begin
    select * into r from public.challenge_runs where id = p_run for update;
    if not found or r.status not in ('open', 'active') then return false; end if;
    select * into c from public.challenge_catalog where id = r.challenge_id;
    if exists (select 1 from public.challenge_members m where m.run_id = p_run and m.status = 'joined'
               and (select count(*) from public.challenge_days d where d.run_id = p_run and d.user_id = m.user_id) < c.days) then
        return false;
    end if;
    update public.challenge_runs set status = 'won', settled_at = now() where id = p_run;
    insert into public.shards_ledger (user_id, amount, reason, challenge_run_id)
        select user_id, c.reward, 'challenge', p_run from public.challenge_members where run_id = p_run and status = 'joined';
    perform public.tell_challenge(p_run, 'Challenge complete', c.title || ': done, together. +' || c.reward || ' Shards each.');
    return true;
end;
$$;
revoke all on function public.check_challenge_won(uuid) from public, anon, authenticated;

-- Moves runs along: open ones start on their day (invites not answered drop off),
-- and a run with a joined member missing a day (past a day's grace) ends for all.
create or replace function public.settle_due_challenges()
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    r public.challenge_runs;
    c public.challenge_catalog;
begin
    for r in select * from public.challenge_runs where status = 'open' and starts <= current_date for update skip locked loop
        update public.challenge_members set status = 'declined' where run_id = r.id and status = 'invited';
        update public.challenge_runs set status = 'active' where id = r.id;
    end loop;
    for r in select * from public.challenge_runs where status = 'active' for update skip locked loop
        if public.check_challenge_won(r.id) then continue; end if;
        select * into c from public.challenge_catalog where id = r.challenge_id;
        if exists (
            select 1 from public.challenge_members m
              cross join generate_series(r.starts, least(r.ends, current_date - 2), interval '1 day') as g(day)
             where m.run_id = r.id and m.status = 'joined'
               and not exists (select 1 from public.challenge_days d where d.run_id = r.id and d.user_id = m.user_id and d.day = g.day::date)
        ) then
            update public.challenge_runs set status = 'failed', settled_at = now() where id = r.id;
            perform public.tell_challenge(r.id, 'Challenge over', c.title || ': a day was missed, so it ended for everyone.');
        end if;
    end loop;
end;
$$;
revoke all on function public.settle_due_challenges() from public, anon, authenticated;

-- ---------------------------------------------------------- what phones call
create or replace function public.start_challenge(p_challenge text, p_friends uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    c public.challenge_catalog;
    made uuid;
    begins date;
    friend uuid;
    who text;
begin
    if me is null then raise exception 'Sign in to start a challenge.'; end if;
    select * into c from public.challenge_catalog where id = p_challenge and active;
    if not found then raise exception 'That challenge is no longer on the list.'; end if;
    if exists (select 1 from public.challenge_runs r join public.challenge_members m on m.run_id = r.id
               where r.challenge_id = p_challenge and r.status in ('open', 'active') and m.user_id = me and m.status = 'joined') then
        raise exception 'You are already doing this challenge.';
    end if;
    begins := case when coalesce(array_length(p_friends, 1), 0) > 0 then current_date + 1 else current_date end;
    insert into public.challenge_runs (challenge_id, owner_id, starts, ends, status)
        values (p_challenge, me, begins, begins + c.days - 1, case when begins <= current_date then 'active' else 'open' end)
        returning id into made;
    insert into public.challenge_members (run_id, user_id, status) values (made, me, 'joined');
    select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into who from public.profiles where id = me;
    foreach friend in array coalesce(p_friends, '{}') loop
        if friend = me or not public.are_friends(friend) or public.blocked_between(me, friend) then continue; end if;
        insert into public.challenge_members (run_id, user_id, status) values (made, friend, 'invited') on conflict do nothing;
        insert into public.notifications (user_id, from_user_id, type, title, body)
            values (friend, me, 'challenge', who || ' invited you to a challenge', c.title || ', ' || c.days || ' days, starting tomorrow. ' || c.reward || ' Shards each if you all make it.');
    end loop;
    return made;
end;
$$;
revoke all on function public.start_challenge(text, uuid[]) from public, anon;
grant execute on function public.start_challenge(text, uuid[]) to authenticated;

create or replace function public.respond_challenge(p_run uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    r public.challenge_runs;
begin
    select * into r from public.challenge_runs where id = p_run;
    if not found or r.status <> 'open' or r.starts <= current_date then raise exception 'That challenge has already started.'; end if;
    update public.challenge_members set status = case when p_accept then 'joined' else 'declined' end
     where run_id = p_run and user_id = me and status = 'invited';
    if not found then raise exception 'That invite is gone.'; end if;
end;
$$;
revoke all on function public.respond_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;

-- Before it starts, you just leave. Once it has started, leaving ends it for everyone.
create or replace function public.leave_challenge(p_run uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    r public.challenge_runs;
    c public.challenge_catalog;
    who text;
begin
    select * into r from public.challenge_runs where id = p_run for update;
    if not found or r.status not in ('open', 'active') then return; end if;
    select * into c from public.challenge_catalog where id = r.challenge_id;
    if r.status = 'open' then
        update public.challenge_members set status = 'left' where run_id = p_run and user_id = me;
        if not exists (select 1 from public.challenge_members where run_id = p_run and status = 'joined') then
            update public.challenge_runs set status = 'cancelled', settled_at = now() where id = p_run;
        end if;
        return;
    end if;
    select coalesce(nullif(btrim(display_name), ''), username, 'Someone') into who from public.profiles where id = me;
    update public.challenge_runs set status = 'failed', settled_at = now() where id = p_run;
    perform public.tell_challenge(p_run, 'Challenge over', who || ' gave up on ' || c.title || ', so it ended for everyone.');
    update public.challenge_members set status = 'left' where run_id = p_run and user_id = me;
end;
$$;
revoke all on function public.leave_challenge(uuid) from public, anon;
grant execute on function public.leave_challenge(uuid) to authenticated;

create or replace function public.report_challenge_day(p_run uuid, p_day date)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    r public.challenge_runs;
begin
    select * into r from public.challenge_runs where id = p_run;
    if not found or r.status not in ('open', 'active') then return; end if;
    if not exists (select 1 from public.challenge_members where run_id = p_run and user_id = me and status = 'joined') then return; end if;
    -- A day of the run, and never one ahead (a day's slack for time zones).
    if p_day < r.starts or p_day > r.ends or p_day > current_date + 1 then return; end if;
    insert into public.challenge_days (run_id, user_id, day) values (p_run, me, p_day) on conflict do nothing;
    perform public.check_challenge_won(p_run);
end;
$$;
revoke all on function public.report_challenge_day(uuid, date) from public, anon;
grant execute on function public.report_challenge_day(uuid, date) to authenticated;

create or replace function public.add_challenge_proof(p_run uuid, p_day date, p_title text, p_path text)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
begin
    if not exists (select 1 from public.challenge_members where run_id = p_run and user_id = me and status = 'joined') then return; end if;
    if split_part(p_path, '/', 1) <> me::text then raise exception 'That photo is not yours.'; end if;
    insert into public.challenge_proofs (run_id, user_id, day, title, path) values (p_run, me, p_day, left(btrim(p_title), 120), p_path);
end;
$$;
revoke all on function public.add_challenge_proof(uuid, date, text, text) from public, anon;
grant execute on function public.add_challenge_proof(uuid, date, text, text) to authenticated;

-- Your challenges: running, waiting on you, or ended in the last two weeks, with
-- everyone in them, how many days each has kept, your own days, and the latest photos.
create or replace function public.my_challenges()
returns table (
    id uuid, challenge_id text, title text, summary text, icon text, difficulty text, days int, reward int, items jsonb,
    starts date, ends date, status text, owner_id uuid, my_status text, my_days date[], members jsonb, proofs jsonb
)
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
begin
    perform public.settle_due_challenges();
    return query
    select r.id, c.id, c.title, c.summary, c.icon, c.difficulty, c.days, c.reward, c.items,
           r.starts, r.ends, r.status, r.owner_id, mine.status,
           coalesce((select array_agg(d.day order by d.day) from public.challenge_days d where d.run_id = r.id and d.user_id = me), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object(
                        'id', m.user_id, 'status', m.status,
                        'name', coalesce(nullif(btrim(p.display_name), ''), p.username, 'Friend'),
                        'avatar', case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
                        'kept', (select count(*) from public.challenge_days d where d.run_id = r.id and d.user_id = m.user_id))
                      order by m.created_at)
                     from public.challenge_members m join public.profiles p on p.id = m.user_id
                    where m.run_id = r.id and m.status in ('joined', 'invited')), '[]'),
           coalesce((select jsonb_agg(x) from (
                        select jsonb_build_object('user', pr.user_id, 'day', pr.day, 'title', pr.title, 'path', pr.path) as x
                          from public.challenge_proofs pr where pr.run_id = r.id order by pr.created_at desc limit 12) proofs), '[]')
      from public.challenge_runs r
      join public.challenge_catalog c on c.id = r.challenge_id
      join public.challenge_members mine on mine.run_id = r.id and mine.user_id = me
     where (r.status in ('open', 'active') and mine.status in ('joined', 'invited'))
        or (r.settled_at > now() - interval '14 days' and mine.status in ('joined', 'left'))
     order by (mine.status = 'invited') desc, (r.status in ('open', 'active')) desc, r.created_at desc;
end;
$$;
revoke all on function public.my_challenges() from public, anon;
grant execute on function public.my_challenges() to authenticated;

-- ------------------------------------------------------------- the wallet
create or replace function public.my_ledger(p_limit int default 100)
returns table (amount int, reason text, created_at timestamptz, title text)
language sql stable security definer set search_path to ''
as $$
    select l.amount, l.reason, l.created_at,
           case when l.reason = 'unlock' then 'An hour of your apps'
                when l.reason = 'challenge' then coalesce((select c.title from public.challenge_runs r join public.challenge_catalog c on c.id = r.challenge_id where r.id = l.challenge_run_id), 'A challenge')
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

-- ------------------------------------------------------------ no more duels
-- Every stake still held goes back: a proposed duel's to its challenger, a running one's to both.
insert into public.shards_ledger (user_id, amount, reason, duel_id)
    select d.challenger_id, d.stake, 'refund', d.id from public.duels d where d.status in ('proposed', 'active') and d.stake > 0
    union all
    select d.opponent_id, d.stake, 'refund', d.id from public.duels d where d.status = 'active' and d.stake > 0;
update public.duels set status = 'cancelled', settled_at = now() where status in ('proposed', 'active');

create or replace function public.create_duel(p_friend uuid, p_stake integer default 0, p_days integer default 7)
returns uuid
language plpgsql security definer set search_path to ''
as $$
begin
    raise exception 'Duels are gone. Try a challenge together instead.';
end;
$$;

notify pgrst, 'reload schema';
