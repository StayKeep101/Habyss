-- A shared goal is one plan with two people on it.
--
-- Until now a shared goal shared only its own row. Its habits were readable by
-- the friend (can_view_habit already looked at shared_goals) but nothing copied
-- them; its tasks were not readable at all (tasks_all was owner-only); and an
-- accepted copy could never be changed by the friend, because every update was
-- refused for not being theirs. So the "shared" goal froze on the friend's phone
-- the moment they said yes, and a cover photo or reminder the friend set never
-- reached the owner.
--
-- The rule now: everybody on a goal can see and edit the goal, every habit and
-- every task inside it, and whatever anybody on it adds to it. Ownership of a
-- row never moves — a trigger keeps user_id as it was — so leaving a goal or
-- deleting an account still takes only what is yours.
--
-- Completions stay per person. Editing what a habit *is* is shared; whether
-- you did it today is yours.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261005_shared_goal_sync.sql

-- ------------------------------------------------------------ who is on what

-- Whether you are on this goal: you own it, or you accepted it.
create or replace function public.on_goal(p_goal_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select p_goal_id is not null and (
        exists (select 1 from public.habits g
                where g.id = p_goal_id and g.user_id = (select auth.uid()))
        or exists (select 1 from public.shared_goals s
                   where s.goal_id = p_goal_id
                     and s.status = 'accepted' and s.deleted_at is null
                     and (s.shared_with_id = (select auth.uid()) or s.owner_id = (select auth.uid())))
    );
$$;

-- A habit is reachable by its owner, by anyone it was shared with, and by
-- anyone on the goal it is (or belongs to).
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
                    and s.status = 'accepted' and s.deleted_at is null
                    and (s.shared_with_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
              )
              or public.on_goal(h.id)
              or public.on_goal(h.goal_id)
          )
    );
$$;

create or replace function public.can_view_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.tasks t
        where t.id = p_task_id
          and (
              t.user_id = (select auth.uid())
              or exists (
                  select 1 from public.shared_tasks s
                  where s.task_id = t.id
                    and s.status = 'accepted' and s.deleted_at is null
                    and (s.shared_with_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
              )
              or public.on_goal(t.goal_id)
          )
    );
$$;

revoke all on function public.on_goal(uuid), public.can_view_task(uuid) from public, anon;
grant execute on function public.on_goal(uuid), public.can_view_task(uuid) to authenticated;

-- ------------------------------------------------------- ownership never moves

-- An upload from a friend's copy carries the friend's user_id. Whoever made the
-- row keeps it; the edit itself is kept.
create or replace function public.keep_row_owner()
returns trigger
language plpgsql set search_path = ''
as $$
begin
    new.user_id := old.user_id;
    return new;
end;
$$;

-- Anyone on a goal may edit and remove what is inside it, but only its owner
-- can delete the goal itself. Leaving is done on the share row. Its own
-- function, because tasks have no is_goal column to read.
create or replace function public.keep_habit_owner()
returns trigger
language plpgsql set search_path = ''
as $$
begin
    new.user_id := old.user_id;
    if old.is_goal and (select auth.uid()) is distinct from old.user_id then
        new.deleted_at := old.deleted_at;
    end if;
    return new;
end;
$$;

drop trigger if exists habits_keep_owner on public.habits;
create trigger habits_keep_owner before update on public.habits
    for each row execute function public.keep_habit_owner();

drop trigger if exists tasks_keep_owner on public.tasks;
create trigger tasks_keep_owner before update on public.tasks
    for each row execute function public.keep_row_owner();

-- ------------------------------------------------------------------- policies

drop policy if exists habits_update on public.habits;
create policy habits_update on public.habits for update to authenticated
    using (user_id = (select auth.uid()) or public.can_view_habit(id))
    with check (user_id = (select auth.uid()) or public.can_view_habit(id));

drop policy if exists tasks_all on public.tasks;
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
    using (user_id = (select auth.uid()) or public.can_view_task(id));
-- Adding a task to somebody's goal makes it yours, inside their goal.
create policy tasks_insert on public.tasks for insert to authenticated
    with check (user_id = (select auth.uid()) and (goal_id is null or public.on_goal(goal_id)));
create policy tasks_update on public.tasks for update to authenticated
    using (user_id = (select auth.uid()) or public.can_view_task(id))
    with check (user_id = (select auth.uid()) or public.can_view_task(id));
create policy tasks_delete on public.tasks for delete to authenticated
    using (user_id = (select auth.uid()));

-- ------------------------------------------------------------- task measures
-- "Call 25 leads" and "Study 2 hours" are tasks too: a count or a time to
-- reach, how far they have got, and which step of their goal they belong to.
alter table public.tasks add column if not exists measure text
    check (measure is null or measure in ('done', 'count', 'time'));
alter table public.tasks add column if not exists target numeric;
alter table public.tasks add column if not exists unit text;
alter table public.tasks add column if not exists amount numeric;
alter table public.tasks add column if not exists milestone_id text;

notify pgrst, 'reload schema';
