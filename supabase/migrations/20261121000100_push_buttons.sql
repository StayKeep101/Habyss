-- Buttons on two more Community pushes, answered without opening Habyss
-- (lib/notificationActions.ts, lib/socialActions.ts): a friend request
-- "Decline · Accept" and a challenge invite "Decline · Join". The same
-- function as 20261108000300_push_kinds.sql otherwise.

create or replace function public.push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    token text;
    focusing boolean;
    muted text[];
    zone text;
    wakes time;
    sleeps time;
    clock time;
begin
    select p.push_token, coalesce(p.focus_until > now(), false), coalesce(p.push_muted, '{}'), p.timezone, p.wake_time, p.sleep_time
      into token, focusing, muted, zone, wakes, sleeps
      from public.profiles p where p.id = new.user_id;
    if token is null or token not like 'ExponentPushToken%' then
        return new;
    end if;
    -- Focusing: it waits in the inbox instead of buzzing the phone.
    if focusing then
        return new;
    end if;
    -- Asleep (their own bedtime to wake-up, in their own time zone, from Day &
    -- calendar): it waits in the inbox. Bedtime itself still counts as awake.
    if wakes is not null and sleeps is not null and wakes <> sleeps then
        begin
            clock := (now() at time zone coalesce(zone, 'UTC'))::time;
        exception when others then
            clock := (now() at time zone 'UTC')::time;
        end;
        if (sleeps > wakes and (clock > sleeps or clock < wakes))
           or (sleeps < wakes and clock > sleeps and clock < wakes) then
            return new;
        end if;
    end if;
    -- A kind switched off in Settings: inbox only.
    if new.type = any(muted) then
        return new;
    end if;
    -- The sender's own phone is never the recipient.
    if new.from_user_id is not null and exists (
        select 1 from public.profiles s where s.id = new.from_user_id and s.push_token = token
    ) then
        return new;
    end if;

    perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'to', token,
            'title', coalesce(new.title, 'Habyss'),
            'body', coalesce(new.body, ''),
            'sound', 'default',
            'data', jsonb_build_object('type', new.type, 'from', new.from_user_id),
            'collapseId', new.type,
            -- Its buttons, answered on the notification (lib/notificationActions.ts):
            -- a nudge "On it", a comment "Reply", a duel still waiting "Accept · Decline",
            -- a shared habit, task or goal "No thanks · Let's do it", a friend request
            -- "Decline · Accept", a challenge invite "Decline · Join".
            'categoryId', case
                when new.type = 'nudge' then 'HABYSS_FRIEND_NUDGE'
                when new.type = 'comment' then 'HABYSS_COMMENT'
                when new.type = 'share_offer' then 'HABYSS_SHARE'
                -- A friend request still waiting: "Decline · Accept".
                when new.type = 'friend_request' and exists (
                    select 1 from public.friend_requests fr
                    where fr.from_user_id = new.from_user_id and fr.to_user_id = new.user_id
                      and fr.status = 'pending' and fr.deleted_at is null
                ) then 'HABYSS_FRIEND_REQUEST'
                -- A challenge you are invited to and have not answered: "Decline · Join".
                when new.type = 'challenge' and exists (
                    select 1 from public.challenge_members m
                    join public.challenge_runs r on r.id = m.run_id
                    where m.user_id = new.user_id and m.status = 'invited' and r.owner_id = new.from_user_id
                ) then 'HABYSS_CHALLENGE'
                when new.type = 'duel' and exists (
                    select 1 from public.duels d
                    where d.challenger_id = new.from_user_id and d.opponent_id = new.user_id and d.status = 'proposed'
                ) then 'HABYSS_DUEL'
                else ''
            end
        )
    );
    return new;
exception when others then
    return new;
end;
$$;

notify pgrst, 'reload schema';
