-- A friend's whole day, not only their habits.
--
-- The feed could say "2 of 5 done" because `friend_stats` counts habit
-- completions. It could say nothing at all about tasks or goals, which is most
-- of what a day in this app actually is — so a card meant to show somebody's
-- progress was showing a third of it.
--
-- Goals are reported as *moved*, not as a percentage. A goal's progress is
-- worked out in the client from weights, sub-habits and task history
-- (`lib/goalInsights.ts`); reproducing that in SQL would give two answers to
-- one question and the server's would be the wrong one. "2 goals moved today"
-- is also the better social line: a percentage barely changes in a day, and a
-- feed that never changes is a feed nobody opens.
--
-- It also makes the sharing switches real at the source. A person who turns
-- progress off gets zeros here, rather than being hidden by an interface that
-- might be older than the switch. Hiding something in the client while the
-- server still hands it over is not privacy, it is decoration.
--
-- Same body as 20260930_friend_stats_display_name with four columns added, and
-- recreated rather than replaced because a function's return type cannot grow.
--
-- Applied 2026-09-30.
--   node scripts/apply-migration.mjs supabase/migrations/20260930_friend_stats_day.sql

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
    display_name text,
    tasks_done integer,
    tasks_total integer,
    goals_active integer,
    goals_moved integer
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
    -- Your own numbers are always your own. A switch governs what other people
    -- are shown, never what you can see of yourself.
    shown as (
        select v.id,
               (v.id = (select auth.uid())
                or coalesce((pr.sharing ->> 'progress')::boolean, true)) as progress
        from visible v
        join public.profiles pr on pr.id = v.id
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
        case when s.progress then coalesce((select d.done from days d where d.user_id = p.id and d.date = p_today), 0) else 0 end,
        case when s.progress then (select count(*)::integer from public.habits h
          where h.user_id = p.id and not h.is_goal and not h.is_archived and h.deleted_at is null) else 0 end,
        case when s.progress then
            array(select coalesce((select d.done from days d where d.user_id = p.id and d.date = p_today - g), 0)
                  from generate_series(6, 0, -1) as g)
            else array[0,0,0,0,0,0,0] end,
        -- Consecutive days with something logged, counting back from today, or
        -- from yesterday if today is not logged yet: an open day is not a break.
        case when s.progress then (select count(*)::integer from (
            select d.date, row_number() over (order by d.date desc) as n
            from days d
            where d.user_id = p.id
              and d.date <= p_today
        ) run
        where run.date = (case when exists (select 1 from days t where t.user_id = p.id and t.date = p_today)
                               then p_today else p_today - 1 end) - (run.n - 1)::integer)
            else 0 end,
        -- Same predicate as `days`, so this array is exactly as long as today_done.
        case when s.progress then
            array(select coalesce(c.evidence, 'self')
                  from public.habit_completions c
                  where c.user_id = p.id
                    and c.date = p_today
                    and c.deleted_at is null
                    and c.completed is not false)
            else array[]::text[] end,
        pr.display_name,
        -- Today's tasks: what was finished, and what the day asked for. A
        -- cancelled task is not a failure, so it is in neither number.
        case when s.progress then (select count(*)::integer from public.tasks t
          where t.user_id = p.id and t.deleted_at is null
            and t.due_date = p_today and t.status = 'done') else 0 end,
        case when s.progress then (select count(*)::integer from public.tasks t
          where t.user_id = p.id and t.deleted_at is null
            and t.due_date = p_today and t.status <> 'cancelled') else 0 end,
        case when s.progress then (select count(*)::integer from public.habits g
          where g.user_id = p.id and g.is_goal and not g.is_archived and g.deleted_at is null) else 0 end,
        -- A goal moved if anything under it happened today: one of its habits
        -- ticked, or one of its tasks finished.
        case when s.progress then (select count(*)::integer from public.habits g
          where g.user_id = p.id and g.is_goal and not g.is_archived and g.deleted_at is null
            and (exists (
                    select 1 from public.habit_completions c
                    join public.habits h on h.id = c.habit_id
                    where c.user_id = p.id and c.date = p_today
                      and c.deleted_at is null and c.completed is not false
                      and h.goal_id = g.id)
              or exists (
                    select 1 from public.tasks t
                    where t.user_id = p.id and t.goal_id = g.id
                      and t.deleted_at is null and t.status = 'done'
                      and t.completed_at >= p_today::timestamptz
                      and t.completed_at < (p_today + 1)::timestamptz))) else 0 end
    from visible p
    join public.profiles pr on pr.id = p.id
    join shown s on s.id = p.id
    where (select auth.uid()) is not null;
$function$;

notify pgrst, 'reload schema';
