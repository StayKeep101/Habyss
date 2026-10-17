-- Acknowledging a friend's day never worked: the insert policy checked that
-- the day card was posted with a subquery on `day_cards`, but `day_cards`
-- rows are readable only by their owner, so under the acknowledger's RLS the
-- card never existed and every insert was refused. The check now runs in a
-- SECURITY DEFINER function that answers only yes or no, so no card is
-- exposed by it.

create or replace function public.day_card_posted(p_user uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select exists (
        select 1 from public.day_cards
        where user_id = p_user and day = p_day and posted_at is not null
    );
$function$;

revoke all on function public.day_card_posted(uuid, date) from public, anon;
grant execute on function public.day_card_posted(uuid, date) to authenticated;

drop policy if exists post_acks_insert on public.post_acknowledgements;
create policy post_acks_insert on public.post_acknowledgements
    for insert to authenticated
    with check (
        from_user = (select auth.uid())
        and public.are_friends(post_user)
        and not public.blocked_between(from_user, post_user)
        and public.day_card_posted(post_user, post_day)
    );

-- Least privilege: the app inserts, reads and deletes acknowledgements; nothing more.
revoke all on public.post_acknowledgements from anon;
revoke update, truncate, references, trigger on public.post_acknowledgements from authenticated;
