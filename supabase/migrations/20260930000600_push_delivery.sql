-- Notifications that reach a locked phone.
--
-- The app registered for an Expo push token and then stored it in
-- AsyncStorage, which is the one place nothing else can read it. No device
-- could notify any other device, so every "@sam shared a habit with you" waited
-- until that person happened to open Habyss and look at the inbox — which is
-- the opposite of the point.
--
-- Delivery is server-side on purpose. Sending from the client would mean every
-- phone could read its friends' push tokens, and a token somebody else holds is
-- a token somebody else can send to. Here the token is readable only by its
-- owner and by this trigger, which runs as the definer.
--
-- Applied 2026-09-30.
--   node scripts/apply-migration.mjs supabase/migrations/20260930000600_push_delivery.sql

-- Installed into `net` on this project, which is where Supabase puts it; the
-- schema is named explicitly below rather than left to a search_path this
-- function deliberately empties.
create extension if not exists pg_net;

alter table public.profiles add column if not exists push_token text;

-- Nobody reads anybody else's. The existing profile policies allow a friend to
-- select the row, so the column is excluded from what they may see by keeping
-- every read of it inside security-definer code.
revoke select (push_token) on public.profiles from anon, authenticated;
grant select (push_token) on public.profiles to service_role;

-- Owners still have to be able to write their own.
grant update (push_token) on public.profiles to authenticated;

/*
 * Sends a notification row on to Expo.
 *
 * Fire and forget: `net.http_post` queues the request and returns immediately,
 * so a slow or unreachable push service can never hold up the insert. A
 * notification that is saved but not pushed is a notification somebody finds
 * next time they open the app, which is exactly what used to happen every time.
 */
create or replace function public.push_notification()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    token text;
begin
    select p.push_token into token from public.profiles p where p.id = new.user_id;
    if token is null or token not like 'ExponentPushToken%' then
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
            -- What to open when it is tapped, rather than just the app.
            'data', jsonb_build_object('type', new.type, 'from', new.from_user_id),
            -- Collapses repeats of the same kind rather than stacking them.
            'collapseId', new.type
        )
    );
    return new;
exception when others then
    -- A push that could not be queued must never take the notification with
    -- it. The row is the record; the push is the courtesy, and an AFTER
    -- trigger that raises would roll back the insert that caused it.
    return new;
end;
$function$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
    after insert on public.notifications
    for each row execute function public.push_notification();

notify pgrst, 'reload schema';
