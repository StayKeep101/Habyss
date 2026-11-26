-- Goals are gone from Habyss, data included.
--
-- Goals were habits with is_goal set, linked from habits and tasks (goal_id,
-- milestone_id), with milestones (goal_milestones), sharing (shared_goals)
-- and bets on them (goal_markets, market_stakes). All of it goes. Habits and
-- tasks that were under a goal stay, on their own. Shards staked on a goal
-- whose bet was still open are refunded first, so nobody loses any.
--
-- Run once, as one transaction: either all of it happens or none of it.

begin;

-- ------------------------------------------------------------ refunds first
-- Stakes on bets still open come back, as a refund in the ledger.
do $$
begin
    if to_regclass('public.market_stakes') is not null and to_regclass('public.goal_markets') is not null then
        insert into public.shards_ledger (user_id, amount, reason)
        select s.user_id, s.amount, 'refund'
          from public.market_stakes s join public.goal_markets m on m.id = s.market_id
         where m.status = 'open';
    end if;
end $$;

-- ------------------------------------------- what stays, without goals in it
-- Seeing a habit: yours, or shared with you.
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
          )
    );
$$;

-- Seeing a task: yours, or shared with you.
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
          )
    );
$$;

-- The wallet: what is in play is races, bets on races and duels.
create or replace function public.my_wallet()
returns table (ledger int, in_play int, spendable int)
language sql stable security definer set search_path to ''
as $$
    select coalesce((select sum(amount) from public.shards_ledger where user_id = (select auth.uid())), 0)::int,
           (coalesce((select sum(d.stake) from public.duels d
                      where d.status = 'active' and (d.challenger_id = (select auth.uid()) or d.opponent_id = (select auth.uid()))), 0)
            + coalesce((select sum(d.stake) from public.duels d
                        where d.status = 'proposed' and d.challenger_id = (select auth.uid())), 0)
            + coalesce((select sum(r.stake) from public.races r where r.owner_id = (select auth.uid()) and r.status = 'open'), 0)
            + coalesce((select sum(b.amount) from public.race_bets b join public.races r on r.id = b.race_id
                        where b.user_id = (select auth.uid()) and r.status = 'open'), 0))::int,
           public.shards_spendable((select auth.uid()));
$$;

-- The ledger, each entry named by what it was for.
create or replace function public.my_ledger(p_limit int default 100)
returns table (amount int, reason text, created_at timestamptz, title text)
language sql stable security definer set search_path to ''
as $$
    select l.amount, l.reason, l.created_at,
           case when l.reason = 'unlock' then 'An hour of your apps'
                when l.reason = 'challenge' then coalesce((select c.title from public.challenge_runs r join public.challenge_catalog c on c.id = r.challenge_id where r.id = l.challenge_run_id), 'A challenge')
                when l.race_id is not null then coalesce((select ra.title from public.races ra where ra.id = l.race_id), 'Race the clock')
                when d.id is not null then 'Duel with ' || coalesce(nullif(btrim(f.display_name), ''), f.username, 'a friend')
           end
      from public.shards_ledger l
      left join public.duels d on d.id = l.duel_id
      left join public.profiles f on f.id = case when d.challenger_id = l.user_id then d.opponent_id else d.challenger_id end
     where l.user_id = (select auth.uid())
     order by l.created_at desc
     limit least(greatest(p_limit, 1), 500);
$$;

-- Friends' numbers, without goals.
drop function if exists public.friend_stats(date);
create function public.friend_stats(p_today date)
returns table (
    user_id uuid, username text, avatar_url text, today_done integer, active_habits integer,
    week_done integer[], current_streak integer, today_evidence text[], display_name text,
    tasks_done integer, tasks_total integer
)
language sql stable security definer set search_path to ''
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
        select p.id from people p
        where p.id = (select auth.uid()) or not public.blocked_between((select auth.uid()), p.id)
    ),
    shown as (
        -- Your own numbers are always yours; the switch governs what others see.
        select v.id, (v.id = (select auth.uid()) or coalesce((pr.sharing ->> 'progress')::boolean, true)) as progress
        from visible v join public.profiles pr on pr.id = v.id
    ),
    today as (
        select c.user_id, c.card from public.day_cards c
        join visible v on v.id = c.user_id
        where c.day = p_today
    ),
    latest as (
        -- A streak holds until the day after it was last kept has passed.
        select distinct on (c.user_id) c.user_id, c.day, c.card
        from public.day_cards c join visible v on v.id = c.user_id
        where c.day between p_today - 1 and p_today
        order by c.user_id, c.day desc
    )
    select
        p.id,
        pr.username,
        pr.avatar_url,
        case when s.progress then coalesce((t.card ->> 'habitsDone')::int, 0) else 0 end,
        case when s.progress then coalesce((t.card ->> 'habitsActive')::int, (l.card ->> 'habitsActive')::int, (t.card ->> 'habitsTotal')::int, 0) else 0 end,
        case when s.progress then array(
            select coalesce((select (c.card ->> 'habitsDone')::int from public.day_cards c
                             where c.user_id = p.id and c.day = p_today - g), 0)
            from generate_series(6, 0, -1) as g)
            else array[0,0,0,0,0,0,0] end,
        case when s.progress then coalesce((l.card ->> 'streak')::int, 0) else 0 end,
        array[]::text[],
        pr.display_name,
        case when s.progress then coalesce((t.card ->> 'tasksDone')::int, 0) else 0 end,
        case when s.progress then coalesce((t.card ->> 'tasksTotal')::int, 0) else 0 end
    from visible p
    join public.profiles pr on pr.id = p.id
    join shown s on s.id = p.id
    left join today t on t.user_id = p.id
    left join latest l on l.user_id = p.id
    where (select auth.uid()) is not null;
