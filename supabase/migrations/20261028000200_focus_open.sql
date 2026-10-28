-- A focus session with no end (a stopwatch: flow, or a timer run past its
-- time) says so. Its focus_until is only a placeholder two hours ahead, so
-- a friend who joined it was shown a two-hour countdown while the host's
-- clock counted up. Now friends read focus_open: joining an open session
-- counts up too, and Community says Open-ended instead of "2 hr left".

alter table public.profiles add column if not exists focus_open boolean not null default false;
grant select (focus_open) on public.profiles to authenticated;
grant update (focus_open) on public.profiles to authenticated;

drop function if exists public.friend_presence();
create function public.friend_presence()
returns table (
    user_id uuid, username text, display_name text, avatar_url text,
    presence text, presence_at timestamptz, focus_until timestamptz, focus_label text,
    timezone text, wake_time time, sleep_time time, focus_with uuid, focus_open boolean
)
language sql stable security definer set search_path to ''
as $$
    select p.id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        p.presence, p.presence_at, p.focus_until,
        case when coalesce((p.sharing ->> 'habits')::boolean, true) then p.focus_label end,
        p.timezone, p.wake_time, p.sleep_time,
        case when p.focus_until > now() then p.focus_with end,
        p.focus_open
    from public.profiles p
    where public.are_friends(p.id)
      and not public.blocked_between((select auth.uid()), p.id);
$$;
revoke all on function public.friend_presence() from public, anon;
grant execute on function public.friend_presence() to authenticated;

-- The invite says Open-ended for a session with no end.
create or replace function public.invite_friends_to_focus()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    me uuid := auth.uid();
    mine public.profiles%rowtype;
    host_name text;
    minutes int;
    what text;
    sent int := 0;
begin
    if me is null then return 'signed_out'; end if;
    select * into mine from public.profiles where id = me;
    if mine.focus_until is null or mine.focus_until <= now() then return 'not_focusing'; end if;
    if mine.focus_invited_at is not null and mine.focus_invited_at > now() - interval '20 minutes' then
        return 'too_soon';
    end if;

    host_name := coalesce(nullif(btrim(mine.display_name), ''), mine.username, 'A friend');
    minutes := greatest(1, ceil(extract(epoch from (mine.focus_until - now())) / 60)::int);
    what := case when coalesce((mine.sharing ->> 'habits')::boolean, true) and nullif(btrim(mine.focus_label), '') is not null
                 then btrim(mine.focus_label) || ' · ' else '' end;

    insert into public.notifications (user_id, from_user_id, type, title, body)
    select f.id, me, 'focus_invite', host_name || ' is locking in. Join?',
           what || case when mine.focus_open then 'Open-ended' else minutes || ' min left' end
    from public.profiles f
    where public.are_friends(f.id)
      and not public.blocked_between(me, f.id)
      and not (
          f.wake_time is not null and f.sleep_time is not null and f.sleep_time <> f.wake_time
          and (
              case when f.sleep_time < f.wake_time
                   then (now() at time zone coalesce(f.timezone, 'UTC'))::time >= f.sleep_time
                        and (now() at time zone coalesce(f.timezone, 'UTC'))::time < f.wake_time
                   else (now() at time zone coalesce(f.timezone, 'UTC'))::time >= f.sleep_time
                        or (now() at time zone coalesce(f.timezone, 'UTC'))::time < f.wake_time
              end
          )
      )
      and f.focus_with is distinct from me;
    get diagnostics sent = row_count;

    update public.profiles set focus_invited_at = now() where id = me;
    return case when sent = 0 then 'nobody' else sent::text end;
end;
$$;
revoke all on function public.invite_friends_to_focus() from public, anon;
grant execute on function public.invite_friends_to_focus() to authenticated;
