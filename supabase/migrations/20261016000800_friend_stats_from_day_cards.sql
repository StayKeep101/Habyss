-- Friends' numbers come from their day cards, not their whole backup.
--
-- friend_stats read every friend's raw completions, habits and tasks — 400
-- days of rows per person, every time Community opened — which also meant the
-- social side only worked for people whose full backup had reached the server.
-- The day card is one small row per person per day that the phone keeps
-- current anyway (lib/dayCard.ts), so it is now the only thing read:
--
--   today        habits and tasks done / due, from today's card
--   streak       the card's own streak (the app's one definition, streakFrom)
--   last 7 days  habits done, from the last seven cards
--   goals        active and moved today, carried on the card
--
-- Same signature and columns as before, so the app needs no change to read it.
-- Evidence is no longer tracked per completion here and comes back empty.
--
-- Cards also keep updating after they are posted, so friends see the day as
-- it ends rather than as it stood at posting time.
--
--   node scripts/apply-migration.mjs

create or replace function public.friend_stats(p_today date)
returns table (
    user_id uuid, username text, avatar_url text, today_done integer, active_habits integer,
    week_done integer[], current_streak integer, today_evidence text[], display_name text,
    tasks_done integer, tasks_total integer, goals_active integer, goals_moved integer
)
language sql stable security definer set search_path to ''
as $function$
    with people as (
        select (select auth.uid()) as id
        union
        select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end
        from public.friendships f
        where f.deleted_at is null
          and (f.user_id = (select auth.uid()) or f.friend_id = (select auth.uid()))
    ),
    visible as (
        select p.id from people p
        where p.id = (select auth.uid()) or not public.blocked_between((select auth.uid()), p.id)
    ),
    shown as (
        -- Your own numbers are always yours; the switch governs what others see.
        select v.id, (v.id = (select auth.uid()) or coalesce((pr.sharing ->> 'progress')::boolean, true)) as progress
        from visible v join public.profiles pr on pr.id = v.id
    ),
    today as (
        select c.user_id, c.card from public.day_cards c
        join visible v on v.id = c.user_id
        where c.day = p_today
    ),
    latest as (
        -- A streak holds until the day after it was last kept has passed.
        select distinct on (c.user_id) c.user_id, c.day, c.card
        from public.day_cards c join visible v on v.id = c.user_id
        where c.day between p_today - 1 and p_today
        order by c.user_id, c.day desc
    )
    select
        p.id,
        pr.username,
        pr.avatar_url,
        case when s.progress then coalesce((t.card ->> 'habitsDone')::int, 0) else 0 end,
        case when s.progress then coalesce((t.card ->> 'habitsActive')::int, (l.card ->> 'habitsActive')::int, (t.card ->> 'habitsTotal')::int, 0) else 0 end,
        case when s.progress then array(
            select coalesce((select (c.card ->> 'habitsDone')::int from public.day_cards c
                             where c.user_id = p.id and c.day = p_today - g), 0)
            from generate_series(6, 0, -1) as g)
            else array[0,0,0,0,0,0,0] end,
        case when s.progress then coalesce((l.card ->> 'streak')::int, 0) else 0 end,
        array[]::text[],
        pr.display_name,
        case when s.progress then coalesce((t.card ->> 'tasksDone')::int, 0) else 0 end,
        case when s.progress then coalesce((t.card ->> 'tasksTotal')::int, 0) else 0 end,
        case when s.progress then coalesce((t.card ->> 'goalsActive')::int, (l.card ->> 'goalsActive')::int, 0) else 0 end,
        case when s.progress then coalesce((t.card ->> 'goalsMoved')::int, 0) else 0 end
    from visible p
    join public.profiles pr on pr.id = p.id
    join shown s on s.id = p.id
    left join today t on t.user_id = p.id
    left join latest l on l.user_id = p.id
    where (select auth.uid()) is not null;
$function$;

-- Cards stay editable by their owner after posting.
drop policy if exists day_cards_update_own on public.day_cards;
create policy day_cards_update_own on public.day_cards for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
drop policy if exists day_cards_insert_own on public.day_cards;
create policy day_cards_insert_own on public.day_cards for insert to authenticated
    with check (user_id = (select auth.uid()));

-- The posting time belongs to the server: an owner's update cannot set or clear it.
create or replace function public.keep_posted_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
    if (select auth.uid()) is not null then
        new.posted_at := case when tg_op = 'UPDATE' then old.posted_at else null end;
    end if;
    return new;
end;
$$;
drop trigger if exists day_cards_keep_posted_at on public.day_cards;
create trigger day_cards_keep_posted_at before insert or update on public.day_cards
    for each row execute function public.keep_posted_at();

notify pgrst, 'reload schema';
