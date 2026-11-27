-- Replaces 20261126000200 (Postgres Changes: these tables in the supabase_realtime publication), which is what ran on
-- the server; the apps listen for Broadcast signals, so until this runs no change signal reaches them.
--
-- A change on one device reaches the account's other devices within a second or two, cheaply enough for
-- millions of accounts. The way Notion does it: the server sends a tiny "something changed" signal on a private
-- per-account channel, and each device then fetches only what changed since its last sync.
--
-- Why Broadcast and not Postgres Changes: Postgres Changes checks every change against every listener's row
-- security, one by one, in a single process; Supabase's own guidance is that it does not scale to large audiences.
-- Here a statement-level trigger sends one small message per statement (a bulk edit of 300 rows is one message)
-- to the topic `sync:<user id>`, and only that account's devices may listen to it (policy below).
--
-- The message carries no data: only which table changed. Devices then pull their deltas with the keyset reads the
-- (user_id, updated_at) indexes already serve.
--
-- Idempotent.

-- Who may hear a signal: only the account it belongs to.
alter table realtime.messages enable row level security;
drop policy if exists sync_signal_owner on realtime.messages;
create policy sync_signal_owner on realtime.messages for select to authenticated
    using (realtime.messages.extension = 'broadcast' and realtime.topic() = 'sync:' || (select auth.uid())::text);

-- One signal per statement and per account touched by it.
create or replace function public.signal_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
    for uid in select distinct user_id from changed_rows where user_id is not null loop
        perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'sync:' || uid::text, true);
    end loop;
    return null;
end $$;
revoke all on function public.signal_sync() from public, anon, authenticated;

-- On every table the apps sync. Transition tables allow one event per trigger, so inserts and updates each have
-- one (deletes are soft: an update setting deleted_at).
do $$
declare t text;
begin
    foreach t in array array['habits', 'tasks', 'habit_completions', 'day_inputs'] loop
        if to_regclass('public.' || t) is null then continue; end if;
        execute format('drop trigger if exists signal_sync_insert on public.%I', t);
        execute format('create trigger signal_sync_insert after insert on public.%I referencing new table as changed_rows for each statement execute function public.signal_sync()', t);
        execute format('drop trigger if exists signal_sync_update on public.%I', t);
        execute format('create trigger signal_sync_update after update on public.%I referencing new table as changed_rows for each statement execute function public.signal_sync()', t);
        -- Postgres Changes is not used for these: take them out of that publication if an earlier migration added them.
        if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
            execute format('alter publication supabase_realtime drop table public.%I', t);
        end if;
    end loop;
end $$;
