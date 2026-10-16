#!/usr/bin/env node
/**
 * Runs one SQL statement against the live project and prints the rows as JSON.
 * For looking, mostly. Changes to the schema belong in a migration file
 * applied with scripts/apply-migration.mjs, so they are recorded.
 *
 *   node scripts/sql.mjs "select count(*) from public.profiles"
 *   node scripts/sql.mjs @path/to/query.sql
 *
 * Uses SUPABASE_ACCESS_TOKEN from .env.local; the token is never printed.
 */
import { readFileSync } from 'node:fs';

const env = {};
try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
} catch { /* environment only */ }
const values = { ...env, ...process.env };
if (!values.SUPABASE_ACCESS_TOKEN || !values.EXPO_PUBLIC_SUPABASE_URL) {
    console.error('Needs SUPABASE_ACCESS_TOKEN and EXPO_PUBLIC_SUPABASE_URL in .env.local.');
    process.exit(1);
}
const arg = process.argv[2] ?? '';
const query = arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8') : arg;
const ref = new URL(values.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
});
const text = await response.text();
if (!response.ok) { console.error(`${response.status}: ${text.slice(0, 2000)}`); process.exit(1); }
console.log(text);
