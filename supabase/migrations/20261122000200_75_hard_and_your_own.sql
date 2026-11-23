-- 75 Hard, and challenges you write yourself.
--
-- Habyss offers one challenge for now: 75 Hard. Seventy-five days, six rules a
-- day, no cheat days: miss one rule on one day and it is over (start again from
-- day one). Every other challenge in the list stops being offered; runs already
-- going carry on to their end.
--
-- Anyone can write their own: a name, how many days (7 to 75) and its rules
-- (one to eight habits, each proven by a photo or on your word). It is yours
-- and your friends' to start and to be invited to. A challenge you wrote pays
-- no Shards (nothing for a rule you set yourself): the reward is finishing it.
--
--   node scripts/apply-migration.mjs supabase/migrations/20261122000200_75_hard_and_your_own.sql

alter table public.challenge_catalog add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.challenge_catalog add column if not exists created_at timestamptz not null default now();

-- Habyss's list: only 75 Hard.
update public.challenge_catalog set active = false where owner_id is null and id <> '75-hard';
insert into public.challenge_catalog (id, title, summary, icon, difficulty, days, reward, items, sort, active) values
  ('75-hard', '75 Hard', 'Seventy-five days. Six rules, every day. No cheat days, no substitutions: miss one rule once and it is over.', 'flame', 'hard', 75, 3000,
   '[{"kind":"habit","name":"Two workouts, 45 min each","icon":"barbell","proof":"health","metric":"exercise","target":90,"unit":"minutes"},
     {"kind":"habit","name":"One of them outdoors","icon":"sunny","proof":"photo"},
     {"kind":"habit","name":"Follow your diet, no alcohol","icon":"nutrition","proof":"tick"},
     {"kind":"habit","name":"Drink a gallon of water","icon":"water","proof":"tick"},
     {"kind":"habit","name":"Read 10 pages","icon":"book","proof":"focus","minutes":15},
     {"kind":"habit","name":"Progress photo","icon":"camera","proof":"photo"}]', 0, true)
on conflict (id) do update set title = excluded.title, summary = excluded.summary, icon = excluded.icon, difficulty = excluded.difficulty,
    days = excluded.days, reward = excluded.reward, items = excluded.items, sort = excluded.sort, active = true;

-- Read: Habyss's list, and the challenges you and your friends wrote.
drop policy if exists challenge_catalog_read on public.challenge_catalog;
create policy challenge_catalog_read on public.challenge_catalog for select to authenticated
    using (active and (owner_id is null or owner_id = (select auth.uid()) or public.are_friends(owner_id)));

create or replace function public.create_challenge(p_title text, p_summary text, p_icon text, p_days integer, p_items jsonb)
returns text
language plpgsql security definer set search_path to ''
as $$
declare
    me uuid := (select auth.uid());
    made text := 'u-' || replace(gen_random_uuid()::text, '-', '');
    item jsonb;
begin
    if me is null then raise exception 'Sign in to make a challenge.'; end if;
    if length(btrim(coalesce(p_title, ''))) not between 1 and 60 then raise exception 'Give it a name.'; end if;
    if p_days is null or p_days < 7 or p_days > 75 then raise exception 'Between 7 and 75 days.'; end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 8 then raise exception 'Between one and eight rules.'; end if;
    for item in select * from jsonb_array_elements(p_items) loop
        if length(btrim(coalesce(item ->> 'name', ''))) not between 1 and 80 then raise exception 'Every rule needs a name.'; end if;
        if coalesce(item ->> 'proof', '') not in ('photo', 'tick') then raise exception 'Each rule is proven by a photo or on your word.'; end if;
    end loop;
    if (select count(*) from public.challenge_catalog where owner_id = me and active) >= 20 then raise exception 'You have twenty of your own already.'; end if;
    insert into public.challenge_catalog (id, title, summary, icon, difficulty, days, reward, items, sort, active, owner_id)
        values (made, btrim(p_title), coalesce(nullif(btrim(p_summary), ''), 'A challenge written by a friend.'), coalesce(nullif(p_icon, ''), 'trophy'),
                case when p_days >= 30 then 'hard' when p_days >= 14 then 'medium' else 'easy' end, p_days, 0,
                (select jsonb_agg(jsonb_build_object('kind', 'habit', 'name', btrim(e ->> 'name'), 'icon', coalesce(e ->> 'icon', 'checkmark-circle'), 'proof', e ->> 'proof'))
                   from jsonb_array_elements(p_items) e),
                100, true, me);
    return made;
end;
$$;
revoke all on function public.create_challenge(text, text, text, integer, jsonb) from public, anon;
grant execute on function public.create_challenge(text, text, text, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';
