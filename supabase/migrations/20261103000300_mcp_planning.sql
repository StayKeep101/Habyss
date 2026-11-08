-- One transaction for an assistant's entire plan. Only the authenticated edge
-- function (service role) may choose an owner; app clients cannot call this RPC.
create table public.mcp_plan_requests (
    user_id uuid not null references auth.users(id) on delete cascade,
    request_id uuid not null,
    input jsonb not null,
    result jsonb not null,
    created_at timestamptz not null default now(),
    primary key (user_id, request_id)
);
alter table public.mcp_plan_requests enable row level security;
revoke all on public.mcp_plan_requests from public, anon, authenticated;

create or replace function public.mcp_create_plan(p_user_id uuid, p_rows jsonb, p_request_id uuid default null, p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
    prior public.mcp_plan_requests;
    item jsonb;
    h public.habits;
    t public.tasks;
    m public.goal_milestones;
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
    if jsonb_array_length(p_rows->'habits') + jsonb_array_length(p_rows->'tasks') + jsonb_array_length(p_rows->'milestones') > 300 then
        raise exception 'A plan can contain at most 300 items';
    end if;
    -- Goals are inserted first. Every link is checked against this owner,
    -- including existing goals referenced by standalone habits/tasks.
    for item in select value from jsonb_array_elements(p_rows->'habits') order by (value->>'is_goal')::boolean desc loop
        h := jsonb_populate_record(null::public.habits, item);
        if h.goal_id is not null and not exists (
            select 1 from public.habits where id = h.goal_id and user_id = p_user_id and is_goal and deleted_at is null
        ) then raise exception 'Goal not found in your account'; end if;
        insert into public.habits (id, user_id, name, description, category, is_goal, goal_id, start_date, end_date, start_time, duration_minutes, task_days, goal_value, unit, tracking_method, is_archived, target_date, goal_spec)
        values (h.id, p_user_id, h.name, h.description, h.category, h.is_goal, h.goal_id, h.start_date, h.end_date, h.start_time, h.duration_minutes, h.task_days, h.goal_value, h.unit, h.tracking_method, false, h.target_date, h.goal_spec);
    end loop;
    for item in select value from jsonb_array_elements(p_rows->'milestones') loop
        m := jsonb_populate_record(null::public.goal_milestones, item);
        if not exists (select 1 from public.habits where id = m.goal_id and user_id = p_user_id and is_goal and deleted_at is null) then
            raise exception 'Goal not found in your account';
        end if;
        insert into public.goal_milestones (id, user_id, goal_id, title, due_date, position)
        values (m.id, p_user_id, m.goal_id, m.title, m.due_date, m.position);
    end loop;
    for item in select value from jsonb_array_elements(p_rows->'tasks') loop
        t := jsonb_populate_record(null::public.tasks, item);
        if t.goal_id is not null and not exists (
            select 1 from public.habits where id = t.goal_id and user_id = p_user_id and is_goal and deleted_at is null
        ) then raise exception 'Goal not found in your account'; end if;
        if t.milestone_id is not null and not exists (
            select 1 from public.goal_milestones where id::text = t.milestone_id and user_id = p_user_id and goal_id = t.goal_id and deleted_at is null
        ) then raise exception 'Milestone not found in this goal'; end if;
        insert into public.tasks (id, user_id, title, description, due_date, due_time, estimated_minutes, priority, goal_id, milestone_id, source, status, subtasks)
        values (t.id, p_user_id, t.title, t.description, t.due_date, t.due_time, t.estimated_minutes, t.priority, t.goal_id, t.milestone_id, 'mcp', 'open', t.subtasks);
    end loop;
    result := jsonb_build_object('habits', p_rows->'habits', 'tasks', p_rows->'tasks', 'milestones', p_rows->'milestones');
    if p_request_id is not null then
        insert into public.mcp_plan_requests (user_id, request_id, input, result) values (p_user_id, p_request_id, p_input, result);
    end if;
    return result;
end;
$$;
revoke all on function public.mcp_create_plan(uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_create_plan(uuid, jsonb, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';
