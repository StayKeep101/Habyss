-- King of the Week, the crew quest, secret missions and Exposed are gone from
-- the app (2026-11-03). This removes what served them on the server:
--   20261028000500_crew_quest.sql          crew_quest()
--   20261029000100_missions_and_king.sql   secret_missions, crew_challenges,
--                                           challenge_joins and their functions
--   20261029000300_exposed_challenges.sql  exposed_challenges, create_exposed,
--   20261030000100_exposed_boundaries.sql  act_on_exposed
-- Nothing else reads them: no trigger, view or other function refers to these
-- tables, and the desktop app only lists the names in an allowlist it never calls.
--
--   node scripts/apply-migration.mjs

drop function if exists public.crew_quest(date, date);
drop function if exists public.crew_consistency(date, date);
drop function if exists public.crew_king(date, date);
drop function if exists public.my_mission(date);
drop function if exists public.revealed_missions(date);
drop function if exists public.issue_challenge(date, text);
drop function if exists public.join_challenge(uuid, date);
drop function if exists public.crew_challenges_for(date);
drop function if exists public.create_exposed(text, text);
drop function if exists public.act_on_exposed(uuid, text, text);

drop table if exists public.challenge_joins;
drop table if exists public.crew_challenges;
drop table if exists public.secret_missions;
drop table if exists public.exposed_challenges;
