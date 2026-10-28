-- Focus together: join a friend's focus session, or invite friends to yours.
--
-- 1. profiles.focus_with: whose session you joined (null when focusing alone
--    or not focusing). Friends read it through friend_presence(), so everyone
--    in a session sees who else is in it.
-- 2. Joining tells the host: a notification ("Alex joined your focus"). The
--    host is focusing, so the existing quiet rule keeps it off their lock
--    screen; their focus page shows the face instead.
-- 3. invite_friends_to_focus(): "Join me?" to every friend who is awake,
--    once per 20 minutes at most, only while you are focusing.

-- ---------------------------------------------------------------- 1. column
alter table public.profiles add column if not exists focus_with uuid
    references public.profiles (id) on delete set null;
alter table public.profiles add column if not exists focus_invited_at timestamptz;

alter table public.profiles drop constraint if exists profiles_focus_with_not_self;
alter table public.profiles add constraint profiles_focus_with_not_self check (focus_with is null or focus_with <> id);

grant select (focus_with) on public.profiles to authenticated;
grant update (focus_with) on public.profiles to authenticated;
-- focus_invited_at is written only by invite_friends_to_focus().

-- The return type changes, so the function is dropped first.
drop function if exists public.friend_presence();
create function public.friend_presence()
returns table (
    user_id uuid, username text, display_name text, avatar_url text,
    presence text, presence_at timestamptz, focus_until timestamptz, focus_label text,
    timezone text, wake_time time, sleep_time time, focus_with uuid
)
language sql stable security definer set search_path to ''
as $$
    select p.id, p.username,
        case when coalesce((p.sharing ->> 'name')::boolean, true) then p.display_name end,
        case when coalesce((p.sharing ->> 'photo')::boolean, true) then p.avatar_url end,
        p.presence, p.presence_at, p.focus_until,
        case when coalesce((p.sharing ->> 'habits')::boolean, true) then p.focus_label end,
        p.timezone, p.wake_time, p.sleep_time,
        case when p.focus_until > now() then p.focus_with end
    from public.profiles p
    where public.are_friends(p.id)
      and not public.blocked_between((select auth.uid()), p.id);
$$;
revoke all on function public.friend_presence() from public, anon;
grant execute on function public.friend_presence() to authenticated;

-- ---------------------------------------------------------------- 2. joined
create or replace function public.notify_focus_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    joiner_name text;
begin
    if new.focus_with is null or new.focus_with is not distinct from old.focus_with then
        return new;
    end if;
    -- Only a friend's session that is still running, never someone you cannot see.
    if not exists (
        select 1 from public.profiles h
        where h.id = new.focus_with and h.focus_until > now()
    ) or not exists (
        select 1 from public.friendships f
        where f.deleted_at is null
          and ((f.user_id = new.id and f.friend_id = new.focus_with) or (f.user_id = new.focus_with and f.friend_id = new.id))
    ) or public.blocked_between(new.id, new.focus_with) then
        new.focus_with := null;
        return new;
    end if;
    joiner_name := coalesce(nullif(btrim(new.display_name), ''), new.username, 'A friend');
    insert into public.notifications (user_id, from_user_id, type, title, body)
    values (new.focus_with, new.id, 'focus_joined', joiner_name || ' joined your focus', 'You are not doing this alone.');
    return new;
exception when others then
    return new;
end;
$$;

drop trigger if exists profiles_focus_joined on public.profiles;
create trigger profiles_focus_joined
    before update of focus_with on public.profiles
    for each row execute function public.notify_focus_joined();

-- ---------------------------------------------------------------- 3. invite
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
           what || case when minutes >= 600 then 'Open-ended' else minutes || ' min left' end
    from public.profiles f
    where public.are_friends(f.id)
      and not public.blocked_between(me, f.id)
      -- Asleep in their own time zone: no buzz at 3 a.m.
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
      -- Already in this session: nothing to invite them to.
      and f.focus_with is distinct from me;
    get diagnostics sent = row_count;

    update public.profiles set focus_invited_at = now() where id = me;
    return case when sent = 0 then 'nobody' else sent::text end;
end;
$$;
revoke all on function public.invite_friends_to_focus() from public, anon;
grant execute on function public.invite_friends_to_focus() to authenticated;
