-- =============================================================================
-- Habyss: align the database with the app, and lock it down.
--
-- Additive only: no table is dropped and no user data is deleted. Safe to run
-- more than once; every step checks before it acts.
--
-- What this fixes
--   1. Every user's email and username were readable by anyone holding the
--      publishable key, which ships inside the app. Profiles are now visible to
--      signed-in users only, and email and push_token are not readable at all.
--   2. The app writes tracking_method = 'numeric'; the server only accepted
--      boolean/quantity/duration/rating, so every numeric habit would have been
--      rejected on upload.
--   3. goal_value and completion values were integers; the app plans in
--      decimals (3.6 km a day), which would have been rejected or truncated.
--   4. target_date was a timestamp. A date stored as midnight UTC reads back as
--      the previous day west of Greenwich, so a deadline moved a day earlier.
--   5. Nothing stopped two completions for the same habit on the same day, which
--      the app forbids locally and a sync upsert needs.
--   6. There was nowhere to store tasks, the parsed goal, or four habit fields
--      the app already has (ringtone, Health link, goal_spec).
--   7. Deleting an account could not work: no foreign key cascaded, so removing
--      a user failed on their first habit. Apple requires deletion to work.
--
-- Security rules are rebuilt from scratch on every table this touches, because
-- the previous set was not visible and at least one was wide open.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Drop the old security rules first.
--    Postgres refuses to change a column's type while a policy refers to it,
--    and the old set cannot be trusted anyway. The new set is created in §7.
-- -----------------------------------------------------------------------------
do $$
declare
    p record;
begin
    for p in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
              'habits', 'habit_completions', 'profiles', 'friendships',
              'friend_requests', 'shared_habits', 'shared_goals',
              'notifications', 'integrations', 'synced_activities', 'tasks'
          )
    loop
        execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 1. habits
-- -----------------------------------------------------------------------------
alter table public.habits add column if not exists ringtone text default 'default';
alter table public.habits add column if not exists health_kit_metric text;
alter table public.habits add column if not exists health_kit_target numeric;
-- The parsed goal contract: type, target, unit, window, direction, baseline.
alter table public.habits add column if not exists goal_spec jsonb;

-- Accept what the app actually writes. Any existing check on tracking_method is
-- replaced, whatever it was named.
do $$
declare
    c record;
begin
    for c in
        select conname from pg_constraint
        where conrelid = 'public.habits'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%tracking_method%'
    loop
        execute format('alter table public.habits drop constraint %I', c.conname);
    end loop;
end $$;
alter table public.habits add constraint habits_tracking_method_check
    check (tracking_method in ('boolean', 'numeric', 'quantity', 'duration', 'rating'));

-- Decimal targets, and deadlines as calendar dates rather than instants.
do $$
begin
    if (select data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'habits' and column_name = 'goal_value') <> 'numeric' then
        alter table public.habits alter column goal_value type numeric using goal_value::numeric;
    end if;

    if (select data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'habits' and column_name = 'target_date') <> 'date' then
        -- Read the stored instant in UTC, which is the calendar day it was written as.
        alter table public.habits alter column target_date type date
            using (target_date at time zone 'UTC')::date;
    end if;
end $$;

-- Deleting an account removes its habits; deleting a goal unlinks its habits
-- rather than deleting them.
alter table public.habits drop constraint if exists habits_user_id_fkey;
alter table public.habits add constraint habits_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.habits drop constraint if exists habits_goal_id_fkey;
alter table public.habits add constraint habits_goal_id_fkey
    foreign key (goal_id) references public.habits (id) on delete set null;

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habits_goal_id_idx on public.habits (goal_id);

-- -----------------------------------------------------------------------------
-- 2. habit_completions
-- -----------------------------------------------------------------------------
do $$
begin
    if (select data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'habit_completions' and column_name = 'value') <> 'numeric' then
        alter table public.habit_completions alter column value type numeric using value::numeric;
    end if;
end $$;

alter table public.habit_completions drop constraint if exists habit_completions_user_id_fkey;
alter table public.habit_completions add constraint habit_completions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.habit_completions drop constraint if exists habit_completions_habit_id_fkey;
alter table public.habit_completions add constraint habit_completions_habit_id_fkey
    foreign key (habit_id) references public.habits (id) on delete cascade;

-- One completion per habit per day, matching the app. Not created if duplicates
-- already exist, since that would need data removed; the notice says so.
do $$
begin
    if exists (select 1 from pg_indexes
               where schemaname = 'public' and indexname = 'habit_completions_habit_date_key') then
        return;
    end if;
    if exists (select 1 from public.habit_completions group by habit_id, date having count(*) > 1) then
        raise notice 'habit_completions has duplicate (habit_id, date) rows; unique index not created.';
    else
        create unique index habit_completions_habit_date_key on public.habit_completions (habit_id, date);
    end if;
