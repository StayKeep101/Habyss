#!/usr/bin/env node
/**
 * Runs a migration against the live project, through Supabase's Management API.
 *
 * Pasting six hundred lines of SQL into a dashboard is the kind of step that
 * gets half-done, so this does it in one call and then checks the result by
 * asking the database what it actually has.
 *
 * It needs a personal access token, which is NOT the key the app ships with:
 *   supabase.com/dashboard/account/tokens → Generate new token
 * Put it in .env.local, which is gitignored, and never anywhere else:
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *
 *   node scripts/apply-migration.mjs                      # the 20260918 one
 *   node scripts/apply-migration.mjs path/to/other.sql
 *
 * The token is read, used and never printed.
 */

import { readFileSync } from 'node:fs';

const DEFAULT_SQL = new URL('../supabase/migrations/20260918_align_app_and_secure.sql', import.meta.url);

function env() {
    const out = {};
    try {
        for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
            const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    } catch { /* fall through to the environment */ }
    return { ...out, ...process.env };
}

const values = env();
const token = values.SUPABASE_ACCESS_TOKEN;
const url = values.EXPO_PUBLIC_SUPABASE_URL;

if (!url) {
    console.error('No EXPO_PUBLIC_SUPABASE_URL in .env.local.');
    process.exit(1);
}
if (!token) {
    console.error(
        'No SUPABASE_ACCESS_TOKEN in .env.local.\n\n' +
        'Get one at supabase.com/dashboard/account/tokens (Generate new token),\n' +
        'add SUPABASE_ACCESS_TOKEN=sbp_... to .env.local, and run this again.\n\n' +
        'That token can change anything in your account, so it belongs only in\n' +
        '.env.local, which git ignores. It is never printed by this script.',
    );
    process.exit(1);
}

const ref = new URL(url).hostname.split('.')[0];
const file = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : DEFAULT_SQL;
const sql = readFileSync(file, 'utf8');

console.log(`Applying ${file.pathname.split('/').pop()} to project ${ref}`);
console.log(`${sql.split('\n').length} lines. It runs as one transaction, so it either all lands or none of it does.\n`);

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
});

const text = await response.text();
if (!response.ok) {
    console.error(`\nThe database refused it (${response.status}):\n${text.slice(0, 1200)}`);
    console.error('\nNothing was applied — the whole file is one transaction.');
    process.exit(1);
}

console.log('Applied.\n');
console.log('Checking what the database actually has now…\n');

const { spawnSync } = await import('node:child_process');
const check = spawnSync(process.execPath, [new URL('./check-supabase.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exit(check.status ?? 0);
