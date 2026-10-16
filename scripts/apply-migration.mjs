#!/usr/bin/env node
/**
 * Applies database migrations to the live project, in order, and records each
 * one in Supabase's own history table (supabase_migrations.schema_migrations)
 * so the database always knows exactly what it has — the same table the
 * Supabase CLI reads, so `supabase migration list` agrees with this script.
 *
 * Each migration and its history row run as one transaction: it either lands
 * and is recorded, or neither happens.
 *
 *   node scripts/apply-migration.mjs                 apply every pending migration
 *   node scripts/apply-migration.mjs --status        list applied and pending
 *   node scripts/apply-migration.mjs <file.sql>      apply one file (if pending)
 *   node scripts/apply-migration.mjs --baseline <version>
 *        record every migration up to <version> as applied without running it
 *        (for a database that already has them, set up before history was kept)
 *
 * Files live in supabase/migrations as <14-digit version>_<name>.sql.
 * Needs SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens) in
 * .env.local, which git ignores. The token is never printed.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DIR = new URL('../supabase/migrations/', import.meta.url).pathname;

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
if (!url || !token) {
    console.error('Needs EXPO_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env.local.');
    process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];

async function query(sql) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`(${response.status}) ${text.slice(0, 1500)}`);
    return text ? JSON.parse(text) : [];
}

const literal = value => `'${String(value).replace(/'/g, "''")}'`;

/** Every migration file, oldest first. */
function migrations() {
    return readdirSync(DIR)
        .filter(file => /^\d{14}_.+\.sql$/.test(file))
        .sort()
        .map(file => ({ file, version: file.slice(0, 14), name: file.slice(15, -4) }));
}

async function applied() {
    const rows = await query('select version from supabase_migrations.schema_migrations');
    return new Set(rows.map(row => row.version));
}

const record = migration =>
    `insert into supabase_migrations.schema_migrations (version, name, statements)
     values (${literal(migration.version)}, ${literal(migration.name)}, array[]::text[])
     on conflict (version) do nothing;`;

async function apply(migration) {
    const sql = readFileSync(join(DIR, migration.file), 'utf8');
    process.stdout.write(`Applying ${migration.file} … `);
    await query(`begin;\n${sql}\n;\n${record(migration)}\ncommit;`);
    console.log('done');
}

const args = process.argv.slice(2);
const all = migrations();
const done = await applied();

if (args[0] === '--status') {
    for (const migration of all) console.log(`${done.has(migration.version) ? 'applied' : 'PENDING'}  ${migration.file}`);
    process.exit(0);
}

if (args[0] === '--baseline') {
    const upTo = args[1];
    if (!/^\d{14}$/.test(upTo ?? '')) { console.error('Usage: --baseline <14-digit version>'); process.exit(1); }
    const marked = all.filter(migration => migration.version <= upTo && !done.has(migration.version));
    if (marked.length) await query(`begin;\n${marked.map(record).join('\n')}\ncommit;`);
    console.log(`Recorded ${marked.length} migration(s) as already applied, up to ${upTo}.`);
    process.exit(0);
}

const chosen = args[0]
    ? all.filter(migration => migration.file === basename(args[0]))
    : all.filter(migration => !done.has(migration.version));

if (args[0] && chosen.length === 0) { console.error(`No migration named ${basename(args[0])} in supabase/migrations.`); process.exit(1); }
const pending = chosen.filter(migration => !done.has(migration.version));
if (pending.length === 0) { console.log('Nothing to apply: the database is up to date.'); process.exit(0); }

for (const migration of pending) {
    try {
        await apply(migration);
    } catch (error) {
        console.error(`\nThe database refused ${migration.file}:\n${error.message}`);
        console.error('\nNothing from that file was applied. Later migrations were not attempted.');
        process.exit(1);
    }
}

console.log('\nChecking what the database actually has now…\n');
const check = spawnSync(process.execPath, [new URL('./check-supabase.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exit(check.status ?? 0);
