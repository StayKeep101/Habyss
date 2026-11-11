-- A habit held before or after an event or meal by name (lib/habitAnchor.ts):
-- {"to":"Accounting","side":"before","gap":0}. On a day the class is on the
-- calendar the timeline places the habit against it; other days it is flexible.
-- Until this is applied the app backs up without the column (lib/cloudSync.ts).
alter table public.habits add column if not exists anchor jsonb;
notify pgrst, 'reload schema';
