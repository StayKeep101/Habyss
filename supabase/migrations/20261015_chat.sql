-- Talking to your friends, and your day sent along with it.
--
-- Two tables, because they are two different things:
--
--   messages   what you type to one friend. Private to the two of you.
--   day_cards  one snapshot of your day (habits, tasks, how far you got),
--              rewritten as the day goes on. Every chat with a friend shows
--              it, so it is stored once rather than copied into each thread.
--
-- A day card follows the existing `sharing` switches: `progress` off means
-- friends do not see it at all, `habits` off hides the names and leaves the
-- counts. That is enforced here, not in the app, because an older app version
-- must not be able to show more than somebody agreed to.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261015_chat.sql

-- ----------------------------------------------------------------- messages
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    from_user uuid not null references auth.users(id) on delete cascade,
    to_user uuid not null references auth.users(id) on delete cascade,
    body text not null check (char_length(body) between 1 and 2000),
    created_at timestamptz not null default now(),
    read_at timestamptz,
    check (from_user <> to_user)
);

create index if not exists messages_pair_idx on public.messages (from_user, to_user, created_at desc);
create index if not exists messages_to_idx on public.messages (to_user, created_at desc);

alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
    using (from_user = (select auth.uid()) or to_user = (select auth.uid()));

-- Only to a friend, and never across a block.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
    with check (
        from_user = (select auth.uid())
        and public.are_friends(to_user)
        and not public.blocked_between(from_user, to_user)
    );

-- The only change anybody makes is marking what they received as read.
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
    using (to_user = (select auth.uid()))
    with check (to_user = (select auth.uid()));

-- You can take back what you sent.
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
    using (from_user = (select auth.uid()));

revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- ---------------------------------------------------------------- day cards
create table if not exists public.day_cards (
    user_id uuid not null references auth.users(id) on delete cascade,
    day date not null,
    -- { habits: [{ name, done, skipped }], tasks: [{ title, done }],
    --   habitsDone, habitsTotal, tasksDone, tasksTotal, streak }
    card jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, day)
);

alter table public.day_cards enable row level security;

-- Your own, directly. Friends read through friend_day_cards below, which
-- applies the sharing switches.
drop policy if exists day_cards_own on public.day_cards;
create policy day_cards_own on public.day_cards for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

/*
 * A friend's day cards, as much of them as they share.
 */
create or replace function public.friend_day_cards(p_friend uuid, p_since date)
returns table (user_id uuid, day date, card jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
    select c.user_id, c.day,
        case when coalesce((p.sharing ->> 'habits')::boolean, true)
            then c.card
            else (c.card - 'habits' - 'tasks')
        end,
        c.updated_at
    from public.day_cards c
    join public.profiles p on p.id = c.user_id
    where c.user_id = p_friend
      and c.day >= p_since
      and public.are_friends(p_friend)
      and not public.blocked_between((select auth.uid()), p_friend)
      and coalesce((p.sharing ->> 'progress')::boolean, true)
    order by c.day;
$function$;

revoke all on function public.friend_day_cards(uuid, date) from public, anon;
grant execute on function public.friend_day_cards(uuid, date) to authenticated;

-- --------------------------------------------------------- push on message
/*
 * A message reaches a locked phone, the same way notifications do. Not written
 * into the inbox: a chat is its own place, and an inbox full of "hey" buries
 * the friend requests that actually need an answer.
 */
create or replace function public.push_message()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    token text;
    sender text;
begin
    select p.push_token into token from public.profiles p where p.id = new.to_user;
    if token is null or token not like 'ExponentPushToken%' then
        return new;
    end if;
    -- The sender's own phone is never the recipient.
    if exists (select 1 from public.profiles s where s.id = new.from_user and s.push_token = token) then
        return new;
    end if;
    select coalesce(nullif(trim(p.display_name), ''), p.username, 'A friend') into sender
        from public.profiles p where p.id = new.from_user;

    perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'to', token,
            'title', sender,
            'body', left(new.body, 180),
            'sound', 'default',
            'data', jsonb_build_object('type', 'message', 'from', new.from_user,
                'url', '/chat?id=' || new.from_user::text),
            'threadId', new.from_user::text
        )
    );
    return new;
exception when others then
    return new;
end;
$function$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push
    after insert on public.messages
    for each row execute function public.push_message();

-- Live: a message appears in an open chat without pulling down.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;
end $$;

notify pgrst, 'reload schema';
