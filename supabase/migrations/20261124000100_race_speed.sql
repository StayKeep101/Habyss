-- Race the clock: faster pays more. A win done in half the time or less adds
-- as much again as the stake (up to 500), shrinking evenly to nothing at the
-- clock. A new ledger reason, 'speed', carries it.

alter table public.shards_ledger drop constraint if exists shards_ledger_reason_check;
alter table public.shards_ledger add constraint shards_ledger_reason_check
    check (reason in ('stake', 'payout', 'refund', 'unlock', 'challenge', 'match', 'speed'));

create or replace function public.pay_race(p_race uuid, p_won boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    r public.races;
    win_side text := case when p_won then 'for' else 'against' end;
    win_total integer;
    lose_total integer;
    owner_gets integer := 0;
    who text;
    used numeric;
    speed integer := 0;
begin
    select * into r from public.races where id = p_race for update;
    if not found or r.status <> 'open' then return; end if;

    select coalesce(sum(amount) filter (where side = win_side), 0),
           coalesce(sum(amount) filter (where side <> win_side), 0)
      into win_total, lose_total
      from public.race_bets where race_id = p_race;

    if p_won then
        -- Faster pays more: in half the time or less, as much again as the stake (up to 500);
        -- then less, evenly, to nothing at the clock (lib/races.ts speedBonus, the same sum).
        used := least(1, greatest(0, extract(epoch from (now() - r.starts_at)) / greatest(1, extract(epoch from (r.ends_at - r.starts_at)))));
        speed := least(500, round(r.stake * least(1, greatest(0, 2 * (1 - used)))))::int;
        -- Your stake back, Habyss's match, the speed bonus, and the bets against you when nobody backed you.
        owner_gets := r.stake + r.match + speed + case when win_total = 0 then lose_total else 0 end;
        insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, r.stake, 'refund', r.id);
        if r.match > 0 then insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, r.match, 'match', r.id); end if;
        if speed > 0 then insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, speed, 'speed', r.id); end if;
        if win_total = 0 and lose_total > 0 then
            insert into public.shards_ledger (user_id, amount, reason, race_id) values (r.owner_id, lose_total, 'payout', r.id);
            update public.race_bets set payout = 0 where race_id = p_race;
        else
            update public.race_bets
               set payout = case when side = win_side then amount + (lose_total::bigint * amount / win_total)::int else 0 end
             where race_id = p_race;
        end if;
    else
        -- Missed: your stake joins the pool of those who bet against you.
        lose_total := lose_total + r.stake;
        if win_total = 0 then
            -- Nobody against you: friends who backed you get theirs back; your stake is gone.
            update public.race_bets set payout = amount where race_id = p_race;
        else
            update public.race_bets
               set payout = case when side = win_side then amount + (lose_total::bigint * amount / win_total)::int else 0 end
             where race_id = p_race;
        end if;
    end if;
    insert into public.shards_ledger (user_id, amount, reason, race_id)
        select user_id, payout, case when payout = amount then 'refund' else 'payout' end, p_race
          from public.race_bets where race_id = p_race and payout > 0;
    update public.races set status = case when p_won then 'won' else 'missed' end, payout = owner_gets, settled_at = now() where id = p_race;

    select coalesce(nullif(btrim(display_name), ''), username, 'Your friend') into who from public.profiles where id = r.owner_id;
    insert into public.notifications (user_id, from_user_id, type, title, body)
        values (r.owner_id, r.owner_id, 'market',
                case when p_won then 'You beat the clock' else 'The clock won' end,
                r.title || ': ' || case when p_won then '+' || (owner_gets - r.stake) || ' Shards' else '−' || r.stake || ' Shards' end);
    insert into public.notifications (user_id, from_user_id, type, title, body)
        select b.user_id, r.owner_id, 'market', who || case when p_won then ' beat the clock' else ' ran out of time' end,
               r.title || ': ' || case when b.payout > b.amount then '+' || (b.payout - b.amount) || ' Shards'
                                      when b.payout = b.amount then 'your Shards are back'
                                      else '−' || b.amount || ' Shards' end
          from public.race_bets b where b.race_id = p_race;
end;
$$;
revoke all on function public.pay_race(uuid, boolean) from public, anon, authenticated;
