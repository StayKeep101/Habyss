-- A goal's milestones: the checkpoints that keep it on track
-- ("Read 24 books by Dec 31": Book 1 by Nov 2, Book 2 by Nov 9, …).
-- They belong to a goal (a habits row with is_goal) and nothing else.
-- The owner writes them; anyone who can see the goal (a shared goal's
-- partner) can read them.

create table if not exists public.goal_milestones (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    goal_id uuid not null references public.habits (id) on delete cascade,
    title text not null check (char_length(title) between 1 and 200),
    due_date date,
    done_at timestamptz,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists goal_milestones_goal_idx on public.goal_milestones (goal_id);
create index if not exists goal_milestones_user_updated_idx on public.goal_milestones (user_id, updated_at);

alter table public.goal_milestones enable row level security;

drop policy if exists goal_milestones_select on public.goal_milestones;
create policy goal_milestones_select on public.goal_milestones for select to authenticated
    using (user_id = (select auth.uid()) or public.can_view_habit(goal_id));

drop policy if exists goal_milestones_insert on public.goal_milestones;
create policy goal_milestones_insert on public.goal_milestones for insert to authenticated
    with check (user_id = (select auth.uid()));

drop policy if exists goal_milestones_update on public.goal_milestones;
create policy goal_milestones_update on public.goal_milestones for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

drop policy if exists goal_milestones_delete on public.goal_milestones;
create policy goal_milestones_delete on public.goal_milestones for delete to authenticated
    using (user_id = (select auth.uid()));

-- The server's clock decides updated_at, as on the other synced tables
-- (public.stamp_server_time, from 20261024000200).
drop trigger if exists stamp_server_time on public.goal_milestones;
create trigger stamp_server_time before insert or update on public.goal_milestones
    for each row execute function public.stamp_server_time();

notify pgrst, 'reload schema';
