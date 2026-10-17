-- Feedback reaches a person: every new row is emailed to the team.
--
-- The trigger hands the row to the `feedback-email` edge function through
-- pg_net, which is asynchronous, so saving feedback never waits on mail and
-- never fails because of it. The function URL and its shared secret live in
-- Vault (`feedback_hook_url`, `feedback_hook_secret`), not in this file. With
-- either missing, the trigger does nothing and the row is simply saved.

create or replace function public.email_feedback()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    hook_url text;
    hook_secret text;
begin
    select decrypted_secret into hook_url from vault.decrypted_secrets where name = 'feedback_hook_url';
    select decrypted_secret into hook_secret from vault.decrypted_secrets where name = 'feedback_hook_secret';
    if hook_url is null or hook_secret is null then return new; end if;
    perform net.http_post(
        url := hook_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-feedback-secret', hook_secret),
        body := jsonb_build_object('id', new.id, 'user_id', new.user_id, 'message', new.message, 'context', new.context)
    );
    return new;
exception when others then
    -- Mail is a courtesy; the feedback itself must always be saved.
    return new;
end;
$function$;

revoke all on function public.email_feedback() from public, anon, authenticated;

drop trigger if exists feedback_email on public.feedback;
create trigger feedback_email
    after insert on public.feedback
    for each row execute function public.email_feedback();
