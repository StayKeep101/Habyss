-- Sharing that works end to end, and a tidier schema underneath it.
--
-- 1. Completions are one per person, per habit, per day.
--    The unique key was (habit_id, date), so on a shared habit only one person
--    could ever complete it on a given day; the second insert collided with
--    the first. It is now (user_id, habit_id, date).
--
-- 2. Everybody on a shared habit can log their own completions of it.
--    Inserting required owning the habit, so the person a habit was shared
--    with could never back up their own ticks.
--
-- 3. A shared task's done-state belongs to each person.
--    Since 20261005 a participant may edit a shared task (title, date), but
--    marking it done must not mark it done for the owner too. Who did their
--    part is recorded in shared_completions; the task row keeps the owner's.
--
-- 4. Only people on a shared item can record a completion of it.
--
-- 5. Live updates: notifications and shared completions stream to the
--    phones allowed to read them (messages are added by 20261015000100_chat).
--
-- 6. Duplicate indexes and duplicate unique constraints removed. Several
--    tables carried two or three copies of the same index from older
--    migrations; each copy is written on every insert and buys nothing.
--    Indexes the sync queries need are added.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261016000100_sharing_foundation.sql

-- ------------------------------------------------- 1. completions per person
alter table public.habit_completions drop constraint if exists habit_completions_habit_id_date_key;
drop index if exists public.habit_completions_habit_date_key;
alter table public.habit_completions
    drop constraint if exists habit_completions_user_habit_date_key;
alter table public.habit_completions
    add constraint habit_completions_user_habit_date_key unique (user_id, habit_id, date);

-- ------------------------------------- 2. participants log their own ticks
drop policy if exists completions_insert on public.habit_completions;
create policy completions_insert on public.habit_completions for insert to authenticated
    with check (user_id = (select auth.uid()) and public.can_view_habit(habit_id));

drop policy if exists completions_update on public.habit_completions;
create policy completions_update on public.habit_completions for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and public.can_view_habit(habit_id));

-- ------------------------------------------ 3. a task's done-state is personal
create or replace function public.keep_task_owner()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
    new.user_id := old.user_id;
    -- Somebody else on a shared task can change the plan, not the owner's progress.
    if (select auth.uid()) is distinct from old.user_id then
        new.status := old.status;
        new.completed_at := old.completed_at;
        new.amount := old.amount;
        new.deleted_at := old.deleted_at;
    end if;
    return new;
end;
$$;

drop trigger if exists tasks_keep_owner on public.tasks;
create trigger tasks_keep_owner before update on public.tasks
    for each row execute function public.keep_task_owner();

-- --------------------------------- 4. only participants record completions
drop policy if exists shared_completions_write on public.shared_completions;
create policy shared_completions_write on public.shared_completions for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and (public.can_view_habit(item_id) or public.can_view_task(item_id))
    );

drop policy if exists shared_completions_update on public.shared_completions;
create policy shared_completions_update on public.shared_completions for update to authenticated
    using (user_id = (select auth.uid()))
    with check (
        user_id = (select auth.uid())
        and (public.can_view_habit(item_id) or public.can_view_task(item_id))
    );

-- ----------------------------------------------------------- 5. live updates
do $$
declare
    t text;
begin
    foreach t in array array['notifications', 'shared_completions'] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

-- ------------------------------------------------- 6. duplicates and indexes
-- Unique constraints that exist twice under two names.
alter table public.friend_requests drop constraint if exists friend_requests_from_to_unique;
alter table public.friendships drop constraint if exists friendships_user_friend_unique;
alter table public.shared_goals drop constraint if exists shared_goals_goal_user_unique;
alter table public.shared_habits drop constraint if exists shared_habits_habit_user_unique;

-- Indexes that repeat another index, or the leading column of a unique key.
drop index if exists public.idx_friend_requests_from;          -- unique (from_user_id, to_user_id)
drop index if exists public.friend_requests_to_idx;            -- idx_friend_requests_to
drop index if exists public.idx_friend_requests_deleted;
drop index if exists public.idx_friendships_user;              -- unique (user_id, friend_id)
drop index if exists public.friendships_user_idx;
drop index if exists public.friendships_friend_idx;            -- idx_friendships_friend
drop index if exists public.idx_friendships_deleted;
drop index if exists public.idx_completions_user_date;         -- habit_completions_user_date_idx
drop index if exists public.idx_completions_updated;           -- replaced below
drop index if exists public.idx_habits_updated;                -- replaced below
drop index if exists public.idx_habits_sync_updated;           -- partial, so the sync could not use it
drop index if exists public.habits_user_id_idx;                -- idx_habits_user_deleted
drop index if exists public.idx_notifications_user;            -- replaced below
drop index if exists public.notifications_user_idx;
drop index if exists public.idx_notifications_deleted;
drop index if exists public.idx_shared_goals_shared_with;      -- shared_goals_with_idx
drop index if exists public.idx_shared_goals_status;
drop index if exists public.idx_shared_goals_deleted;
drop index if exists public.idx_shared_habits_habit_id;        -- unique (habit_id, shared_with_id)
drop index if exists public.idx_shared_habits_owner_id;        -- idx_shared_habits_owner
drop index if exists public.idx_shared_habits_shared_with;     -- shared_habits_with_idx
drop index if exists public.idx_shared_habits_shared_with_id;
drop index if exists public.idx_shared_habits_status;
drop index if exists public.idx_shared_habits_deleted;

-- What the sync and the inbox actually ask for. The sync reads by owner and
-- "changed since", deleted rows included, so these are not partial.
create index if not exists habits_user_updated_idx on public.habits (user_id, updated_at);
create index if not exists habit_completions_user_updated_idx on public.habit_completions (user_id, updated_at);
create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists shared_tasks_owner_idx on public.shared_tasks (owner_id);

notify pgrst, 'reload schema';
