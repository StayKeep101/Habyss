-- Comments that send, and a clean slate every day.
--
-- 1. Writing a comment failed for everyone ("infinite recursion detected in
--    policy for relation feed_comments"): the write policy looked up the
--    parent comment in feed_comments itself. That check now lives in a
--    function with its own rights. It also compared the parent with itself
--    (p.id = p.parent_id), so no reply could ever pass; it now checks the
--    reply's own parent: on the same day, and a top-level comment.
--
-- 2. Each day is its own: when someone's next day card goes up, what was said
--    and given on their earlier days (comments, their reactions, reactions to
--    the card) is cleared. The past cannot be changed; the feed looks forward.
--    The day cards themselves stay (profiles and duels read them).
--
--   node scripts/apply-migration.mjs

-- ------------------------------------------------------------- replies
create or replace function public.comment_parent_ok(p_parent uuid, p_to uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select p_parent is null or exists (
        select 1 from public.feed_comments parent
        where parent.id = p_parent and parent.to_user = p_to and parent.day = p_day and parent.parent_id is null
    );
$$;
revoke all on function public.comment_parent_ok(uuid, uuid, date) from public, anon;
grant execute on function public.comment_parent_ok(uuid, uuid, date) to authenticated;

drop policy if exists feed_comments_write on public.feed_comments;
create policy feed_comments_write on public.feed_comments
    for insert to authenticated
    with check (
        (select auth.uid()) = author
        and ((select auth.uid()) = to_user or public.are_friends(to_user))
        and not public.blocked_between((select auth.uid()), to_user)
        and public.comment_parent_ok(parent_id, to_user, day)
    );

-- ------------------------------------------------------ a fresh day
create or replace function public.clear_past_talk()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Comment reactions go with their comments (on delete cascade).
    delete from public.feed_comments where to_user = new.user_id and day < new.day;
    delete from public.post_acknowledgements where post_user = new.user_id and post_day < new.day;
    return new;
end;
$$;
revoke all on function public.clear_past_talk() from public, anon, authenticated;

drop trigger if exists day_cards_clear_past on public.day_cards;
create trigger day_cards_clear_past
    after insert on public.day_cards
    for each row execute function public.clear_past_talk();

-- What is already older than someone's latest card goes now.
delete from public.feed_comments c
where c.day < (select max(d.day) from public.day_cards d where d.user_id = c.to_user);
delete from public.post_acknowledgements a
where a.post_day < (select max(d.day) from public.day_cards d where d.user_id = a.post_user);
