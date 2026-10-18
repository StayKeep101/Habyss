-- The gift notification reads the giver's display name (the column is
-- display_name, not name).
create or replace function public.gift_streak_freeze(p_friend uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := (select auth.uid());
    held integer;
    giver_name text;
begin
    if me is null then return 'signed_out'; end if;
    if p_friend is null or p_friend = me or not public.are_friends(p_friend) then return 'not_friends'; end if;
    if public.blocked_between(me, p_friend) then return 'not_friends'; end if;
    if exists (select 1 from public.streak_freeze_gifts
               where giver = me and receiver = p_friend and created_at > now() - interval '7 days') then
        return 'too_soon';
    end if;
    select streak_freezes into held from public.profiles where id = p_friend for update;
    if held is null then return 'not_friends'; end if;
    if held >= 5 then return 'full'; end if;

    update public.profiles set streak_freezes = streak_freezes + 1 where id = p_friend;
    insert into public.streak_freeze_gifts (giver, receiver) values (me, p_friend);
    select coalesce(nullif(btrim(display_name), ''), username, 'A friend') into giver_name from public.profiles where id = me;
    insert into public.notifications (user_id, from_user_id, type, title, body)
    values (p_friend, me, 'freeze_gift', giver_name || ' sent you a streak freeze',
            'If you miss a day, it covers it. Your streak stays.');
    return 'sent';
end;
$function$;
