-- Preserve Habyss's existing block boundaries for public-to-friends challenges.
drop policy if exists exposed_read on public.exposed_challenges;
create policy exposed_read on public.exposed_challenges for select to authenticated
  using (owner_id = auth.uid() or (
    not public.blocked_between(auth.uid(), owner_id)
    and (reviewer_id = auth.uid() or public.are_friends(owner_id))
  ));
create index if not exists exposed_challenges_updated on public.exposed_challenges(updated_at desc);
create or replace function public.act_on_exposed(p_id uuid, p_action text, p_proof text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.exposed_challenges; next_status text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into c from public.exposed_challenges where id = p_id for update;
  if not found then raise exception 'Challenge not found.'; end if;
  if auth.uid() <> c.owner_id and public.blocked_between(auth.uid(), c.owner_id) then
    raise exception 'This challenge is not available.';
  end if;
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

notify pgrst, 'reload schema';
