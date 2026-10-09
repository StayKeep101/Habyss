-- One phone, one account's notifications.
--
-- A push token belongs to a phone, not to an account. publishPushToken wrote it
-- onto whichever account signed in, and nothing ever took it off the last one.
-- So after signing into a second account on the same phone — a test account, a
-- friend's — both rows held this phone's token, and every notification meant
-- for the other account arrived here: share something with them and your own
-- phone said they had shared something with you.
--
-- claim_push_token gives the token to the caller and takes it from every other
-- account in the same statement. The push trigger also refuses to deliver to a
-- token the sender holds, so a stale copy can never echo a notification back
-- to the phone that caused it.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261006_push_token_owner.sql

create or replace function public.claim_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
    if (select auth.uid()) is null or p_token is null then return; end if;
    update public.profiles set push_token = null
        where push_token = p_token and id <> (select auth.uid());
    update public.profiles set push_token = p_token where id = (select auth.uid());
end;
$$;

revoke all on function public.claim_push_token(text) from public, anon;
grant execute on function public.claim_push_token(text) to authenticated;

-- Clean up what is already there: a token held by more than one account is
-- taken off all of them. Each phone claims its own back the next time Habyss
-- launches (publishPushToken runs on every sign-in and cold start).
update public.profiles set push_token = null
where push_token in (
    select push_token from public.profiles
    where push_token is not null group by push_token having count(*) > 1
);

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
$function$;

notify pgrst, 'reload schema';
