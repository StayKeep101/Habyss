# Phone and desktop data

The phone uses Supabase Auth and account-scoped rows, with SQLite for offline work. Desktop should use the same Supabase project and signed-in account, and the mappings in `lib/cloudMapping.ts`. Never ship a service-role key to either client. Goals are rows in `habits`; completion uniqueness is `(user_id, habit_id, date)`. Preserve UUIDs and soft deletions rather than recreating records on import.

`lib/cloudSync.ts` uploads dirty rows in batches of 200 and pulls pages of 1,000. Downloads now use a separate cursor per table and stable `(updated_at, id)` paging; failed local writes hold that table's cursor back. The first sync after this change deliberately rereads each table to initialize the new cursors. Existing indexes cover `(user_id, updated_at)` for habits, tasks, completions and goal milestones. Account isolation still depends on server RLS.

This is not yet a complete simultaneous-edit protocol. Unsent local edits win on the phone; uploads can overwrite edits from another device. Before desktop release, introduce server revisions and conditional writes so conflicts can be merged or presented explicitly. Both clients must implement that contract. `personal_backups` is currently a whole-document backup restored once per device, not live per-field sync for settings, Echo memory or focus totals. Move these into versioned records before treating them as live shared desktop state. The local consumed-Shards allowance also needs an authoritative server ledger before treating it as tamper-resistant across reinstalls/devices.

For growth, measure concurrent active devices and requests per action, not registered users alone. Keep subscriptions scoped to the signed-in account and visible social screens, debounce writes, paginate history, and test RLS/query plans with representative account sizes. Load-test sync and social fan-out, then size database compute and Realtime capacity from observed latency and traffic. Millions of users is a capacity target to validate, not something the current code proves.

References: https://supabase.com/docs/guides/platform/performance and https://supabase.com/docs/guides/realtime/reports
