-- Focus is silent: a friend's push is not sent while you are focusing.
--
-- The app writes profiles.focus_until when a session starts (and clears it
-- when it ends). While that is in the future, the notification row is still
-- saved, so it is in the inbox afterwards; only the push to the phone is
-- skipped. Everything else is as before.

create or replace function public.push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    token text;
    focusing boolean;
begin
    select p.push_token, coalesce(p.focus_until > now(), false)
      into token, focusing
      from public.profiles p where p.id = new.user_id;
    if token is null or token not like 'ExponentPushToken%' then
        return new;
    end if;
    -- Focusing: it waits in the inbox instead of buzzing the phone.
    if focusing then
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
            'collapseId', new.type
        )
    );
    return new;
exception when others then
    return new;
end;
$$;
