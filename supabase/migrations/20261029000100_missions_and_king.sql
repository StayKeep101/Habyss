-- Secret missions, and King of the Week.
--
-- Secret missions: each week everyone gets one private mission about a
-- friend, chosen here (the same one every time it is asked for that week):
--   full_day  get them to keep every habit on one day this week;
--   show_up   get them to show up (do anything) on three days this week;
--   react     get them to react to one of your days this week.
-- Only you see it while the week runs; it is checked here against what your
-- friend actually did (their day cards, their reactions), and done the moment
-- it is. When the week is over the friend is told what it was.
--
-- King of the Week: the most consistent person in your crew (you and the
-- friends who share progress): most days shown up, then most show-ups (a
-- habit or task done, at most three a day), then whoever got there first.
-- Last week's wins the crown for this one. The king may set one challenge for
-- the crew for the week; friends say they are in.
--
--   node scripts/apply-migration.mjs

-- ------------------------------------------------------------- the tables
create table if not exists public.secret_missions (
    user_id      uuid not null references auth.users(id) on delete cascade,
    week         date not null,
    friend_id    uuid not null references auth.users(id) on delete cascade,
    kind         text not null check (kind in ('full_day', 'show_up', 'react')),
    target       int not null check (target > 0),
    completed_at timestamptz,
    created_at   timestamptz not null default now(),
    primary key (user_id, week)
);
create index if not exists secret_missions_friend on public.secret_missions (friend_id, week);

create table if not exists public.crew_challenges (
    king_id    uuid not null references auth.users(id) on delete cascade,
    week       date not null,
    text       text not null check (length(btrim(text)) between 3 and 90),
    created_at timestamptz not null default now(),
    primary key (king_id, week)
);
create table if not exists public.challenge_joins (
    king_id   uuid not null,
    week      date not null,
    user_id   uuid not null references auth.users(id) on delete cascade,
    joined_at timestamptz not null default now(),
    primary key (king_id, week, user_id),
    foreign key (king_id, week) references public.crew_challenges (king_id, week) on delete cascade
);

alter table public.secret_missions enable row level security;
alter table public.crew_challenges enable row level security;
alter table public.challenge_joins enable row level security;
-- Everything goes through the functions below; nothing is read or written directly.
revoke all on public.secret_missions, public.crew_challenges, public.challenge_joins from authenticated, anon;

-- ------------------------------------------------- consistency, for the crown
-- Days shown up and show-ups for each person in the caller's crew over a range.
create or replace function public.crew_consistency(p_from date, p_to date)
returns table (user_id uuid, username text, display_name text, avatar_url text, days int, show_ups int, first_at timestamptz)
language sql stable security definer set search_path to ''
as $$
    select p.id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        count(c.day) filter (where coalesce((c.card ->> 'habitsDone')::int, 0) + coalesce((c.card ->> 'tasksDone')::int, 0) > 0)::int,
        coalesce(sum(least(3, coalesce((c.card ->> 'habitsDone')::int, 0) + coalesce((c.card ->> 'tasksDone')::int, 0))), 0)::int,
        min(c.updated_at)
    from public.profiles p
    left join public.day_cards c on c.user_id = p.id and c.day between p_from and p_to
    where p.id = (select auth.uid())
       or (public.are_friends(p.id)
           and not public.blocked_between((select auth.uid()), p.id)
           and coalesce((p.sharing ->> 'progress')::boolean, true))
    group by p.id;
$$;
revoke all on function public.crew_consistency(date, date) from public, anon;
grant execute on function public.crew_consistency(date, date) to authenticated;

-- The king of a week in the caller's crew: null when nobody showed up.
create or replace function public.crew_king(p_from date, p_to date)
returns table (user_id uuid, username text, display_name text, avatar_url text, days int, show_ups int)
language sql stable security definer set search_path to ''
as $$
    select c.user_id, c.username, c.display_name, c.avatar_url, c.days, c.show_ups
    from public.crew_consistency(p_from, p_to) c
    where c.days > 0
    order by c.days desc, c.show_ups desc, c.first_at asc nulls last, c.user_id
    limit 1;
$$;
revoke all on function public.crew_king(date, date) from public, anon;
grant execute on function public.crew_king(date, date) to authenticated;

-- ------------------------------------------------------------ the mission
-- Your mission for the week starting p_week: chosen once, then checked.
create or replace function public.my_mission(p_week date)
returns table (friend_id uuid, username text, display_name text, avatar_url text, kind text, target int, progress int, completed boolean, ends date)
language plpgsql security definer set search_path to ''
as $$
#variable_conflict use_column
declare
    me uuid := (select auth.uid());
    m public.secret_missions;
    done_count int;
