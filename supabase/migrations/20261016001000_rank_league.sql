-- The world board becomes your league: people in the same rank as you.
--
-- A Lost player sees Lost players; an Eternal one sees Eternal ones, so the
-- board is always a fair race. The rank bands live in one place, the app's
-- lib/marks.ts (RANKS); the app passes its own band's Marks range here.
-- 'world' and 'friends' keep working as before.
--
--   node scripts/apply-migration.mjs

drop function if exists public.leaderboard(text);

create or replace function public.leaderboard(p_scope text default 'friends', p_min int default null, p_max int default null)
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
                  and (
                      (p_scope = 'friends' and public.are_friends(p.id))
                      or p_scope = 'world'
                      or (p_scope = 'league'
                          and p.marks >= coalesce(p_min, 0)
                          and (p_max is null or p.marks < p_max))
                  )
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
revoke all on function public.leaderboard(text, int, int) from public, anon;
grant execute on function public.leaderboard(text, int, int) to authenticated;

notify pgrst, 'reload schema';
