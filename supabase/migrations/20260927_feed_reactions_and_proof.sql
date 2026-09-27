-- The community feed: reactions, comments, and how a completion was evidenced.
--
-- NOT APPLIED. Written so it can be reviewed before it touches a live database.
-- Apply with:
--   node scripts/apply-migration.mjs supabase/migrations/20260927_feed_reactions_and_proof.sql
--
-- Until it is applied the feed still works — it is built from the day numbers
-- friend_stats already returns — but reactions live only on the device that
-- made them, and every completion reads as self-logged.

-- ---------------------------------------------------------------- reactions
-- One reaction per person per day per friend. Re-reacting replaces, so the
-- primary key is the identity of the act rather than a generated id.
create table if not exists public.feed_reactions (
    from_user   uuid not null references auth.users (id) on delete cascade,
    to_user     uuid not null references auth.users (id) on delete cascade,
    day         date not null,
    reaction    text not null check (reaction in ('fire', 'clap', 'heart', 'star', 'muscle')),
    created_at  timestamptz not null default now(),
    primary key (from_user, to_user, day)
);

create index if not exists idx_feed_reactions_to on public.feed_reactions (to_user, day);

alter table public.feed_reactions enable row level security;

-- You may react as yourself, and read reactions that are yours or aimed at you.
-- Reading another pair's reactions is nobody's business.
drop policy if exists feed_reactions_read on public.feed_reactions;
create policy feed_reactions_read on public.feed_reactions
    for select to authenticated
    using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists feed_reactions_write on public.feed_reactions;
create policy feed_reactions_write on public.feed_reactions
    for insert to authenticated
    with check (auth.uid() = from_user);

drop policy if exists feed_reactions_update on public.feed_reactions;
create policy feed_reactions_update on public.feed_reactions
    for update to authenticated
    using (auth.uid() = from_user) with check (auth.uid() = from_user);

drop policy if exists feed_reactions_delete on public.feed_reactions;
create policy feed_reactions_delete on public.feed_reactions
    for delete to authenticated
    using (auth.uid() = from_user);

-- ----------------------------------------------------------------- comments
create table if not exists public.feed_comments (
    id          uuid primary key default gen_random_uuid(),
    author      uuid not null references auth.users (id) on delete cascade,
    to_user     uuid not null references auth.users (id) on delete cascade,
    day         date not null,
    body        text not null check (char_length(btrim(body)) between 1 and 500),
    created_at  timestamptz not null default now()
);

create index if not exists idx_feed_comments_day on public.feed_comments (to_user, day, created_at);

alter table public.feed_comments enable row level security;

drop policy if exists feed_comments_read on public.feed_comments;
create policy feed_comments_read on public.feed_comments
    for select to authenticated
    using (auth.uid() = author or auth.uid() = to_user);

drop policy if exists feed_comments_write on public.feed_comments;
create policy feed_comments_write on public.feed_comments
    for insert to authenticated
    with check (auth.uid() = author);

-- Editing someone else's words is not a thing anyone should be able to do;
-- deleting your own is.
drop policy if exists feed_comments_delete on public.feed_comments;
create policy feed_comments_delete on public.feed_comments
    for delete to authenticated
    using (auth.uid() = author);

-- ------------------------------------------------------------ shared tasks
-- Habits and goals could already be shared; tasks could not. Same shape as
-- shared_habits so the participant query does not have to special-case them.
create table if not exists public.shared_tasks (
    id              uuid primary key default gen_random_uuid(),
    task_id         text not null,
    owner_id        uuid not null references auth.users (id) on delete cascade,
    shared_with_id  uuid not null references auth.users (id) on delete cascade,
    status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
    created_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    unique (task_id, shared_with_id)
);

create index if not exists idx_shared_tasks_with on public.shared_tasks (shared_with_id, status);

alter table public.shared_tasks enable row level security;

-- Only the two people on a share can see it, and only the owner creates one.
drop policy if exists shared_tasks_read on public.shared_tasks;
create policy shared_tasks_read on public.shared_tasks
    for select to authenticated
    using (auth.uid() = owner_id or auth.uid() = shared_with_id);

drop policy if exists shared_tasks_write on public.shared_tasks;
create policy shared_tasks_write on public.shared_tasks
    for insert to authenticated
    with check (auth.uid() = owner_id);

-- The owner can withdraw it; the person it was shared with can accept or
-- decline. Both are updates, so the policy admits either side.
drop policy if exists shared_tasks_update on public.shared_tasks;
create policy shared_tasks_update on public.shared_tasks
    for update to authenticated
    using (auth.uid() = owner_id or auth.uid() = shared_with_id)
    with check (auth.uid() = owner_id or auth.uid() = shared_with_id);

-- ------------------------------------------------------- per-item completion
-- What the "done by everyone" rule actually needs: who finished which shared
-- item, on which day. friend_stats only answers "did they do anything today",
-- which is why the rule currently runs on an approximation.
create table if not exists public.shared_completions (
    user_id     uuid not null references auth.users (id) on delete cascade,
    item_id     text not null,
    item_type   text not null check (item_type in ('habit', 'task', 'goal')),
    day         date not null,
    evidence    text check (evidence is null or evidence in ('verified', 'context', 'self')),
    created_at  timestamptz not null default now(),
    primary key (user_id, item_id, day)
);

create index if not exists idx_shared_completions_item on public.shared_completions (item_id, day);

alter table public.shared_completions enable row level security;

-- Readable by anyone sharing the item, which is what makes "waiting on Sam"
-- possible without exposing anything else about Sam's day.
drop policy if exists shared_completions_read on public.shared_completions;
create policy shared_completions_read on public.shared_completions
    for select to authenticated
    using (
        auth.uid() = user_id
        or exists (
            select 1 from public.shared_habits s
            where s.habit_id = item_id and s.status = 'accepted' and s.deleted_at is null
              and (auth.uid() = s.owner_id or auth.uid() = s.shared_with_id)
        )
        or exists (
            select 1 from public.shared_tasks s
            where s.task_id = item_id and s.status = 'accepted' and s.deleted_at is null
              and (auth.uid() = s.owner_id or auth.uid() = s.shared_with_id)
        )
    );

drop policy if exists shared_completions_write on public.shared_completions;
create policy shared_completions_write on public.shared_completions
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists shared_completions_delete on public.shared_completions;
create policy shared_completions_delete on public.shared_completions
    for delete to authenticated using (auth.uid() = user_id);

-- -------------------------------------------------------------------- proof
-- How a completion was evidenced, so the feed can tell a recorded run from a
-- ticked box. Nullable: every row written before this existed is self-logged,
-- which is the honest reading of a tick nobody checked.
--
-- Three values only. A friend vouching for you was considered and dropped: it
-- turns a habit app into a place where people ask each other for favours, and
-- Health and the timer are worth more than a vouch anyway.
--   verified — the habit reads a Health metric and the value came from there
--   context  — a focus session ran against it that day
--   self     — ticked off, on the person's word
alter table public.habit_completions
    add column if not exists evidence text
    check (evidence is null or evidence in ('verified', 'context', 'self'));

notify pgrst, 'reload schema';
