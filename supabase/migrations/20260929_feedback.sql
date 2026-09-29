-- Somewhere for "this is broken" to actually go.
--
-- There was a Contact support screen whose Send button showed "Sent!" and
-- cleared the field. Nothing left the phone. That is worse than having no
-- feedback at all, because the person who took the trouble to write it believes
-- it arrived.
--
-- Two decisions worth writing down.
--
-- The table takes no direct writes at all. Everything goes through
-- `submit_feedback`, which is the only way to reach it, because the app's
-- publishable key is inside the app bundle and a plain insert policy for `anon`
-- is a public write endpoint for anybody who unzips it. The function can hold a
-- rate limit; a policy cannot.
--
-- Signed out still sends. The moment somebody most wants to tell you something
-- is the moment the app has annoyed them, and an account is a poor thing to ask
-- for first. Anonymous feedback carries an install id instead, so a
-- conversation is still possible and the rate limit still has something to
-- count.
--
-- Applied 2026-09-29.
--   node scripts/apply-migration.mjs supabase/migrations/20260929_feedback.sql

create table if not exists public.feedback (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references public.profiles (id) on delete set null,
    /** Random, made once per install, so anonymous feedback can be grouped. */
    client_id   text not null,
    message     text not null check (char_length(btrim(message)) between 1 and 2000),
    /** Where they were and what they were running. Collected, never typed. */
    context     jsonb not null default '{}'::jsonb,
    /** Read by a person, so this is for that person to set. */
    handled     boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists idx_feedback_new on public.feedback (created_at desc) where not handled;
create index if not exists idx_feedback_client on public.feedback (client_id, created_at desc);

alter table public.feedback enable row level security;

-- Your own, so the app can show that it arrived. Nobody reads anybody else's
-- from the app; that is what the dashboard is for.
drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback
    for select to authenticated using (auth.uid() = user_id);

-- Deliberately no insert policy. See `submit_feedback`.

/**
 * Takes one piece of feedback, from anybody, at a sane rate.
 *
 * Returns the row's id, or null when the sender has clearly run away with
 * themselves — which the app reports as sent anyway, because arguing with
 * somebody about their tenth message in an hour is not a good use of either
 * party's afternoon.
 */
create or replace function public.submit_feedback(
    p_message text,
    p_client_id text,
    p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
    uid uuid := (select auth.uid());
    clean text := btrim(coalesce(p_message, ''));
    recent integer;
    new_id uuid;
begin
    if clean = '' then return null; end if;
    if char_length(clean) > 2000 then clean := left(clean, 2000); end if;
    if coalesce(btrim(p_client_id), '') = '' then return null; end if;

    select count(*) into recent
      from public.feedback
     where client_id = p_client_id
       and created_at > now() - interval '1 hour';
    if recent >= 10 then return null; end if;

    insert into public.feedback (user_id, client_id, message, context)
    values (uid, p_client_id, clean, coalesce(p_context, '{}'::jsonb))
    returning id into new_id;

    return new_id;
end;
$function$;

revoke all on function public.submit_feedback(text, text, jsonb) from public;
grant execute on function public.submit_feedback(text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
