-- One request fetches what changed on every synced table, instead of one request per table.
--
-- A device sends where it got to on each table (`since`, the newest updated_at it has) and gets back, per table,
-- the rows changed since then, oldest first, up to `p_limit` each: exactly the first page each app used to ask
-- for table by table (lib/cloudPullPage.ts, src-tauri/src/cloud/client.rs pull_query). A table with a full page
-- may have more; the app pages through the rest of that one table as before, which after the first sync is rare.
--
-- security invoker: row security applies as it does to the apps' own reads, and `user_id = auth.uid()` keeps every
-- read on the (user_id, updated_at) index. Tables this server does not have yet are left out.
create or replace function public.sync_pull(p_since jsonb default '{}'::jsonb, p_limit int default 500)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    me uuid := auth.uid();
    lim int := least(greatest(coalesce(p_limit, 500), 1), 1000);
    t text;
    since timestamptz;
    rows jsonb;
    out jsonb := '{}'::jsonb;
begin
    if me is null then raise exception 'Sign in to sync' using errcode = '28000'; end if;
    foreach t in array array['habits', 'tasks', 'habit_completions', 'day_inputs'] loop
        if to_regclass('public.' || t) is null then continue; end if;
        since := nullif(p_since ->> t, '')::timestamptz;
        execute format(
            'select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at, %s), ''[]''::jsonb)
               from (select * from public.%I
                      where user_id = $1 and ($2 is null or updated_at >= $2)
                      order by updated_at, %s limit $3) r',
            case when t = 'day_inputs' then 'r.key' else 'r.id' end, t, case when t = 'day_inputs' then 'key' else 'id' end)
        into rows using me, since, lim;
        out := out || jsonb_build_object(t, rows);
    end loop;
    return out;
end $$;
revoke all on function public.sync_pull(jsonb, int) from public, anon;
grant execute on function public.sync_pull(jsonb, int) to authenticated;
