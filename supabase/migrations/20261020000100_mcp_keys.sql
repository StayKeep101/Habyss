-- AI assistants (MCP): personal keys that let an assistant such as Claude or
-- ChatGPT read and add to one person's habits and tasks through the `mcp`
-- edge function.
--
-- A key is shown once, when it is made, and only its SHA-256 is stored, so a
-- leaked table gives nobody access. The edge function looks a key up by its
-- hash with the service role; people can list and revoke their own keys but
-- never read a hash back.

create table if not exists public.mcp_keys (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    key_hash text not null unique,
    label text not null default 'AI assistant' check (char_length(label) between 1 and 60),
    -- The phone's time zone when the key was made, so "today" means the
    -- person's today, not the server's.
    time_zone text not null default 'UTC' check (char_length(time_zone) <= 64),
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at timestamptz
);

create index if not exists mcp_keys_user_idx on public.mcp_keys (user_id);

alter table public.mcp_keys enable row level security;

drop policy if exists "Own keys are visible" on public.mcp_keys;
create policy "Own keys are visible" on public.mcp_keys
    for select to authenticated using (user_id = (select auth.uid()));

-- Columns a person may read: never the hash.
revoke all on public.mcp_keys from anon, authenticated;
grant select (id, label, time_zone, created_at, last_used_at, revoked_at) on public.mcp_keys to authenticated;

-- Makes a key and returns it, once. Up to 10 live keys per person.
create or replace function public.create_mcp_key(p_label text default 'AI assistant', p_time_zone text default 'UTC')
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    raw text;
begin
    if me is null then raise exception 'sign in first'; end if;
    if (select count(*) from public.mcp_keys where user_id = me and revoked_at is null) >= 10 then
        raise exception 'too many keys: revoke one first';
    end if;
    raw := 'hby_' || encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.mcp_keys (user_id, key_hash, label, time_zone)
    values (me, encode(extensions.digest(raw, 'sha256'), 'hex'),
            coalesce(nullif(left(trim(p_label), 60), ''), 'AI assistant'),
            coalesce(nullif(left(trim(p_time_zone), 64), ''), 'UTC'));
    return raw;
end;
$function$;

-- Stops a key working at once.
create or replace function public.revoke_mcp_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
    update public.mcp_keys set revoked_at = now()
    where id = p_id and user_id = auth.uid() and revoked_at is null;
end;
$function$;

revoke all on function public.create_mcp_key(text, text) from public, anon;
revoke all on function public.revoke_mcp_key(uuid) from public, anon;
grant execute on function public.create_mcp_key(text, text) to authenticated;
grant execute on function public.revoke_mcp_key(uuid) to authenticated;
