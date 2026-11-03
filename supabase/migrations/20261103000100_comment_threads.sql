-- Comments under a friend's day become a conversation.
--
-- feed_comments existed (20260927000100) but only the writer and the card's
-- owner could read a comment, so it was a private note, and nothing in the
-- app drew them. Now a day's thread is read by everyone who can see the day
-- (its owner and the owner's friends), replies nest one level under a
-- comment, your own words can be edited, a card's owner can tidy their own
-- thread, and comments take a small set of emoji reactions. A blocked person
-- is neither heard nor shown. The owner, the person replied to and anyone
-- @mentioned get a notification (and so a push). Live: comments and their
-- reactions are on the realtime publication, which respects these policies.
--
-- Additive: no column or function the desktop app reads changes.
--
--   node scripts/apply-migration.mjs

-- ------------------------------------------------------------ the thread
alter table public.feed_comments add column if not exists parent_id uuid references public.feed_comments (id) on delete cascade;
alter table public.feed_comments add column if not exists edited_at timestamptz;
create index if not exists idx_feed_comments_parent on public.feed_comments (parent_id);

-- Whoever can see the day can read its thread: the owner and their friends.
-- Words from someone blocked either way are not shown.
drop policy if exists feed_comments_read on public.feed_comments;
create policy feed_comments_read on public.feed_comments
    for select to authenticated
    using (
        (select auth.uid()) = author
        or (((select auth.uid()) = to_user or public.are_friends(to_user))
            and not public.blocked_between((select auth.uid()), author))
    );

-- You write as yourself, on your own day or a friend's, never to someone
-- blocked; a reply belongs to the same day as what it answers, and is one
-- level deep (a reply to a reply hangs under the same comment).
drop policy if exists feed_comments_write on public.feed_comments;
create policy feed_comments_write on public.feed_comments
    for insert to authenticated
    with check (
        (select auth.uid()) = author
        and ((select auth.uid()) = to_user or public.are_friends(to_user))
        and not public.blocked_between((select auth.uid()), to_user)
        and (parent_id is null or exists (
            select 1 from public.feed_comments p
            where p.id = parent_id and p.to_user = feed_comments.to_user and p.day = feed_comments.day and p.parent_id is null
        ))
    );

-- Editing your own words, and only the words.
drop policy if exists feed_comments_edit on public.feed_comments;
create policy feed_comments_edit on public.feed_comments
    for update to authenticated
    using ((select auth.uid()) = author)
    with check ((select auth.uid()) = author);
revoke update on public.feed_comments from authenticated, anon;
grant update (body, edited_at) on public.feed_comments to authenticated;

-- Deleting: your own words, or anything on your own day.
drop policy if exists feed_comments_delete on public.feed_comments;
create policy feed_comments_delete on public.feed_comments
    for delete to authenticated
    using ((select auth.uid()) = author or (select auth.uid()) = to_user);

-- ------------------------------------------------------- comment reactions
create table if not exists public.feed_comment_reactions (
    comment_id  uuid not null references public.feed_comments (id) on delete cascade,
    user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    emoji       text not null check (emoji in ('🔥', '👏', '😂', '💪', '❤️', '👀')),
    created_at  timestamptz not null default now(),
    primary key (comment_id, user_id)
);
alter table public.feed_comment_reactions enable row level security;

-- Seen, and given, by whoever can see the comment (the comment's own policy decides).
drop policy if exists feed_comment_reactions_read on public.feed_comment_reactions;
create policy feed_comment_reactions_read on public.feed_comment_reactions
    for select to authenticated
    using (exists (select 1 from public.feed_comments c where c.id = comment_id));
drop policy if exists feed_comment_reactions_write on public.feed_comment_reactions;
create policy feed_comment_reactions_write on public.feed_comment_reactions
    for insert to authenticated
    with check ((select auth.uid()) = user_id and exists (select 1 from public.feed_comments c where c.id = comment_id));
drop policy if exists feed_comment_reactions_change on public.feed_comment_reactions;
create policy feed_comment_reactions_change on public.feed_comment_reactions
    for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists feed_comment_reactions_delete on public.feed_comment_reactions;
create policy feed_comment_reactions_delete on public.feed_comment_reactions
    for delete to authenticated
    using ((select auth.uid()) = user_id);
revoke all on public.feed_comment_reactions from anon;
grant select, insert, delete on public.feed_comment_reactions to authenticated;
grant update (emoji) on public.feed_comment_reactions to authenticated;

-- ------------------------------------------------------------ who hears it
-- The day's owner, the person replied to, and anyone @mentioned who can see
-- the day. Once each, never the writer. Failure never blocks the comment.
create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    who text;
    told uuid[] := array[new.author];
    target uuid;
    snippet text := left(new.body, 90);
begin
    select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into who from public.profiles where id = new.author;

    if new.parent_id is not null then
        select author into target from public.feed_comments where id = new.parent_id;
        if target is not null and not target = any (told) then
            insert into public.notifications (user_id, from_user_id, type, title, body)
            values (target, new.author, 'comment', who || ' replied to you', snippet);
            told := told || target;
        end if;
    end if;

    if not new.to_user = any (told) then
        insert into public.notifications (user_id, from_user_id, type, title, body)
        values (new.to_user, new.author, 'comment', who || ' commented on your day', snippet);
        told := told || new.to_user;
    end if;

    for target in
        select p.id from public.profiles p
        where lower(p.username) in (
            select lower(m[1]) from regexp_matches(new.body, '@([A-Za-z0-9_.]{2,30})', 'g') as m
        )
    loop
        continue when target = any (told);
        -- Only someone who can see the day: its owner or one of the owner's friends.
        continue when not (target = new.to_user or exists (
            select 1 from public.friendships f where f.deleted_at is null
              and ((f.user_id = target and f.friend_id = new.to_user) or (f.friend_id = target and f.user_id = new.to_user))));
        continue when public.blocked_between(target, new.author);
        insert into public.notifications (user_id, from_user_id, type, title, body)
        values (target, new.author, 'comment', who || ' mentioned you', snippet);
        told := told || target;
    end loop;
    return new;
exception when others then
    return new;
end;
$$;

drop trigger if exists feed_comments_notify on public.feed_comments;
create trigger feed_comments_notify
    after insert on public.feed_comments
    for each row execute function public.notify_comment();

-- ---------------------------------------------------------------- live
do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feed_comments') then
        alter publication supabase_realtime add table public.feed_comments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feed_comment_reactions') then
        alter publication supabase_realtime add table public.feed_comment_reactions;
    end if;
end $$;

notify pgrst, 'reload schema';
