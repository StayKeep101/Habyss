-- The leaderboard lists people who have earned Marks — and only them.
--
-- Both boards (friends and world) show everyone with at least one Mark, active
-- recently or not; nobody with no Marks appears. You always see your own row,
-- so you know where you stand even at zero.
--
--   node scripts/apply-migration.mjs

create or replace function public.leaderboard(p_scope text default 'friends')
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text, marks int, is_me boolean)
language sql stable security definer set search_path to ''
as $$
    with pool as (
        select p.id, p.username, p.display_name, p.avatar_url, coalesce(p.marks, 0) as marks, p.sharing
        from public.profiles p
        where p.username is not null
          and (
              p.id = (select auth.uid())
              or (
                  p.marks > 0
                  and coalesce((p.sharing ->> 'progress')::boolean, true)
                  and not public.blocked_between((select auth.uid()), p.id)
                  and (p_scope = 'world' or public.are_friends(p.id))
              )
          )
    ), ranked as (
        select rank() over (order by marks desc, username) as rank, * from pool
    )
    select r.rank, r.id, r.username,
        case when coalesce((r.sharing ->> 'name')::boolean, true) then r.display_name end,
        case when coalesce((r.sharing ->> 'photo')::boolean, true) then r.avatar_url end,
        r.marks, r.id = (select auth.uid())
    from ranked r
    where r.rank <= 50 or r.id = (select auth.uid())
    order by r.rank;
$$;

notify pgrst, 'reload schema';
