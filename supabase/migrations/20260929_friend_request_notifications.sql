-- A friend request that the other person can actually be told about.
--
-- The table was written for nudges, so its insert policy says you may only
-- write a notification to somebody you are already friends with. A friend
-- request is precisely the case where you are not — so a request landed in
-- `friend_requests`, the recipient saw nothing until they happened to open the
-- Community tab, and there was nowhere for it to be waiting for them.
--
-- Opening the policy up to strangers is not on: that is a direct message
-- channel to any account on the service. Instead, two named types are allowed
-- through, and only when the server can see the thing they are about:
--
--   friend_request   only while a pending request from you to them exists
--   friend_accepted  only once you are on each other's friends list
--
-- So the notification cannot exist without the act it describes, and neither
-- can be sent twice by hand — `pending_request_between` is checked at insert,
-- not trusted from the app.
--
-- Applied 2026-09-29.
--   node scripts/apply-migration.mjs supabase/migrations/20260929_friend_request_notifications.sql

/**
 * Whether `p_from` has a request waiting for `p_to`.
 *
 * Security definer because the policy runs as the sender, who can read their
 * own requests — but the check has to hold whichever side calls it, and this
 * way the rule cannot be bent by a policy change on friend_requests.
 */
create or replace function public.pending_request_between(p_from uuid, p_to uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select exists (
        select 1 from public.friend_requests
        where from_user_id = p_from
          and to_user_id = p_to
          and status = 'pending'
          and deleted_at is null
    );
$function$;

revoke all on function public.pending_request_between(uuid, uuid) from public;
grant execute on function public.pending_request_between(uuid, uuid) to authenticated;

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
    for insert to authenticated
    with check (
        from_user_id = (select auth.uid())
        and not public.blocked_between((select auth.uid()), user_id)
        and (
            -- Yourself, or a friend: what the policy already allowed.
            user_id = (select auth.uid())
            or public.are_friends(user_id)
            -- Or the person you have just asked to be friends with.
            or (type = 'friend_request' and public.pending_request_between((select auth.uid()), user_id))
            -- Or the person whose request you have just accepted.
            or (type = 'friend_accepted' and public.are_friends(user_id))
        )
    );

-- Read at a glance, which is what a badge needs.
create index if not exists idx_notifications_unread
    on public.notifications (user_id, read, created_at desc)
    where deleted_at is null;

notify pgrst, 'reload schema';
