-- Brain dump in the account, so AI assistants (the mcp function) and a new
-- phone can reach it. Owner only: never shared, never seen by a friend.
-- Ids are text: the phone makes its own ("<ms>-<random>"), the server UUIDs.

create table if not exists public.brain_dump (
    id text not null check (char_length(id) between 1 and 64),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    text text not null check (char_length(text) between 1 and 5000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, id)
);

create index if not exists brain_dump_user_updated_idx on public.brain_dump (user_id, updated_at);
create index if not exists brain_dump_user_created_idx on public.brain_dump (user_id, created_at desc) where deleted_at is null;

alter table public.brain_dump enable row level security;

drop policy if exists brain_dump_owner on public.brain_dump;
create policy brain_dump_owner on public.brain_dump for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sync resolves by updated_at, so the database keeps it.
drop trigger if exists set_updated_at on public.brain_dump;
create trigger set_updated_at before update on public.brain_dump
    for each row execute function public.set_updated_at();
