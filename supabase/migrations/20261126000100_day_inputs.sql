-- The day's settings, one row per setting, so the phone and the desktop build
-- the same day: the waking window, meals, each travel time, and each day's
-- memory, calendar slots, early ends and reschedules. One row per key means two
-- devices changing different settings never overwrite each other; the same key
-- changed on both keeps the later write (the server stamps updated_at).
--
-- Keys: day_window, meals, meals_flexible, auto_reschedule, peak,
-- travel:<travel key>, and dated day_memory:/events:/ended:/reschedule:<YYYY-MM-DD>.
-- Owner only: never shared, never seen by a friend.

create table if not exists public.day_inputs (
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    key text not null check (key ~ '^[a-z_]+(:.+)?$' and char_length(key) <= 200),
    value jsonb not null check (octet_length(value::text) <= 262144),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, key)
);

create index if not exists day_inputs_user_updated_idx on public.day_inputs (user_id, updated_at);

alter table public.day_inputs enable row level security;
revoke all on public.day_inputs from anon;
grant select, insert, update, delete on public.day_inputs to authenticated;

drop policy if exists day_inputs_owner on public.day_inputs;
create policy day_inputs_owner on public.day_inputs for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sync resolves by updated_at, so the database keeps it: server time on insert and on update.
drop trigger if exists stamp_server_time on public.day_inputs;
create trigger stamp_server_time before insert on public.day_inputs
    for each row execute function public.stamp_server_time();
drop trigger if exists set_updated_at on public.day_inputs;
create trigger set_updated_at before update on public.day_inputs
    for each row execute function public.set_updated_at();

-- The other device hears about a change within seconds.
do $$
begin
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'day_inputs') then
        alter publication supabase_realtime add table public.day_inputs;
    end if;
end $$;
