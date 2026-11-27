-- Habits, tasks and check-ins changed on one device reach the other within seconds.
--
-- Both apps listen for their own account's changes on these tables (the Mac in
-- src-tauri/src/cloud/realtime.rs, the phone in lib/cloudSync.ts), but only tables in
-- the supabase_realtime publication are broadcast, and these were not: a change made on
-- one device waited for the other's next timed sync. Row security still applies to what
-- each listener receives, so nobody hears another account's rows.
--
-- Idempotent: a table already published is left as it is.
do $$
declare t text;
begin
    foreach t in array array['habits', 'tasks', 'habit_completions'] loop
        if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;
