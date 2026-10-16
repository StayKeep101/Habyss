-- The feed, narrowed to one person, for their profile page.
--
-- Same rules as before (your posts, and friends' posts they share); p_user
-- only filters. The two-argument version is replaced rather than overloaded,
-- so there is one feed function.
--
--   node scripts/apply-migration.mjs

drop function if exists public.community_feed(timestamptz, int);

create or replace function public.community_feed(p_before timestamptz default null, p_limit int default 20, p_user uuid default null)
returns table (
    user_id uuid, day date, posted_at timestamptz, card jsonb,
    username text, display_name text, avatar_url text,
    ack_count int, acked_by_me boolean, ack_users uuid[]
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
              where a.post_user = c.user_id and a.post_day = c.day order by a.created_at limit 5)
    from public.day_cards c
    join public.profiles p on p.id = c.user_id
    where c.posted_at is not null
      and (p_before is null or c.posted_at < p_before)
      and (p_user is null or c.user_id = p_user)
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

notify pgrst, 'reload schema';
