-- How often a habit comes round, in full.
--
-- Local schema v12 added `recurrence` — a rule from lib/recurrence as JSON —
-- because the older columns can say "these weekdays, every N weeks" and cannot
-- say "the third Sunday of every second month". It was left out of the sync
-- mapping while the server had no column for it, which means a habit restored
-- from a backup would come back as whatever the legacy columns alone describe.
--
-- Text rather than jsonb: the phone stores it as text, `parseRecurrence` is
-- what validates it, and a jsonb round trip would only reorder the keys.
--
-- Applied 2026-09-27.
--   node scripts/apply-migration.mjs supabase/migrations/20260927000300_habit_recurrence.sql

alter table public.habits
    add column if not exists recurrence text;

notify pgrst, 'reload schema';
