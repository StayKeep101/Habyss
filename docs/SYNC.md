# How Habyss keeps every device the same

The model is Notion's: every device keeps a local copy (instant, works offline), the server is the source of truth,
and when anything changes the server tells the account's other devices so they fetch just that change. The phone,
the Mac and any later client show the same thing within a second or two.

## The loop

1. **Edit locally.** The change is saved on the device at once and queued.
2. **Push.** The queue goes up (debounced, so a burst of edits is one push).
3. **Signal.** A statement-level trigger on every synced table sends one tiny Broadcast message, `changed` with the
   table's name and no data, to the account's private channel `sync:<user id>`
   (`supabase/migrations/20261126000200_realtime_sync.sql`). Only that account may listen (policy on
   `realtime.messages`). A bulk edit of 300 rows is one message.
4. **Pull.** Each other device, on the signal (debounced), fetches what changed since its cursor, using the
   `(user_id, updated_at)` indexes. On opening, a device pulls once to catch what it missed while closed.

No polling: a device that is open and idle makes no requests.

## Why it holds up at very large scale

- **Broadcast, not Postgres Changes.** Postgres Changes checks every change against every listener's row security in a
  single process and is documented not to scale to large audiences. Broadcast sends one message to one private topic.
- **Signals carry no data.** Payloads stay tiny, nothing private travels on the socket, and a missed signal is harmless
  (the next pull catches up).
- **Everything is per account.** Every sync query is `where user_id = …` on an indexed keyset, and no sync path reads
  another account's rows, so the data can be split by account across databases as the user base grows. (No single
  database serves a hundred million people; this design lets them be split without changing the apps.)
- **Latest edit wins, per row** (habits, tasks, check-ins) **and per setting** (`day_inputs`), by server time, so two
  devices editing different things never overwrite each other.

## What is synced

`packages/schema/src/tables.json` (generated from the database by `scripts/pull-schema.mjs`) lists the synced tables;
`contract.json` says what both apps upload. Each app's contract tests check its mapping against it, and each app's
live-sync test checks that every synced table signals and is listened to.

## Next

- One request per pull and one per push for all tables (a `sync_pull(cursors)` / `sync_push(batch)` pair of RPCs),
  instead of one request per table.
- Every remaining personal store (settings, Echo, check-ins, the brain dump, logs, focus) moved from the whole-document
  backup to per-key live sync like `day_inputs`, each listed in the contract as synced or device-only.
- One way to build a day (`packages/core` `planDay`) used by both apps, so the same data always gives the same timeline.
