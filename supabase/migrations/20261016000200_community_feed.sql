-- The Community feed, friends' status, the leaderboard — and names that save.
--
-- 1. Names, bios and sharing switches can be read and saved.
--    profiles uses column-level grants, and display_name, bio and sharing were
--    added without them: every save of a name failed and every read came back
--    empty, which is why no account had a name on the server.
--
-- 2. Chat is gone. Its table, trigger and push function are dropped.
--
-- 3. The feed. Each person's day card (day_cards, kept current by the app) is
--    posted at the time they choose. Posting runs here, on a schedule
--    (pg_cron), so it happens even when the phone is off. Friends acknowledge
--    a post; acknowledgements are their own table so they can feed Marks later.
--
-- 4. Status. A friend is "locked in" while focusing, "live" while the app is
--    open, "asleep" inside their own sleep window, in their own time zone.
--    The phone writes the facts (presence, focus, schedule); the reader decides
--    what they mean, so nothing has to run to flip someone to asleep.
--
-- 5. The leaderboard: friends, or everyone who shares their progress, by Marks.
--
--   node scripts/apply-migration.mjs

-- ------------------------------------------------------------- 1. profiles
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists share_time time not null default '21:00';
alter table public.profiles add column if not exists share_enabled boolean not null default true;
alter table public.profiles add column if not exists wake_time time;
alter table public.profiles add column if not exists sleep_time time;
alter table public.profiles add column if not exists presence text not null default 'away';
alter table public.profiles add column if not exists presence_at timestamptz;
alter table public.profiles add column if not exists focus_until timestamptz;
alter table public.profiles add column if not exists focus_label text;

alter table public.profiles drop constraint if exists profiles_presence_check;
alter table public.profiles add constraint profiles_presence_check check (presence in ('live', 'away'));
alter table public.profiles drop constraint if exists profiles_focus_label_length;
alter table public.profiles add constraint profiles_focus_label_length check (focus_label is null or char_length(focus_label) <= 80);

-- What anyone signed in may read of a profile (email and push_token stay private).
grant select (display_name, bio, sharing, timezone, wake_time, sleep_time,
              presence, presence_at, focus_until, focus_label)
    on public.profiles to authenticated;
-- What an owner may change on their own row (profiles_update keeps it to their own).
grant update (display_name, bio, sharing, timezone, share_time, share_enabled,
              wake_time, sleep_time, presence, presence_at, focus_until, focus_label)
    on public.profiles to authenticated;
-- The owner reads their own sharing time through my_settings() below; others never need it.

create or replace function public.my_settings()
returns table (share_time time, share_enabled boolean)
language sql stable security definer set search_path to ''
as $$
    select p.share_time, p.share_enabled from public.profiles p where p.id = (select auth.uid());
$$;
revoke all on function public.my_settings() from public, anon;
grant execute on function public.my_settings() to authenticated;

-- ----------------------------------------------------------------- 2. chat
drop trigger if exists messages_push on public.messages;
drop function if exists public.push_message();
do $$
begin
    if exists (select 1 from pg_publication_tables
               where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
        alter publication supabase_realtime drop table public.messages;
    end if;
end $$;
drop table if exists public.messages;
-- Only chat read friends' cards this way; the feed has its own function below.
drop function if exists public.friend_day_cards(uuid, date);

-- ------------------------------------------------------------------ 3. feed
alter table public.day_cards add column if not exists posted_at timestamptz;
create index if not exists day_cards_posted_idx on public.day_cards (posted_at desc) where posted_at is not null;

create table if not exists public.post_acknowledgements (
    post_user uuid not null,
    post_day date not null,
    from_user uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_user, post_day, from_user),
    foreign key (post_user, post_day) references public.day_cards (user_id, day) on delete cascade,
    check (from_user <> post_user)
);
create index if not exists post_acknowledgements_from_idx on public.post_acknowledgements (from_user);

alter table public.post_acknowledgements enable row level security;

drop policy if exists post_acks_select on public.post_acknowledgements;
create policy post_acks_select on public.post_acknowledgements for select to authenticated
    using (from_user = (select auth.uid()) or post_user = (select auth.uid()) or public.are_friends(post_user));

drop policy if exists post_acks_insert on public.post_acknowledgements;
create policy post_acks_insert on public.post_acknowledgements for insert to authenticated
    with check (
        from_user = (select auth.uid())
        and public.are_friends(post_user)
        and not public.blocked_between(from_user, post_user)
        and exists (select 1 from public.day_cards c
                    where c.user_id = post_user and c.day = post_day and c.posted_at is not null)
    );

drop policy if exists post_acks_delete on public.post_acknowledgements;
create policy post_acks_delete on public.post_acknowledgements for delete to authenticated
    using (from_user = (select auth.uid()));

/*
 * The feed: your posts and your friends', newest first, a page at a time.
 * Habit and task names follow each author's `habits` sharing switch; the whole
 * post follows `progress`.
 */