end $$;

create index if not exists habit_completions_user_date_idx on public.habit_completions (user_id, date);

-- -----------------------------------------------------------------------------
-- 3. tasks: one-off work, alongside habits and goals
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    title text not null check (char_length(title) between 1 and 500),
    description text check (description is null or char_length(description) <= 5000),
    due_date date,
    due_time text check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
    priority smallint not null default 2 check (priority between 1 and 3),
    goal_id uuid references public.habits (id) on delete set null,
    status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
    completed_at timestamptz,
    source text not null default 'app' check (source in ('app', 'mcp', 'shortcut')),
    external_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date) where deleted_at is null;
create index if not exists tasks_goal_id_idx on public.tasks (goal_id);
-- Re-importing the same plan updates rather than duplicates.
create unique index if not exists tasks_user_external_key
    on public.tasks (user_id, external_id) where external_id is not null;

-- -----------------------------------------------------------------------------
-- 4. profiles
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade;

-- Every new account gets a profile. on conflict makes this safe alongside any
-- older trigger that does the same thing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Column-level access. Rules decide which rows; grants decide which columns.
-- email and push_token are not readable by any client: a user's own email is
-- in their session already, and push tokens are only used server-side.
revoke all on public.profiles from anon;
revoke select, insert, update, delete on public.profiles from authenticated;
grant select (id, username, avatar_url, created_at, updated_at) on public.profiles to authenticated;
grant insert (id, username, avatar_url) on public.profiles to authenticated;
grant update (username, avatar_url, push_token, updated_at) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Social and integration tables: cascade with the account
-- -----------------------------------------------------------------------------
alter table public.friendships drop constraint if exists friendships_user_id_fkey;
alter table public.friendships add constraint friendships_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.friendships drop constraint if exists friendships_friend_id_fkey;
alter table public.friendships add constraint friendships_friend_id_fkey
    foreign key (friend_id) references public.profiles (id) on delete cascade;

alter table public.friend_requests drop constraint if exists friend_requests_from_user_id_fkey;
alter table public.friend_requests add constraint friend_requests_from_user_id_fkey
    foreign key (from_user_id) references public.profiles (id) on delete cascade;
alter table public.friend_requests drop constraint if exists friend_requests_to_user_id_fkey;
alter table public.friend_requests add constraint friend_requests_to_user_id_fkey
    foreign key (to_user_id) references public.profiles (id) on delete cascade;

alter table public.shared_habits drop constraint if exists shared_habits_habit_id_fkey;
alter table public.shared_habits add constraint shared_habits_habit_id_fkey
    foreign key (habit_id) references public.habits (id) on delete cascade;
alter table public.shared_habits drop constraint if exists shared_habits_owner_id_fkey;
alter table public.shared_habits add constraint shared_habits_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete cascade;
alter table public.shared_habits drop constraint if exists shared_habits_shared_with_id_fkey;
alter table public.shared_habits add constraint shared_habits_shared_with_id_fkey
    foreign key (shared_with_id) references public.profiles (id) on delete cascade;

alter table public.shared_goals drop constraint if exists shared_goals_goal_id_fkey;
alter table public.shared_goals add constraint shared_goals_goal_id_fkey
    foreign key (goal_id) references public.habits (id) on delete cascade;
