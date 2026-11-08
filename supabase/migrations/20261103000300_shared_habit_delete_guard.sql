-- Somebody a habit is shared with cannot delete it for its owner.
--
-- A shared habit is one row, the owner's, and the people it is shared with may
-- edit it (habits_update allows can_view_habit). Until now only a goal's
-- deleted_at was kept from them, so a friend deleting their copy of a shared
-- habit uploaded that delete and the owner's habit vanished on their next
-- sync. Deleting it on their side now ends the share instead (the app closes
-- the share rows, lib/shareEnding.ts); this keeps the owner's row safe even
-- from an older build. Tasks already had this rule (keep_task_owner).
--
--   node scripts/apply-migration.mjs

create or replace function public.keep_habit_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.user_id := old.user_id;
    -- Only the owner deletes (or brings back) the row; anyone else on it edits.
    if (select auth.uid()) is distinct from old.user_id then
        new.deleted_at := old.deleted_at;
    end if;
    return new;
end;
$$;
