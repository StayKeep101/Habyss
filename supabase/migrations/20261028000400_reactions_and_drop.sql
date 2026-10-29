-- Community: reactions, and the evening drop.
--
-- 1. An acknowledgement is now a reaction: one of four, changed by tapping
--    another. The feed returns how many of each a card got, and yours.
-- 2. A reaction tells the card's owner (quietly while they focus, as every
--    friend push already is).
-- 3. The drop: when your day card is posted at your time, one push says it is
--    up and your crew's cards are open. Once a day, only if you have friends.
-- 4. A card is in the feed for the 24 hours after it is posted, one per person,
--    then it leaves (a profile still shows every day).
--
--   node scripts/apply-migration.mjs

-- ------------------------------------------------------------- 1. reactions
alter table public.post_acknowledgements add column if not exists reaction text not null default 'proud';
alter table public.post_acknowledgements drop constraint if exists post_acknowledgements_reaction_check;
alter table public.post_acknowledgements add constraint post_acknowledgements_reaction_check
    check (reaction in ('proud', 'fire', 'comeback', 'again'));

grant update (reaction) on public.post_acknowledgements to authenticated;
drop policy if exists post_acks_update on public.post_acknowledgements;
create policy post_acks_update on public.post_acknowledgements for update to authenticated
    using (from_user = (select auth.uid()))
    with check (from_user = (select auth.uid()));

-- The return type gains reactions, so the function is dropped first.
drop function if exists public.community_feed(timestamptz, int, uuid);
create function public.community_feed(p_before timestamptz default null, p_limit int default 20, p_user uuid default null)
returns table (
    user_id uuid, day date, posted_at timestamptz, card jsonb,
    username text, display_name text, avatar_url text,
    ack_count int, acked_by_me boolean, ack_users uuid[],
    my_reaction text, reactions jsonb
)
language sql stable security definer set search_path to ''
as $$
    select c.user_id, c.day, c.posted_at,
        case when coalesce((p.sharing ->> 'habits')::boolean, true) or c.user_id = (select auth.uid())
            then c.card else (c.card - 'habits' - 'tasks') end,
        p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        (select count(*)::int from public.post_acknowledgements a where a.post_user = c.user_id and a.post_day = c.day),
        exists (select 1 from public.post_acknowledgements a
                where a.post_user = c.user_id and a.post_day = c.day and a.from_user = (select auth.uid())),
        array(select a.from_user from public.post_acknowledgements a
              where a.post_user = c.user_id and a.post_day = c.day order by a.created_at limit 5),
        (select a.reaction from public.post_acknowledgements a
         where a.post_user = c.user_id and a.post_day = c.day and a.from_user = (select auth.uid())),
        coalesce((select jsonb_object_agg(r.reaction, r.n) from (
            select a.reaction, count(*)::int as n from public.post_acknowledgements a
            where a.post_user = c.user_id and a.post_day = c.day group by a.reaction
        ) r), '{}'::jsonb)
    from public.day_cards c
    join public.profiles p on p.id = c.user_id
    where c.posted_at is not null
      and (p_before is null or c.posted_at < p_before)
      and (p_user is null or c.user_id = p_user)
      -- The feed: only each person's latest posted day, and only for the day
      -- after it is posted, so cards never pile up. A profile keeps them all.
      and (p_user is not null or c.posted_at > now() - interval '24 hours')
      and (p_user is not null or c.day = (
          select max(latest.day) from public.day_cards latest
          where latest.user_id = c.user_id and latest.posted_at is not null
      ))
      and (
          c.user_id = (select auth.uid())
          or (public.are_friends(c.user_id)
              and not public.blocked_between((select auth.uid()), c.user_id)
              and coalesce((p.sharing ->> 'progress')::boolean, true))
      )
    order by c.posted_at desc
    limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.community_feed(timestamptz, int, uuid) from public, anon;
grant execute on function public.community_feed(timestamptz, int, uuid) to authenticated;

-- ----------------------------------------------------- 2. a reaction tells
create or replace function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    who text;
    said text;
begin
    if tg_op = 'UPDATE' and new.reaction is not distinct from old.reaction then return new; end if;
    select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into who from public.profiles where id = new.from_user;
    said := case new.reaction
        when 'fire' then 'On fire'
        when 'comeback' then 'The comeback'
        when 'again' then 'Again tomorrow?'
        else 'Proud of you' end;
    insert into public.notifications (user_id, from_user_id, type, title, body)
    values (new.post_user, new.from_user, 'reaction', who || ': ' || said, 'On your day');
    return new;
exception when others then
    return new;
end;
$$;

drop trigger if exists post_acks_notify on public.post_acknowledgements;
create trigger post_acks_notify
    after insert or update of reaction on public.post_acknowledgements
    for each row execute function public.notify_reaction();

-- ------------------------------------------------------------- 3. the drop
create or replace function public.post_due_day_cards()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
    posted integer;
begin
    with dropped as (
        update public.day_cards c
           set posted_at = now()
          from public.profiles p
         where p.id = c.user_id
           and c.posted_at is null
           and p.share_enabled
           and c.day = (now() at time zone coalesce(p.timezone, 'UTC'))::date
           and (now() at time zone coalesce(p.timezone, 'UTC'))::time >= p.share_time
           and coalesce((c.card ->> 'habitsTotal')::int, 0) + coalesce((c.card ->> 'tasksTotal')::int, 0) > 0
        returning c.user_id
    ), told as (
        -- Your day is up, and with it your crew's cards are open to you.
        insert into public.notifications (user_id, type, title, body)
        select d.user_id, 'day_drop', 'Your day just dropped', 'Your crew''s cards are open. See how they did.'
        from dropped d
        where exists (
            select 1 from public.friendships f
            where f.deleted_at is null and (f.user_id = d.user_id or f.friend_id = d.user_id)
        )
        returning 1
    )
    select count(*) into posted from dropped;
    return posted;
end;
$$;
revoke all on function public.post_due_day_cards() from public, anon, authenticated;

notify pgrst, 'reload schema';
