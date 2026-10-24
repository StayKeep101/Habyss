-- What the timeline plans with, kept with the backup; the server's clock for
-- every synced row; and one backup row for what lives outside the tables.
--
-- 1. Urgency (habits; tasks already had priority), difficulty, whether a set
--    time may move, and a task's deadline were on the phone only, so a new
--    phone or a second device lost them.
-- 2. Downloads follow updated_at. An insert kept the time the phone sent, so a
--    phone with its clock ahead could push the shared cursor past changes made
--    elsewhere and they would never come down. Updates already took the
--    server's time; inserts do now too.
-- 3. personal_backups: one JSON document per account with the settings and
--    personal stores that are not tables (Echo's memory, focus totals, check-
--    ins, sleep, meals, the marks ledger, settings…), so signing out and back
--    in, or a new phone, brings them back. Only its owner can read or write it.

-- 1 -----------------------------------------------------------------------

alter table public.habits
    add column if not exists priority smallint check (priority between 0 and 4),
    add column if not exists difficulty smallint check (difficulty between 1 and 3),
    add column if not exists flexible boolean;

alter table public.tasks
    add column if not exists deadline date,
    add column if not exists difficulty smallint check (difficulty between 1 and 3),
    add column if not exists flexible boolean;

-- 2 -----------------------------------------------------------------------

create or replace function public.stamp_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists stamp_server_time on public.habits;
create trigger stamp_server_time before insert on public.habits
    for each row execute function public.stamp_server_time();
drop trigger if exists stamp_server_time on public.habit_completions;
create trigger stamp_server_time before insert on public.habit_completions
    for each row execute function public.stamp_server_time();
drop trigger if exists stamp_server_time on public.tasks;
create trigger stamp_server_time before insert on public.tasks
    for each row execute function public.stamp_server_time();

-- 3 -----------------------------------------------------------------------

create table if not exists public.personal_backups (
    user_id uuid primary key references auth.users (id) on delete cascade,
    data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 4000000),
    updated_at timestamptz not null default now()
);

alter table public.personal_backups enable row level security;
revoke all on public.personal_backups from anon;
grant select, insert, update, delete on public.personal_backups to authenticated;

drop policy if exists personal_backups_own on public.personal_backups;
create policy personal_backups_own on public.personal_backups
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

drop trigger if exists stamp_server_time on public.personal_backups;
create trigger stamp_server_time before insert or update on public.personal_backups
    for each row execute function public.stamp_server_time();