alter table public.shared_goals drop constraint if exists shared_goals_owner_id_fkey;
alter table public.shared_goals add constraint shared_goals_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete cascade;
alter table public.shared_goals drop constraint if exists shared_goals_shared_with_id_fkey;
alter table public.shared_goals add constraint shared_goals_shared_with_id_fkey
    foreign key (shared_with_id) references public.profiles (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.notifications add constraint notifications_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_from_user_id_fkey;
alter table public.notifications add constraint notifications_from_user_id_fkey
    foreign key (from_user_id) references public.profiles (id) on delete cascade;

alter table public.integrations drop constraint if exists integrations_user_id_fkey;
alter table public.integrations add constraint integrations_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.synced_activities drop constraint if exists synced_activities_integration_id_fkey;
alter table public.synced_activities add constraint synced_activities_integration_id_fkey
    foreign key (integration_id) references public.integrations (id) on delete cascade;
alter table public.synced_activities drop constraint if exists synced_activities_habit_id_fkey;
alter table public.synced_activities add constraint synced_activities_habit_id_fkey
    foreign key (habit_id) references public.habits (id) on delete set null;

create index if not exists friendships_user_idx on public.friendships (user_id);
create index if not exists friendships_friend_idx on public.friendships (friend_id);
create index if not exists friend_requests_to_idx on public.friend_requests (to_user_id);
create index if not exists shared_habits_with_idx on public.shared_habits (shared_with_id, habit_id);
create index if not exists shared_goals_with_idx on public.shared_goals (shared_with_id, goal_id);
create index if not exists notifications_user_idx on public.notifications (user_id);

-- -----------------------------------------------------------------------------
-- 6. Helpers for the security rules.
--    security definer so they can look across tables without re-entering the
--    rules they are part of, which would otherwise recurse.
-- -----------------------------------------------------------------------------
create or replace function public.owns_habit(p_habit_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.habits
        where id = p_habit_id and user_id = (select auth.uid())
    );
$$;

-- A habit is visible to its owner, to anyone it was shared with and who
-- accepted, and to anyone who accepted the goal it belongs to.
create or replace function public.can_view_habit(p_habit_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.habits h
        where h.id = p_habit_id
          and (
              h.user_id = (select auth.uid())
              or exists (
                  select 1 from public.shared_habits s
                  where s.habit_id = h.id
                    and s.shared_with_id = (select auth.uid())
                    and s.status = 'accepted' and s.deleted_at is null
              )
              or exists (
                  select 1 from public.shared_goals g
                  where g.goal_id in (h.id, h.goal_id)
                    and g.shared_with_id = (select auth.uid())
                    and g.status = 'accepted' and g.deleted_at is null
              )
          )
    );
$$;

create or replace function public.are_friends(p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.friendships
        where deleted_at is null
          and ((user_id = (select auth.uid()) and friend_id = p_other)
            or (friend_id = (select auth.uid()) and user_id = p_other))
    );
$$;

create or replace function public.owns_integration(p_integration_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.integrations
        where id = p_integration_id and user_id = (select auth.uid())
    );
$$;

revoke all on function public.owns_habit(uuid), public.can_view_habit(uuid),
    public.are_friends(uuid), public.owns_integration(uuid) from public, anon;
grant execute on function public.owns_habit(uuid), public.can_view_habit(uuid),
    public.are_friends(uuid), public.owns_integration(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Security rules. Every table on, anonymous access off, owner first.
-- -----------------------------------------------------------------------------
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.tasks enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.shared_habits enable row level security;
alter table public.shared_goals enable row level security;
alter table public.notifications enable row level security;
alter table public.integrations enable row level security;
alter table public.synced_activities enable row level security;

-- Nothing is readable or writable without signing in.
revoke all on public.habits, public.habit_completions, public.tasks, public.friendships,
    public.friend_requests, public.shared_habits, public.shared_goals, public.notifications,
    public.integrations, public.synced_activities from anon;
grant select, insert, update, delete on public.habits, public.habit_completions, public.tasks,
    public.friendships, public.friend_requests, public.shared_habits, public.shared_goals,
    public.notifications, public.integrations, public.synced_activities to authenticated;

-- habits
create policy habits_select on public.habits for select to authenticated
    using (user_id = (select auth.uid()) or public.can_view_habit(id));
create policy habits_insert on public.habits for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy habits_update on public.habits for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy habits_delete on public.habits for delete to authenticated
    using (user_id = (select auth.uid()));

-- habit_completions: readable where the habit is; written only on your own habits.
create policy completions_select on public.habit_completions for select to authenticated
    using (user_id = (select auth.uid()) or public.can_view_habit(habit_id));
create policy completions_insert on public.habit_completions for insert to authenticated
    with check (user_id = (select auth.uid()) and public.owns_habit(habit_id));
create policy completions_update on public.habit_completions for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and public.owns_habit(habit_id));
create policy completions_delete on public.habit_completions for delete to authenticated
    using (user_id = (select auth.uid()));

-- tasks: private to their owner.
create policy tasks_all on public.tasks for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- profiles: signed-in users can find each other by username; the column grants
-- in §4 keep email and push_token out of reach.
create policy profiles_select on public.profiles for select to authenticated
    using (true);
create policy profiles_insert on public.profiles for insert to authenticated
    with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
    using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- friendships
create policy friendships_select on public.friendships for select to authenticated
    using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
create policy friendships_insert on public.friendships for insert to authenticated
    with check (user_id = (select auth.uid()) and friend_id <> user_id);
create policy friendships_update on public.friendships for update to authenticated
    using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
create policy friendships_delete on public.friendships for delete to authenticated
    using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

-- friend_requests: sender creates and can withdraw; recipient answers.
create policy requests_select on public.friend_requests for select to authenticated
    using (from_user_id = (select auth.uid()) or to_user_id = (select auth.uid()));
create policy requests_insert on public.friend_requests for insert to authenticated
    with check (from_user_id = (select auth.uid()) and to_user_id <> from_user_id);
create policy requests_update on public.friend_requests for update to authenticated
    using (from_user_id = (select auth.uid()) or to_user_id = (select auth.uid()));
create policy requests_delete on public.friend_requests for delete to authenticated
    using (from_user_id = (select auth.uid()));

-- shared_habits / shared_goals: only the owner can share, only their own items.
create policy shared_habits_select on public.shared_habits for select to authenticated
    using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
create policy shared_habits_insert on public.shared_habits for insert to authenticated
    with check (owner_id = (select auth.uid()) and public.owns_habit(habit_id));
create policy shared_habits_update on public.shared_habits for update to authenticated
    using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
create policy shared_habits_delete on public.shared_habits for delete to authenticated
    using (owner_id = (select auth.uid()));

create policy shared_goals_select on public.shared_goals for select to authenticated
    using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
create policy shared_goals_insert on public.shared_goals for insert to authenticated
    with check (owner_id = (select auth.uid()) and public.owns_habit(goal_id));
create policy shared_goals_update on public.shared_goals for update to authenticated
    using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
create policy shared_goals_delete on public.shared_goals for delete to authenticated
    using (owner_id = (select auth.uid()));

-- notifications: yours to read; you can only notify yourself or a friend.
create policy notifications_select on public.notifications for select to authenticated
    using (user_id = (select auth.uid()));
create policy notifications_insert on public.notifications for insert to authenticated
    with check (
        from_user_id = (select auth.uid())
        and (user_id = (select auth.uid()) or public.are_friends(user_id))
    );
create policy notifications_update on public.notifications for update to authenticated
    using (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
    using (user_id = (select auth.uid()));

-- integrations and what they synced: owner only.
create policy integrations_all on public.integrations for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy synced_select on public.synced_activities for select to authenticated
    using (public.owns_integration(integration_id));
create policy synced_write on public.synced_activities for all to authenticated
    using (public.owns_integration(integration_id)) with check (public.owns_integration(integration_id));

-- -----------------------------------------------------------------------------
-- 8. updated_at, kept by the database rather than trusted from the client,
--    because sync resolves conflicts by it.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array['habits', 'habit_completions', 'tasks', 'profiles',
                             'friendships', 'friend_requests', 'shared_habits',
                             'shared_goals', 'notifications', 'integrations']
    loop
        execute format('drop trigger if exists set_updated_at on public.%I', t);
        execute format('create trigger set_updated_at before update on public.%I
                        for each row execute function public.set_updated_at()', t);
    end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 9. In-app account deletion.
--    Deletes the signed-in user; the cascades above remove everything they own.
--    Runs with elevated rights so the app never needs the service key.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := (select auth.uid());
begin
    if uid is null then
        raise exception 'Not signed in' using errcode = '28000';
    end if;
    delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- -----------------------------------------------------------------------------
-- 10. What friends can see of each other: numbers, never habits.
--
--     Friends see how consistent you are, not what you are working on. This
--     returns aggregates only, for the caller and their friends, and never a
--     habit name, target or note. Habits a friend was explicitly shared remain
--     readable through the rules above.
--
--     p_today is the caller's local date, because "today" in UTC is the wrong
--     day for anyone far from Greenwich.
-- -----------------------------------------------------------------------------
create or replace function public.friend_stats(p_today date)
returns table (
    user_id uuid,
    username text,
    avatar_url text,
    today_done integer,
    active_habits integer,
    week_done integer[],
    current_streak integer
)
language sql
stable
security definer
set search_path = ''
as $$
    with people as (
        select (select auth.uid()) as id
        union
        select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end
        from public.friendships f
        where f.deleted_at is null
          and (f.user_id = (select auth.uid()) or f.friend_id = (select auth.uid()))
    ),
    days as (
        select c.user_id, c.date, count(*)::integer as done
        from public.habit_completions c
        join people p on p.id = c.user_id
        where c.deleted_at is null
          and c.completed is not false
          and c.date between p_today - 400 and p_today
        group by c.user_id, c.date
    )
    select
        p.id,
        pr.username,
        pr.avatar_url,
        coalesce((select d.done from days d where d.user_id = p.id and d.date = p_today), 0),
        (select count(*)::integer from public.habits h
          where h.user_id = p.id and not h.is_goal and not h.is_archived and h.deleted_at is null),
        array(select coalesce((select d.done from days d where d.user_id = p.id and d.date = p_today - g), 0)
              from generate_series(6, 0, -1) as g),
        -- Consecutive days with something logged, counting back from today, or
        -- from yesterday if today is not logged yet: an open day is not a break.
        (select count(*)::integer from (
            select d.date, row_number() over (order by d.date desc) as n
            from days d
            where d.user_id = p.id
              and d.date <= p_today
        ) run
        where run.date = (case when exists (select 1 from days t where t.user_id = p.id and t.date = p_today)
                               then p_today else p_today - 1 end) - (run.n - 1)::integer)
    from people p
    join public.profiles pr on pr.id = p.id
    where (select auth.uid()) is not null;
$$;

revoke all on function public.friend_stats(date) from public, anon;
grant execute on function public.friend_stats(date) to authenticated;

commit;
