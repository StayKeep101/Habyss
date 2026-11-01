-- Public-to-friends commitments. Proof and a reviewer are agreed BEFORE starting.
create table if not exists public.exposed_challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 160),
  proof_method text not null check (length(trim(proof_method)) between 5 and 500),
  proof text check (length(proof) <= 2000),
  status text not null default 'proposed' check (status in ('proposed','active','claimed','exposed','submitted','verified','lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewer_id is null or reviewer_id <> owner_id)
);
alter table public.exposed_challenges enable row level security;
create policy exposed_read on public.exposed_challenges for select to authenticated
  using (owner_id = auth.uid() or reviewer_id = auth.uid() or public.are_friends(owner_id));
revoke all on public.exposed_challenges from anon, authenticated;
grant select on public.exposed_challenges to authenticated;

create or replace function public.create_exposed(p_title text, p_method text)
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to make a commitment.'; end if;
  if (select count(*) from public.exposed_challenges where owner_id = auth.uid() and status not in ('verified','lost')) >= 10 then
    raise exception 'Finish an existing challenge before opening another.';
  end if;
  insert into public.exposed_challenges(owner_id,title,proof_method)
    values(auth.uid(),trim(p_title),trim(p_method)) returning id into result;
  return result;
end $$;

create or replace function public.act_on_exposed(p_id uuid, p_action text, p_proof text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.exposed_challenges; next_status text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into c from public.exposed_challenges where id = p_id for update;
  if not found then raise exception 'Challenge not found.'; end if;
  if p_action = 'accept' and c.status = 'proposed' and auth.uid() <> c.owner_id and public.are_friends(c.owner_id) then
    update public.exposed_challenges set reviewer_id = auth.uid(), status = 'active', updated_at = now() where id = p_id;
    return;
  end if;
  if p_action = 'claim' and c.status = 'active' and auth.uid() = c.owner_id then next_status := 'claimed';
  elsif p_action = 'expose' and c.status = 'claimed' and auth.uid() = c.reviewer_id then next_status := 'exposed';
  elsif p_action = 'submit' and c.status in ('claimed','exposed') and auth.uid() = c.owner_id then
    if p_proof is null or length(trim(p_proof)) < 5 or length(p_proof) > 2000 then raise exception 'Add the agreed proof (5–2000 characters).'; end if;
    next_status := 'submitted';
  elsif p_action = 'verify' and c.status = 'submitted' and auth.uid() = c.reviewer_id then next_status := 'verified';
  elsif p_action = 'reject' and c.status = 'submitted' and auth.uid() = c.reviewer_id then next_status := 'exposed';
  elsif p_action = 'concede' and c.status in ('active','claimed','exposed','submitted') and auth.uid() = c.owner_id then next_status := 'lost';
  else raise exception 'This action is no longer available. Refresh the challenge.';
  end if;
  update public.exposed_challenges set status = next_status,
    proof = case when p_action = 'submit' then trim(p_proof) else proof end, updated_at = now() where id = p_id;
end $$;
revoke all on function public.create_exposed(text,text) from public, anon;
revoke all on function public.act_on_exposed(uuid,text,text) from public, anon;
grant execute on function public.create_exposed(text,text) to authenticated;
grant execute on function public.act_on_exposed(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
