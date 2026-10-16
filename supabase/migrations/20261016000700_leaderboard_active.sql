-- The world leaderboard shows people who are actually using Habyss.
--
-- Someone counts as active when their phone has been on the app (presence) or
-- has published Marks in the last 14 days, and they have at least one Mark.
-- Empty and long-abandoned accounts no longer fill the board. You always see
-- your own row. The friends board is unchanged: everyone you know who has
-- Marks, active or not.
--
--   node scripts/apply-migration.mjs

create or replace function public.leaderboard(p_scope text default 'friends')
returns table (rank bigint, user_id uuid, username text, display_name text, avatar_url text, marks int, is_me boolean)
language sql stable security definer set search_path to ''
as $$
    with pool as (
        select p.id, p.username, p.display_name, p.avatar_url, p.marks, p.sharing
        from public.profiles p
        where p.marks is not null
          and p.username is not null
          and (p.id = (select auth.uid()) or coalesce((p.sharing ->> 'progress')::boolean, true))
          and (p.id = (select auth.uid()) or not public.blocked_between((select auth.uid()), p.id))
          and (
              p.id = (select auth.uid())
              or (p_scope = 'friends' and public.are_friends(p.id))
              or (p_scope = 'world'
                  and p.marks > 0
                  and greatest(p.presence_at, p.marks_updated_at) > now() - interval '14 days')
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
