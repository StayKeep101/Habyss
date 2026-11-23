-- Emoji on each card of a friend's day.
--
-- A day card opens into a deck: the cover, a card for each thing done, the
-- last card (what did not get done, and their note). Friends can put an emoji
-- on any one card, as on a post (one each per card, changed or taken back
-- any time). Everyone who can see the day sees the counts; the owner hears
-- about it.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261122000300_card_reactions.sql

create table if not exists public.card_reactions (
    post_user   uuid not null references auth.users(id) on delete cascade,
    post_day    date not null,
    card_key    text not null check (length(card_key) between 1 and 200),
    from_user   uuid not null references auth.users(id) on delete cascade,
    emoji       text not null check (length(emoji) between 1 and 16),
    created_at  timestamptz not null default now(),
    primary key (post_user, post_day, card_key, from_user)
);
create index if not exists card_reactions_post on public.card_reactions (post_user, post_day);

alter table public.card_reactions enable row level security;
drop policy if exists card_reactions_read on public.card_reactions;
create policy card_reactions_read on public.card_reactions for select to authenticated
    using (post_user = (select auth.uid()) or from_user = (select auth.uid()) or public.are_friends(post_user));
revoke insert, update, delete on public.card_reactions from authenticated, anon;
grant select on public.card_reactions to authenticated;

-- Puts your emoji on one card of a day (or takes it back: null).
create or replace function public.react_card(p_user uuid, p_day date, p_card text, p_emoji text)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    who text;
begin
    if me is null then raise exception 'Sign in to react.'; end if;
    if p_user <> me and (not public.are_friends(p_user) or public.blocked_between(me, p_user)) then raise exception 'Only friends can react.'; end if;
    if p_emoji is null or btrim(p_emoji) = '' then
        delete from public.card_reactions where post_user = p_user and post_day = p_day and card_key = p_card and from_user = me;
        return;
    end if;
    insert into public.card_reactions (post_user, post_day, card_key, from_user, emoji)
        values (p_user, p_day, left(p_card, 200), me, left(btrim(p_emoji), 16))
        on conflict (post_user, post_day, card_key, from_user) do update set emoji = excluded.emoji, created_at = now();
    if p_user <> me then
        select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into who from public.profiles where id = me;
        insert into public.notifications (user_id, from_user_id, type, title, body)
            values (p_user, me, 'reaction', who || ' reacted ' || btrim(p_emoji), 'On a card of your day');
    end if;
end;
$$;
revoke all on function public.react_card(uuid, date, text, text) from public, anon;
grant execute on function public.react_card(uuid, date, text, text) to authenticated;

-- Every card's emoji on one day: how many of each, and yours.
create or replace function public.card_reactions_for(p_user uuid, p_day date)
returns table (card_key text, emoji text, total int, mine boolean)
language sql stable security definer set search_path to ''
as $$
    select r.card_key, r.emoji, count(*)::int, bool_or(r.from_user = (select auth.uid()))
      from public.card_reactions r
     where r.post_user = p_user and r.post_day = p_day
       and (p_user = (select auth.uid()) or (public.are_friends(p_user) and not public.blocked_between((select auth.uid()), p_user)))
     group by r.card_key, r.emoji;
$$;
revoke all on function public.card_reactions_for(uuid, date) from public, anon;
grant execute on function public.card_reactions_for(uuid, date) to authenticated;

notify pgrst, 'reload schema';
