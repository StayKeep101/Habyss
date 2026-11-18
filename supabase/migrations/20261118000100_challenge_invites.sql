-- Challenge invites, one clear rule: an invite can be answered until the end of
-- the challenge's first day (joining on day 1 still leaves the whole day to keep).
-- After that it drops off. Whoever started it hears each answer.

-- Moves runs along: open ones start on their day; invites still unanswered once
-- the first day is over drop off; a run with a joined member missing a day (past
-- a day's grace) ends for all.
create or replace function public.settle_due_challenges()
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    r public.challenge_runs;
    c public.challenge_catalog;
begin
    update public.challenge_runs set status = 'active' where status = 'open' and starts <= current_date;
    update public.challenge_members m set status = 'declined'
      from public.challenge_runs r
     where r.id = m.run_id and m.status = 'invited' and r.starts < current_date;
    for r in select * from public.challenge_runs where status = 'active' for update skip locked loop
        if public.check_challenge_won(r.id) then continue; end if;
        select * into c from public.challenge_catalog where id = r.challenge_id;
        if exists (
            select 1 from public.challenge_members m
              cross join generate_series(r.starts, least(r.ends, current_date - 2), interval '1 day') as g(day)
             where m.run_id = r.id and m.status = 'joined'
               and not exists (select 1 from public.challenge_days d where d.run_id = r.id and d.user_id = m.user_id and d.day = g.day::date)
        ) then
            update public.challenge_runs set status = 'failed', settled_at = now() where id = r.id;
            perform public.tell_challenge(r.id, 'Challenge over', c.title || ': a day was missed, so it ended for everyone.');
        end if;
    end loop;
end;
$$;
revoke all on function public.settle_due_challenges() from public, anon, authenticated;

create or replace function public.respond_challenge(p_run uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    r public.challenge_runs;
    c public.challenge_catalog;
    who text;
begin
    select * into r from public.challenge_runs where id = p_run;
    if not found or r.status not in ('open', 'active') or r.starts < current_date then
        raise exception 'That invite has expired: the challenge is past its first day.';
    end if;
    update public.challenge_members set status = case when p_accept then 'joined' else 'declined' end
     where run_id = p_run and user_id = me and status = 'invited';
    if not found then raise exception 'That invite is gone.'; end if;
    select * into c from public.challenge_catalog where id = r.challenge_id;
    select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into who from public.profiles where id = me;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        values (r.owner_id, me, 'challenge',
                who || case when p_accept then ' joined ' else ' declined ' end || c.title,
                case when p_accept then 'You’re in it together. ' || c.reward || ' Shards each if you all make it.'
                     else 'You can still keep going without them.' end);
end;
$$;
revoke all on function public.respond_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
