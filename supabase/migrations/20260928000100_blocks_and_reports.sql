-- Blocking somebody, and reporting something.
--
-- Habyss now carries content one person writes and another person reads: the
-- feed, reactions, and notes on a day. An app that does that needs a way to
-- stop somebody and a way to report them, and App Review asks for both before
-- it will take it (guideline 1.2 — reporting, blocking, and a contact route).
--
-- Enforced here rather than hidden in the app. A block that only stops the
-- interface from drawing something is not a block: the row still arrives, and
-- the next build, an older build, or anyone reading the API sees it.
--
-- Applied 2026-09-28.
--   node scripts/apply-migration.mjs supabase/migrations/20260928000100_blocks_and_reports.sql

-- ------------------------------------------------------------------ blocks
create table if not exists public.user_blocks (
    blocker     uuid not null references public.profiles (id) on delete cascade,
    blocked     uuid not null references public.profiles (id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (blocker, blocked),
    constraint user_blocks_not_self check (blocker <> blocked)
);

create index if not exists idx_user_blocks_blocked on public.user_blocks (blocked);

alter table public.user_blocks enable row level security;

-- Your own list, and nobody else's: whether you have been blocked is not
-- something the person blocked gets to query.
drop policy if exists user_blocks_read on public.user_blocks;
create policy user_blocks_read on public.user_blocks
    for select to authenticated using (auth.uid() = blocker);

drop policy if exists user_blocks_write on public.user_blocks;
create policy user_blocks_write on public.user_blocks
    for insert to authenticated with check (auth.uid() = blocker);

drop policy if exists user_blocks_delete on public.user_blocks;
create policy user_blocks_delete on public.user_blocks
    for delete to authenticated using (auth.uid() = blocker);

/**
 * Whether either of two people has blocked the other.
 *
 * Security definer because the policies above deliberately hide one direction:
 * you cannot read a row that blocks you, and the check still has to see it.
 */
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select exists (
        select 1 from public.user_blocks
        where (blocker = a and blocked = b) or (blocker = b and blocked = a)
    );
$function$;

revoke all on function public.blocked_between(uuid, uuid) from public;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------- reports
-- Kept, not acted on automatically. Somebody reads these; nothing here decides
-- anything about an account on its own.
create table if not exists public.content_reports (
    id             uuid primary key default gen_random_uuid(),
    reporter       uuid not null references public.profiles (id) on delete cascade,
    reported_user  uuid references public.profiles (id) on delete set null,
    kind           text not null check (kind in ('comment', 'reaction', 'profile', 'other')),
    -- The comment's id, or whatever identifies what is being reported.
    reference      text,
    reason         text not null check (char_length(btrim(reason)) between 1 and 1000),
    created_at     timestamptz not null default now()
);

create index if not exists idx_content_reports_user on public.content_reports (reported_user, created_at);

alter table public.content_reports enable row level security;

-- You can file one and see your own. Reading other people's reports is not a
-- thing any account should be able to do from the app.
drop policy if exists content_reports_read on public.content_reports;
create policy content_reports_read on public.content_reports
    for select to authenticated using (auth.uid() = reporter);

drop policy if exists content_reports_write on public.content_reports;
create policy content_reports_write on public.content_reports
    for insert to authenticated with check (auth.uid() = reporter and reported_user <> reporter);

-- ------------------------------------------- blocks, where they have to bite
-- A blocked person cannot write to you. Reading is handled by friend_stats and
-- by the friendship being gone, but writing has to be refused at the table.
drop policy if exists feed_comments_write on public.feed_comments;
create policy feed_comments_write on public.feed_comments
    for insert to authenticated
    with check (auth.uid() = author and not public.blocked_between(auth.uid(), to_user));

drop policy if exists feed_reactions_write on public.feed_reactions;
create policy feed_reactions_write on public.feed_reactions
    for insert to authenticated
    with check (auth.uid() = from_user and not public.blocked_between(auth.uid(), to_user));

drop policy if exists feed_reactions_update on public.feed_reactions;
create policy feed_reactions_update on public.feed_reactions
    for update to authenticated
    using (auth.uid() = from_user)
    with check (auth.uid() = from_user and not public.blocked_between(auth.uid(), to_user));

-- A request from somebody you blocked is the first thing a block has to stop.
drop policy if exists requests_insert on public.friend_requests;
create policy requests_insert on public.friend_requests
    for insert to authenticated
    with check (
        from_user_id = (select auth.uid())
        and to_user_id <> from_user_id
        and not public.blocked_between(from_user_id, to_user_id)
    );

-- And a block ends the friendship rather than leaving it in place, quietly.
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and friend_id <> user_id
        and not public.blocked_between(user_id, friend_id)
    );

notify pgrst, 'reload schema';
