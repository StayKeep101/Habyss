# Connect an assistant to Habyss

In Habyss, open **Settings → Connected apps → Connect an assistant**. Copy the
address shown once and add it to the agent as a remote **Streamable HTTP MCP**
server. Choose no additional authentication when using that full address: the
last segment is a personal credential. Disconnecting its key in Habyss revokes
access immediately. Existing keys also have the new planning tools.

For clients that support custom headers, use the base endpoint
`https://<project>.supabase.co/functions/v1/mcp` with
`Authorization: Bearer <your hby_ key>` instead. Keep addresses and keys private.
Never put them in a repository or diagnostic logs.

The server supports protocol revisions 2025-11-25, 2025-06-18 and 2025-03-26,
with JSON responses and no session state. It does not provide legacy SSE,
local stdio, or an OAuth authorization flow. OAuth-only connectors cannot use
this personal-key integration. Client support for remote servers can depend
on the client's account or organization settings.

Try: “Plan my week: the tasks to launch my project, and a daily habit to keep
it moving.” An agent discovers the schemas using `tools/list`.

| Tool | Result |
| --- | --- |
| `get_today` | Due habits and dated open tasks, including overdue tasks |
| `list_tasks`, `list_habits` | Existing items and their IDs |
| `add_task` | Task with optional subtasks; defaults to 90 minutes |
| `add_habit` | Recurring habit; defaults to daily, 30 minutes |
| `complete_task`, `log_habit` | Record completion |

Dates are calendar dates, and defaults use the time zone recorded when the key
was created.

Supply a UUID `request_id` on creation tools and reuse it with identical
arguments if a request times out. The database returns the first result rather
than creating duplicates, including for concurrent retries. Reusing the UUID
with changed arguments returns an error. Requests are limited to 1 MiB.
Invalid inputs fail before writing; database failures write nothing.

Changes are saved to the account's cloud data. Habyss downloads them on its next
sync (including foreground sync, which is throttled to once per three minutes).
For an immediate refresh, use **Settings → Account → Back up now**. A local device
must be signed into the same account and online. MCP access does not grant
access to other users' shared habits or tasks.

## Verification and deployment

- `npx jest lib/__tests__/mcpPlanning.test.ts lib/__tests__/mcpKeys.test.ts --runInBand`
- `deno check supabase/functions/mcp/index.ts`
- `npm run validate`
- Apply only `20261103000300_mcp_planning.sql` with `scripts/apply-migration.mjs`.
- Deploy `mcp` with Supabase CLI and the linked project; `supabase/config.toml`
  disables gateway JWT verification because the endpoint verifies its own keys.
- `node scripts/check-mcp.mjs` exercises the deployed endpoint using temporary
  users, then deletes them in `finally`. It requires the management token in
  `.env.local`; it never prints credentials or uses existing users' data.
- Optionally set `MCP_SDK_PATH` to an installed `@modelcontextprotocol/sdk`
  directory to additionally test the official client's HTTP handshake and calls.

The live checks cover discovery, both authentication forms, standalone creation,
completions, concurrent retries, account isolation, privileged RPC
permissions, rollback and revocation. Unit tests check app sync mappings.
Physical-device rendering and every third-party agent UI still require manual QA.
