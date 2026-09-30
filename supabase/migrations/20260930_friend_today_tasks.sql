-- The few things a friend actually has to get done today.
--
-- The card could say "1 of 2 tasks" and nothing about what they are, which is a
-- number with nothing in it to react to. Names are what make a feed worth
-- opening — "still has the dentist" is something you can say back to somebody;
-- "1 of 2" is not.
--
-- Names are a real privacy step, so they have their own switch rather than
-- riding on `progress`. Somebody may well be happy to show that their day is
-- going well without publishing their to-do list, and collapsing those two into
-- one setting is how an app ends up sharing more than anybody agreed to.
-- Default true, like the rest, and off means this returns nothing at all rather
-- than being hidden by an interface that could be older than the switch.
--
-- Five at most, and only today's. A friend's backlog is not the feed's business.
--
-- Applied 2026-09-30.
--   node scripts/apply-migration.mjs supabase/migrations/20260930_friend_today_tasks.sql

create or replace function public.friend_today_tasks(p_today date)
returns table (
    user_id uuid,
    task_id uuid,
    title text,
    done boolean,
    due_time text
)
language sql
stable
security definer
set search_path to ''
as $function$
    with people as (
        select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end as id
        from public.friendships f
        where f.deleted_at is null
          and (f.user_id = (select auth.uid()) or f.friend_id = (select auth.uid()))
        union
        select (select auth.uid())
    ),
    visible as (
        select p.id from people p
        where p.id = (select auth.uid())
           or not exists (
               select 1 from public.user_blocks b
               where (b.blocker = (select auth.uid()) and b.blocked = p.id)
                  or (b.blocker = p.id and b.blocked = (select auth.uid()))
           )
    ),
    allowed as (
        -- Your own list is always your own; a switch governs what other people
        -- are shown, never what you can see of yourself.
        select v.id from visible v
        join public.profiles pr on pr.id = v.id
        where v.id = (select auth.uid())
           or (coalesce((pr.sharing ->> 'progress')::boolean, true)
               and coalesce((pr.sharing ->> 'tasks')::boolean, true))
    ),
    ranked as (
        select t.user_id, t.id, t.title, t.status, t.due_time,
               row_number() over (
                   partition by t.user_id
                   -- Unfinished first, then by the time it is due, then oldest:
                   -- what is left is the part worth showing somebody.
                   order by (t.status = 'done'), t.due_time nulls last, t.created_at
               ) as n
        from public.tasks t
        join allowed a on a.id = t.user_id
        where t.deleted_at is null
          and t.due_date = p_today
          and t.status <> 'cancelled'
    )
    select r.user_id, r.id, r.title, r.status = 'done', r.due_time
    from ranked r
    where r.n <= 5
      and (select auth.uid()) is not null;
$function$;

notify pgrst, 'reload schema';
