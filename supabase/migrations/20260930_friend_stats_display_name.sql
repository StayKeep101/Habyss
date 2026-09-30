-- A friend's chosen name, carried with their day.
--
-- Same body as 20260928_friend_stats_blocks, with `display_name` added to the
-- row. Recreated rather than replaced, because `create or replace` cannot add a
-- column to a function's return type; the argument list is unchanged, so an
-- older build simply ignores the new column.
--
-- Applied 2026-09-30.
--   node scripts/apply-migration.mjs supabase/migrations/20260930_friend_stats_display_name.sql

drop function if exists public.friend_stats(date);

create function public.friend_stats(p_today date)
returns table (
    user_id uuid,
    username text,
    avatar_url text,
    today_done integer,
    active_habits integer,
    week_done integer[],
    current_streak integer,
    today_evidence text[],
    display_name text
)
language sql
stable
security definer
set search_path to ''
as $function$
    with people as (
        select (select auth.uid()) as id
        union
        select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end
        from public.friendships f
        where f.deleted_at is null
          and (f.user_id = (select auth.uid()) or f.friend_id = (select auth.uid()))
    ),
    visible as (
        -- Blocked either way: gone from the feed, whatever the friendship says.
        select p.id from people p
        where p.id = (select auth.uid())
           or not exists (
               select 1 from public.user_blocks b
               where (b.blocker = (select auth.uid()) and b.blocked = p.id)
                  or (b.blocker = p.id and b.blocked = (select auth.uid()))
           )
    ),
    days as (
        select c.user_id, c.date, count(*)::integer as done
        from public.habit_completions c
        join visible p on p.id = c.user_id
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
                               then p_today else p_today - 1 end) - (run.n - 1)::integer),
        -- Same predicate as `days`, so this array is exactly as long as today_done.
        array(select coalesce(c.evidence, 'self')
              from public.habit_completions c
              where c.user_id = p.id
                and c.date = p_today
                and c.deleted_at is null
                and c.completed is not false),
        pr.display_name
    from visible p
    join public.profiles pr on pr.id = p.id
    where (select auth.uid()) is not null;
$function$;

notify pgrst, 'reload schema';
