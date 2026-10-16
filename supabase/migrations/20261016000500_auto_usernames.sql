-- Two names: a display name friends see, and a unique @username to find you.
--
-- Every account gets a username the moment it is created, so nobody has to
-- claim one before Community works. It is made from the name the sign-in
-- provider gave (Apple, Google), or "user" and four digits when there is none
-- — never from an email address, which is private.
--
-- People can change it, but not constantly: the first change is free (the
-- generated one was not their choice), after that once every 30 days, so a
-- handle cannot be hopped between to impersonate someone.
--
--   node scripts/apply-migration.mjs

alter table public.profiles add column if not exists username_changed_at timestamptz;

/*
 * A free username built from `base`: lowercase letters, digits, dots and
 * underscores, 3–20 characters, with digits added until nobody has it.
 */
create or replace function public.generate_username(base text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
    stem text;
    candidate text;
    tries int := 0;
begin
    stem := lower(coalesce(base, ''));
    stem := translate(stem, 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
    stem := regexp_replace(stem, '[^a-z0-9]+', '', 'g');
    stem := left(stem, 15);
    if char_length(stem) < 3 then stem := 'user'; end if;

    candidate := stem;
    -- A bare name is used only if it is free and long enough to be a handle.
    while exists (select 1 from public.profiles where username = candidate) or candidate = 'user' loop
        tries := tries + 1;
        candidate := stem || lpad((floor(random() * 10000))::int::text, 4, '0');
        if tries > 50 then
            candidate := stem || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
            exit when not exists (select 1 from public.profiles where username = candidate);
        end if;
    end loop;
    return candidate;
end;
$$;
revoke all on function public.generate_username(text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
    given text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
begin
    insert into public.profiles (id, email, username, display_name)
    values (
        new.id,
        new.email,
        public.generate_username(given),
        nullif(left(btrim(coalesce(given, '')), 40), '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

-- Everyone who signed up before this gets one now.
update public.profiles p
   set username = public.generate_username(p.display_name)
 where p.username is null;

/*
 * The 30-day rule. Enforced here, not in the app, so no version of the app can
 * get around it. Service-role changes (support, cleanup) are not limited.
 */
create or replace function public.limit_username_changes()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
    if new.username is not distinct from old.username then
        return new;
    end if;
    if (select auth.uid()) is not null then
        if old.username_changed_at is not null and old.username_changed_at > now() - interval '30 days' then
            raise exception 'username_recently_changed: %', (old.username_changed_at + interval '30 days')::date
                using errcode = 'P0001';
        end if;
        new.username_changed_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_limit_username on public.profiles;
create trigger profiles_limit_username before update of username on public.profiles
    for each row execute function public.limit_username_changes();

grant select (username_changed_at) on public.profiles to authenticated;

notify pgrst, 'reload schema';
