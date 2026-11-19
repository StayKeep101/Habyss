# mcp.<domain>: Habyss for AI assistants

A Cloudflare Worker that gives Habyss's MCP server a short address and a
"Sign in with Habyss" page, so people connect Claude or ChatGPT by pasting
`mcp.<domain>` and signing in. No key to copy or keep secret.

```
Claude / ChatGPT ──► mcp.<domain> (this Worker) ──► Supabase function `mcp`
        │                    │
        └── sign in ─────────┴──► Supabase Auth (OAuth 2.1 server) ──► /oauth/consent (this Worker)
```

The old key links keep working throughout.

## Switching it on (once)

Replace `<domain>` with yours everywhere below.

1. **Cloudflare** (the domain must use Cloudflare DNS):
   - In `wrangler.toml`, set `PUBLIC_URL = "https://mcp.<domain>"` and uncomment `routes` with `mcp.<domain>`.
   - `cd cloudflare/mcp-gateway`
   - `npx wrangler login`
   - `npx wrangler secret put SUPABASE_KEY`: paste the app's public key (`EXPO_PUBLIC_SUPABASE_KEY` in `.env.local`).
   - `npx wrangler deploy`
2. **Supabase dashboard**:
   - Authentication → OAuth Server: **enable**; Authorization Path `/oauth/consent`; allow dynamic client registration (Claude and ChatGPT register themselves).
   - Authentication → URL Configuration: **Site URL** `https://mcp.<domain>` (the consent page is Site URL + path), and add `https://mcp.<domain>/oauth/consent` to Redirect URLs.
   - Authentication → Providers: Apple and Google must work **on the web** for the sign-in page (Apple needs a Services ID and key; Google a web client ID). The app's native sign-in is unaffected.
3. **The server** knows its public address:
   - `npx supabase secrets set MCP_PUBLIC_URL=https://mcp.<domain>`
   - `npx supabase functions deploy mcp`
4. **The app** shows the short address instead of making keys:
   - `eas env:create --environment preview --name EXPO_PUBLIC_MCP_URL --value https://mcp.<domain> --visibility plaintext`
   - publish an update.

## Checking it

- `curl https://mcp.<domain>/.well-known/oauth-protected-resource`: names Supabase Auth.
- `curl -X POST https://mcp.<domain>` with no token: `401` and a `WWW-Authenticate` pointing at the line above.
- In Claude: Add custom connector → `mcp.<domain>` → Connect → sign in → Allow.
