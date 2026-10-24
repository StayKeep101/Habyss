-- Friendships and shares only come from a "yes".
--
-- Until now the policies checked who was writing but not whether the other
-- person had agreed:
--   * any signed-in user could insert a friendship with any user id, and every
--     friend-only view (stats, today's tasks, the feed, presence, pushes)
--     trusts friendships;
--   * the sender of a friend request could mark their own request accepted;
--   * a task could be "shared" by someone who does not own it, and a share row
--     could be pointed at somebody else's habit or goal afterwards.
--
-- After this:
--   * a friendship row needs an accepted request from the friend to the writer
--     (the app writes it as the one who accepted);
--   * only the person a request (or share) is addressed to can accept it;
--   * who and what a request or share is about never changes after it is made;
--   * sharing a task needs owning it;
--   * friendships are never updated, only made and removed.
-- Also drops leftovers nothing calls any more.

-- Friendships ------------------------------------------------------------

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and friend_id <> user_id
        and not public.blocked_between(user_id, friend_id)
        and exists (
            select 1 from public.friend_requests r
            where r.from_user_id = friend_id
              and r.to_user_id = user_id
              and r.status = 'accepted'
              and r.deleted_at is null
        )
    );

drop policy if exists friendships_update on public.friendships;

-- Requests and shares: fixed parties, accepted only by the one asked -------

create or replace function public.keep_request_parties()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' and (new.from_user_id <> old.from_user_id or new.to_user_id <> old.to_user_id) then
        raise exception 'a friend request cannot change who it is between';
    end if;
    if new.status = 'accepted'
       and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
       and (select auth.uid()) is not null
       and (select auth.uid()) <> new.to_user_id then
        raise exception 'only the person asked can accept a friend request';
    end if;
    return new;
end;
$$;

drop trigger if exists keep_request_parties on public.friend_requests;
create trigger keep_request_parties
    before insert or update on public.friend_requests
    for each row execute function public.keep_request_parties();

create or replace function public.keep_share_parties()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    item_column text := tg_argv[0];
begin
    if tg_op = 'UPDATE' and (
        new.owner_id <> old.owner_id
        or new.shared_with_id <> old.shared_with_id
        or to_jsonb(new) ->> item_column is distinct from to_jsonb(old) ->> item_column
    ) then
        raise exception 'a share cannot change who or what it is about';
    end if;
    if new.status = 'accepted'
       and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
       and (select auth.uid()) is not null
       and (select auth.uid()) <> new.shared_with_id then
        raise exception 'only the person it is shared with can accept a share';
    end if;
    return new;
end;
$$;

drop trigger if exists keep_share_parties on public.shared_habits;
create trigger keep_share_parties
    before insert or update on public.shared_habits
    for each row execute function public.keep_share_parties('habit_id');

drop trigger if exists keep_share_parties on public.shared_goals;
create trigger keep_share_parties
    before insert or update on public.shared_goals
    for each row execute function public.keep_share_parties('goal_id');

drop trigger if exists keep_share_parties on public.shared_tasks;
create trigger keep_share_parties
    before insert or update on public.shared_tasks
    for each row execute function public.keep_share_parties('task_id');

-- Sharing a task needs owning it, the same as habits and goals ------------

create or replace function public.owns_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.tasks
        where id = p_task_id and user_id = (select auth.uid())
    );
$$;
revoke execute on function public.owns_task(uuid) from public, anon;
grant execute on function public.owns_task(uuid) to authenticated;

drop policy if exists shared_tasks_write on public.shared_tasks;
create policy shared_tasks_write on public.shared_tasks
    for insert to authenticated
    with check (owner_id = (select auth.uid()) and public.owns_task(task_id));

-- Leftovers --------------------------------------------------------------

-- Linked any two users / searched profiles by code and returned emails; both
-- callable without signing in. Gone from the live project already; dropped
-- here too so a database rebuilt from these files never has them.
drop function if exists public.create_friendship(uuid, uuid);
drop function if exists public.search_profiles_by_code(text);

-- Embers and pacts were retired from the app, but their functions were still
-- callable by anyone, signed in or not: claim_day paid out for any past date
-- and ember_balance read anybody's. Nobody may call them now (they stay, so
-- the old rows keep their meaning).
do $$
declare f regprocedure;
begin
    for f in
        select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('ember_balance', 'claim_day', 'claim_opening', 'accept_pact', 'cancel_pact', 'settle_due_pacts')
    loop
        execute format('revoke execute on function %s from public, anon, authenticated', f);
    end loop;
end $$;