create or replace function public.community_feed(p_before timestamptz default null, p_limit int default 20)
returns table (
    user_id uuid, day date, posted_at timestamptz, card jsonb,
    username text, display_name text, avatar_url text,
    ack_count int, acked_by_me boolean, ack_users uuid[]
)
language sql stable security definer set search_path to ''
as $$
    select c.user_id, c.day, c.posted_at,
        case when coalesce((p.sharing ->> 'habits')::boolean, true) or c.user_id = (select auth.uid())
            then c.card else (c.card - 'habits' - 'tasks') end,
        p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        (select count(*)::int from public.post_acknowledgements a where a.post_user = c.user_id and a.post_day = c.day),
        exists (select 1 from public.post_acknowledgements a
                where a.post_user = c.user_id and a.post_day = c.day and a.from_user = (select auth.uid())),
        array(select a.from_user from public.post_acknowledgements a
              where a.post_user = c.user_id and a.post_day = c.day order by a.created_at limit 5)
    from public.day_cards c
    join public.profiles p on p.id = c.user_id
    where c.posted_at is not null
      and (p_before is null or c.posted_at < p_before)
      and (
          c.user_id = (select auth.uid())
          or (public.are_friends(c.user_id)
              and not public.blocked_between((select auth.uid()), c.user_id)
              and coalesce((p.sharing ->> 'progress')::boolean, true))
      )
    order by c.posted_at desc
    limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.community_feed(timestamptz, int) from public, anon;
grant execute on function public.community_feed(timestamptz, int) to authenticated;

/*
 * Posts every day card whose owner's chosen time has passed today, in their
 * own time zone. Run by pg_cron every five minutes; safe to run any time.
 * A day with nothing scheduled and nothing done is not posted.
 */
create or replace function public.post_due_day_cards()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    posted integer;
begin
    update public.day_cards c
       set posted_at = now()
      from public.profiles p
     where p.id = c.user_id
       and c.posted_at is null
       and p.share_enabled
       and c.day = (now() at time zone coalesce(p.timezone, 'UTC'))::date
       and (now() at time zone coalesce(p.timezone, 'UTC'))::time >= p.share_time
       and coalesce((c.card ->> 'habitsTotal')::int, 0) + coalesce((c.card ->> 'tasksTotal')::int, 0) > 0;
    get diagnostics posted = row_count;
    return posted;
end;
$$;
revoke all on function public.post_due_day_cards() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
    if exists (select 1 from cron.job where jobname = 'post-due-day-cards') then
        perform cron.unschedule('post-due-day-cards');
    end if;
    perform cron.schedule('post-due-day-cards', '*/5 * * * *', 'select public.post_due_day_cards()');
end $$;

-- A posted card is a published record: the app may keep refreshing today's
-- card until it is posted, and not afterwards.
drop policy if exists day_cards_own on public.day_cards;
create policy day_cards_select_own on public.day_cards for select to authenticated
    using (user_id = (select auth.uid()));
create policy day_cards_insert_own on public.day_cards for insert to authenticated
    with check (user_id = (select auth.uid()) and posted_at is null);
create policy day_cards_update_own on public.day_cards for update to authenticated
    using (user_id = (select auth.uid()) and posted_at is null)
    with check (user_id = (select auth.uid()) and posted_at is null);
create policy day_cards_delete_own on public.day_cards for delete to authenticated
    using (user_id = (select auth.uid()));

do $$
begin
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_acknowledgements') then
        alter publication supabase_realtime add table public.post_acknowledgements;
    end if;
end $$;

-- ---------------------------------------------------------------- 4. status
/*
 * Each friend's status facts. What they mean (locked in, live, asleep) is
 * decided by the reader against the clock, in lib/presence.ts.
 */
create or replace function public.friend_presence()
returns table (
    user_id uuid, username text, display_name text, avatar_url text,
    presence text, presence_at timestamptz, focus_until timestamptz, focus_label text,
    timezone text, wake_time time, sleep_time time
)
language sql stable security definer set search_path to ''
as $$
    select p.id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        p.presence, p.presence_at, p.focus_until,
        case when coalesce((p.sharing ->> 'habits')::boolean, true) then p.focus_label end,
        p.timezone, p.wake_time, p.sleep_time
    from public.profiles p
    where public.are_friends(p.id)
      and not public.blocked_between((select auth.uid()), p.id);
$$;
revoke all on function public.friend_presence() from public, anon;
grant execute on function public.friend_presence() to authenticated;

-- ----------------------------------------------------------- 5. leaderboard
/*
 * Ranked by Marks. 'friends' is you and your friends; 'world' is everyone who
 * shares their progress — the top 50, plus your own row wherever you are.
 */
create or replace function public.leaderboard(p_scope text default 'friends')
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text, marks int, is_me boolean)
language sql stable security definer set search_path to ''
as $$
    with pool as (
        select p.id, p.username, p.display_name, p.avatar_url, p.marks, p.sharing
        from public.profiles p
        where p.marks is not null
          and p.username is not null
          and (p.id = (select auth.uid()) or coalesce((p.sharing ->> 'progress')::boolean, true))
          and (p_scope = 'world' or p.id = (select auth.uid()) or public.are_friends(p.id))
          and (p.id = (select auth.uid()) or not public.blocked_between((select auth.uid()), p.id))
    ), ranked as (
        select rank() over (order by marks desc, username) as rank, * from pool
    )
    select r.rank, r.id, r.username,
        case when coalesce((r.sharing ->> 'name')::boolean, true) then r.display_name end,
        case when coalesce((r.sharing ->> 'photo')::boolean, true) then r.avatar_url end,
        r.marks, r.id = (select auth.uid())
    from ranked r
    where r.rank <= 50 or r.id = (select auth.uid())
    order by r.rank;
$$;
revoke all on function public.leaderboard(text) from public, anon;
grant execute on function public.leaderboard(text) to authenticated;

notify pgrst, 'reload schema';
