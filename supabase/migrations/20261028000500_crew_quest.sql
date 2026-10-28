-- The weekly crew quest: you and your friends, together, for the week.
--
-- Nothing to set up: your crew is you and the friends who share progress. A
-- show-up is a habit or task done, read from the day cards everyone already
-- writes, counted at most three a day per person so nobody carries the group.
-- Friends' days count once posted (at their drop); your own counts as you go.
-- `active` says who wrote any card in the last two weeks, so the app can set
-- a target that only counts people who are around.
--
--   node scripts/apply-migration.mjs

create or replace function public.crew_quest(p_from date, p_to date)
returns table (
    user_id uuid, username text, display_name text, avatar_url text,
    show_ups int, active boolean
)
language sql stable security definer set search_path to ''
as $$
    select p.id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        coalesce((
            select sum(least(3, coalesce((c.card ->> 'habitsDone')::int, 0) + coalesce((c.card ->> 'tasksDone')::int, 0)))
            from public.day_cards c
            where c.user_id = p.id and c.day between p_from and p_to
              and (c.posted_at is not null or c.user_id = (select auth.uid()))
        ), 0)::int,
        exists (
            select 1 from public.day_cards c
            where c.user_id = p.id and c.day >= p_from - 14
        )
    from public.profiles p
    where p.id = (select auth.uid())
       or (public.are_friends(p.id)
           and not public.blocked_between((select auth.uid()), p.id)
           and coalesce((p.sharing ->> 'progress')::boolean, true));
$$;
revoke all on function public.crew_quest(date, date) from public, anon;
grant execute on function public.crew_quest(date, date) to authenticated;

notify pgrst, 'reload schema';
