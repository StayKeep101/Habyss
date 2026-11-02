# Future synchronization boundary

No cloud synchronization, account, payments, subscriptions or remote AI APIs are implemented. The tracker must remain fully usable offline.

Intervals, applications and focus sessions have UUIDs; boundaries and update times are UTC. The schema is versioned. Device ownership is currently implicit in the single local database. Before sync, migrate to explicit owner/device IDs, logical revisions, a durable outbox and deletion tombstones. Existing records must remain readable throughout migration.

A future SyncService reads committed repository changes and writes reconciled records through repository transactions. It must never become the activity clock or require a network connection to commit local observations. An optional Supabase adapter belongs behind this boundary, with opt-in authentication, user-row isolation, encryption/retention decisions and visible sync health.

Raw activity intervals are device-owned observations, not habit completions. Preserve them per device and define cross-device overlap separately; never blindly sum simultaneous desktop/mobile use. Edits to app categories/settings need revision-aware conflict policies. Keep immutable interval history where practical; corrections should carry provenance. Deletions must propagate through tombstones without recreating erased history.

Mobile habits, goals, tasks and schedules retain their current ownership and IDs. A future mapping table links observations or declared focus sessions to a mobile task/project/goal with explicit user intent and provenance. Observing an application does not imply completing a habit or task. Window titles require a separate informed sync preference; local-only should remain the default.

Implementation prerequisites: inspect actual Habyss Mobile schema with authorization, define device registration and idempotent outbox delivery, design account removal and remote erasure, test offline/conflict cases, establish export/import/version compatibility, and document precise cross-device aggregation semantics.