$function$;

-- An assistant's plan: habits and tasks only.
create or replace function public.mcp_create_plan(p_user_id uuid, p_rows jsonb, p_request_id uuid default null, p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
    prior public.mcp_plan_requests;
    item jsonb;
    h public.habits;
    t public.tasks;
    result jsonb;
begin
    if p_user_id is null then raise exception 'An owner is required'; end if;
    if p_request_id is not null then
        perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_request_id::text, 0));
        select * into prior from public.mcp_plan_requests where user_id = p_user_id and request_id = p_request_id;
        if found then
            if prior.input <> p_input then raise exception 'request_id was already used with different arguments'; end if;
            return prior.result;
        end if;
    end if;
    if jsonb_array_length(coalesce(p_rows->'habits', '[]')) + jsonb_array_length(coalesce(p_rows->'tasks', '[]')) > 300 then
        raise exception 'A plan can contain at most 300 items';
    end if;
    for item in select value from jsonb_array_elements(coalesce(p_rows->'habits', '[]')) loop
        h := jsonb_populate_record(null::public.habits, item);
        insert into public.habits (id, user_id, name, description, category, start_date, end_date, start_time, duration_minutes, task_days, goal_value, unit, tracking_method, is_archived)
        values (h.id, p_user_id, h.name, h.description, h.category, h.start_date, h.end_date, h.start_time, h.duration_minutes, h.task_days, h.goal_value, h.unit, h.tracking_method, false);
    end loop;
    for item in select value from jsonb_array_elements(coalesce(p_rows->'tasks', '[]')) loop
        t := jsonb_populate_record(null::public.tasks, item);
        insert into public.tasks (id, user_id, title, description, due_date, due_time, estimated_minutes, priority, source, status, subtasks)
        values (t.id, p_user_id, t.title, t.description, t.due_date, t.due_time, t.estimated_minutes, t.priority, 'mcp', 'open', t.subtasks);
    end loop;
    result := jsonb_build_object('habits', coalesce(p_rows->'habits', '[]'), 'tasks', coalesce(p_rows->'tasks', '[]'));
    if p_request_id is not null then
        insert into public.mcp_plan_requests (user_id, request_id, input, result) values (p_user_id, p_request_id, p_input, result);
    end if;
    return result;
end;
$$;
revoke all on function public.mcp_create_plan(uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_create_plan(uuid, jsonb, uuid, jsonb) to service_role;

-- Adding a task: your own, nothing about goals.
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
    with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------ what goes
-- Every function that only served goals: bets on them, and sharing them.
do $$
declare r record;
begin
    for r in select p.oid::regprocedure as sig from pg_proc p
             where p.pronamespace = 'public'::regnamespace
               and p.proname in ('market_feed', 'open_market', 'place_stake', 'pay_market', 'settle_market', 'settle_due_markets', 'on_goal')
    loop
        execute 'drop function ' || r.sig;
    end loop;
end $$;

-- Bets on goals.
alter table public.shards_ledger drop column if exists market_id;
drop table if exists public.market_stakes cascade;
drop table if exists public.goal_markets cascade;

-- Milestones and sharing.
drop table if exists public.goal_milestones cascade;
drop table if exists public.shared_goals cascade;

-- What was under a goal stays, on its own; the goals themselves go (their check-ins with them).
update public.tasks set goal_id = null, milestone_id = null where goal_id is not null or milestone_id is not null;
update public.habits set goal_id = null where goal_id is not null;
delete from public.habit_completions where habit_id in (select id from public.habits where is_goal);
-- Marked deleted rather than erased, so every phone's next sync sees it go
-- (a row that simply vanished would stay on a phone that already had it).
update public.habits set deleted_at = now(), updated_at = now() where is_goal and deleted_at is null;

alter table public.habits drop column if exists goal_id cascade;
alter table public.habits drop column if exists is_goal cascade;
alter table public.habits drop column if exists target_date cascade;
alter table public.habits drop column if exists goal_spec cascade;
alter table public.tasks drop column if exists goal_id cascade;
alter table public.tasks drop column if exists milestone_id cascade;
alter table public.profiles drop column if exists goals_completed;

-- Day cards no longer carry goal counts; notifications about shared goals go.
update public.day_cards set card = card - 'goalsActive' - 'goalsMoved' where card ? 'goalsActive' or card ? 'goalsMoved';
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'notifications' and column_name = 'type') then
        execute 'delete from public.notifications where type = ''shared_goal''';
    end if;
end $$;

commit;

notify pgrst, 'reload schema';