begin
    if me is null then return; end if;
    select * into m from public.secret_missions s where s.user_id = me and s.week = p_week;
    if not found then
        -- A friend who shares progress, and a kind, picked the same way every time for this week.
        insert into public.secret_missions (user_id, week, friend_id, kind, target)
        select me, p_week, f.id, k.kind, k.target
        from (
            select p.id from public.profiles p
            where public.are_friends(p.id) and not public.blocked_between(me, p.id)
              and coalesce((p.sharing ->> 'progress')::boolean, true)
            order by md5(me::text || p_week::text || p.id::text) limit 1
        ) f
        cross join lateral (
            select kind, target from (values ('full_day', 1), ('show_up', 3), ('react', 1)) as v(kind, target)
            order by md5(p_week::text || me::text || v.kind) limit 1
        ) k
        on conflict do nothing;
        select * into m from public.secret_missions s where s.user_id = me and s.week = p_week;
        if not found then return; end if;
    end if;

    done_count := case m.kind
        when 'full_day' then (select count(*)::int from public.day_cards c
            where c.user_id = m.friend_id and c.day between m.week and m.week + 6
              and coalesce((c.card ->> 'habitsTotal')::int, 0) > 0
              and (c.card ->> 'habitsDone')::int >= (c.card ->> 'habitsTotal')::int)
        when 'show_up' then (select count(*)::int from public.day_cards c
            where c.user_id = m.friend_id and c.day between m.week and m.week + 6
              and coalesce((c.card ->> 'habitsDone')::int, 0) + coalesce((c.card ->> 'tasksDone')::int, 0) > 0)
        else (select count(*)::int from public.post_acknowledgements a
            where a.from_user = m.friend_id and a.post_user = me
              and a.created_at >= m.week and a.created_at < m.week + 7)
    end;
    if done_count >= m.target and m.completed_at is null then
        update public.secret_missions set completed_at = now() where user_id = me and week = p_week;
        m.completed_at := now();
    end if;

    return query
    select p.id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        m.kind, m.target, least(done_count, m.target), m.completed_at is not null, m.week + 6
    from public.profiles p where p.id = m.friend_id;
end;
$$;
revoke all on function public.my_mission(date) from public, anon;
grant execute on function public.my_mission(date) to authenticated;

-- Secrets out: last week's missions that were about you, and your own, now the week is over.
create or replace function public.revealed_missions(p_week date)
returns table (owner_id uuid, owner_name text, owner_avatar text, friend_id uuid, friend_name text, kind text, completed boolean, mine boolean)
language sql stable security definer set search_path to ''
as $$
    select s.user_id, coalesce(nullif(btrim(o.display_name), ''), o.username), o.avatar_url,
           s.friend_id, coalesce(nullif(btrim(f.display_name), ''), f.username),
           s.kind, s.completed_at is not null, s.user_id = (select auth.uid())
    from public.secret_missions s
    join public.profiles o on o.id = s.user_id
    join public.profiles f on f.id = s.friend_id
    where s.week = p_week - 7 and p_week <= current_date + 1
      and (s.friend_id = (select auth.uid()) or s.user_id = (select auth.uid()));
$$;
revoke all on function public.revealed_missions(date) from public, anon;
grant execute on function public.revealed_missions(date) to authenticated;

-- --------------------------------------------------------- the challenge
-- The king (last week's most consistent in your crew) sets this week's challenge, once.
create or replace function public.issue_challenge(p_week date, p_text text)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    king uuid;
begin
    select k.user_id into king from public.crew_king(p_week - 7, p_week - 1) k;
    if king is distinct from me then raise exception 'Only this week''s king or queen can set the challenge.'; end if;
    insert into public.crew_challenges (king_id, week, text) values (me, p_week, btrim(p_text))
        on conflict (king_id, week) do update set text = excluded.text;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        select case when f.user_id = me then f.friend_id else f.user_id end, me, 'challenge',
               coalesce((select coalesce(nullif(btrim(display_name), ''), username) from public.profiles where id = me), 'Your king') || ' set a challenge',
               btrim(p_text)
          from public.friendships f where f.deleted_at is null and (f.user_id = me or f.friend_id = me);
end;
$$;
revoke all on function public.issue_challenge(date, text) from public, anon;
grant execute on function public.issue_challenge(date, text) to authenticated;

create or replace function public.join_challenge(p_king uuid, p_week date)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
    if p_king <> (select auth.uid()) and not public.are_friends(p_king) then raise exception 'That challenge is not for you.'; end if;
    insert into public.challenge_joins (king_id, week, user_id) values (p_king, p_week, (select auth.uid())) on conflict do nothing;
end;
$$;
revoke all on function public.join_challenge(uuid, date) from public, anon;
grant execute on function public.join_challenge(uuid, date) to authenticated;

-- This week's challenges in your crew: from kings who are you or your friends.
create or replace function public.crew_challenges_for(p_week date)
returns table (king_id uuid, king_name text, king_avatar text, text text, joined int, joined_by_me boolean)
language sql stable security definer set search_path to ''
as $$
    select c.king_id, coalesce(nullif(btrim(p.display_name), ''), p.username), p.avatar_url, c.text,
           (select count(*)::int from public.challenge_joins j where j.king_id = c.king_id and j.week = c.week),
           exists (select 1 from public.challenge_joins j where j.king_id = c.king_id and j.week = c.week and j.user_id = (select auth.uid()))
    from public.crew_challenges c join public.profiles p on p.id = c.king_id
    where c.week = p_week
      and (c.king_id = (select auth.uid()) or (public.are_friends(c.king_id) and not public.blocked_between((select auth.uid()), c.king_id)));
$$;
revoke all on function public.crew_challenges_for(date) from public, anon;
grant execute on function public.crew_challenges_for(date) to authenticated;

notify pgrst, 'reload schema';
