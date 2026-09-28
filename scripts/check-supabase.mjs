#!/usr/bin/env node
/**
 * Checks the live Supabase project against what the app actually needs.
 *
 * Two ways of asking, and it prefers the first:
 *
 *  1. Through the Management API, if a personal access token is available —
 *     from SUPABASE_ACCESS_TOKEN, or from the Supabase CLI's own login in the
 *     macOS keychain. This reads the catalog directly and can answer every
 *     question definitively.
 *  2. Otherwise with the publishable key alone, asking exactly what a phone in
 *     someone's pocket can ask. Once row-level security is in place that key is
 *     *meant* to be refused, so a refusal reads as a pass, not a failure.
 *
 *   node scripts/check-supabase.mjs
 */

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/* What the app sends and calls. Keep in step with lib/cloudMapping.ts. */
const TABLES = {
    habits: [
        'id', 'user_id', 'name', 'description', 'category', 'icon', 'is_goal', 'target_date',
        'goal_id', 'task_days', 'reminders', 'start_date', 'end_date', 'duration_minutes',
        'start_time', 'end_time', 'type', 'color', 'goal_period', 'goal_value', 'unit',
        'chart_type', 'is_archived', 'show_memo', 'frequency', 'week_interval', 'time_of_day',
        'graph_style', 'tracking_method', 'reminder_offset', 'location_reminders',
        'health_kit_metric', 'health_kit_target', 'ringtone', 'goal_spec',
        'reminder_message', 'recurrence',
        'created_at', 'updated_at', 'deleted_at',
    ],
    habit_completions: [
        'id', 'user_id', 'habit_id', 'date', 'value', 'memo', 'completed',
        'created_at', 'updated_at', 'skipped', 'evidence', 'deleted_at',
    ],
    tasks: [
        'id', 'user_id', 'title', 'description', 'due_date', 'due_time', 'estimated_minutes',
        'priority', 'goal_id', 'status', 'completed_at', 'source', 'external_id',
        'created_at', 'updated_at', 'deleted_at',
    ],
    // The social half. Each of these is useless without RLS, which is checked
    // separately below — a table here and no policy there is the bad case.
    feed_reactions: ['from_user', 'to_user', 'day', 'reaction', 'created_at'],
    feed_comments: ['id', 'author', 'to_user', 'day', 'body', 'created_at'],
    shared_tasks: ['id', 'task_id', 'owner_id', 'shared_with_id', 'status', 'created_at', 'deleted_at'],
    shared_completions: ['user_id', 'item_id', 'item_type', 'day', 'evidence', 'created_at'],
    user_blocks: ['blocker', 'blocked', 'created_at'],
    content_reports: ['id', 'reporter', 'reported_user', 'kind', 'reference', 'reason', 'created_at'],
};

/** Tables that must never be readable or writable without a matching policy. */
const GUARDED = [
    'feed_reactions', 'feed_comments', 'shared_tasks', 'shared_completions',
    'user_blocks', 'content_reports',
];

/** Called by live code paths only; lib/_premium is not reachable from the app. */
const FUNCTIONS = ['friend_stats', 'delete_my_account', 'blocked_between'];

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

/** The Supabase CLI's own login, so no token has to be stored twice. */
function keychainToken() {
    if (process.platform !== 'darwin') return null;
    try {
        const raw = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], {
            encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const value = raw.startsWith('go-keyring-base64:')
            ? Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString('utf8')
            : raw;
        return value.startsWith('sbp_') ? value : null;
    } catch {
        return null;
    }
}

const values = env();
const url = values.EXPO_PUBLIC_SUPABASE_URL;
const key = values.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) {
    console.error('No EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY in .env.local.');
    process.exit(1);
}
const token = values.SUPABASE_ACCESS_TOKEN || keychainToken();
const ref = new URL(url).hostname.split('.')[0];

let problems = 0;
const say = (ok, label, detail = '') => {
    if (!ok) problems += 1;
    console.log(`${ok ? '  ok ' : '  !! '} ${label}${detail ? ` — ${detail}` : ''}`);
};

const rest = (path, init) => fetch(`${url}${path}`, { headers: { apikey: key, 'Content-Type': 'application/json' }, ...init });

async function sql(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 120)}`);
    return response.json();
}

console.log(`\nChecking ${url}`);
console.log(token ? 'Reading the catalog directly.\n' : 'Using the app key only; pass SUPABASE_ACCESS_TOKEN for a fuller check.\n');

/* --------------------------------------------------------------- the schema */
console.log('Tables and columns the app writes');
if (token) {
    const wanted = Object.entries(TABLES).flatMap(([table, columns]) => columns.map(column => `('${table}','${column}')`)).join(',');
    const missing = await sql(`
        with wanted(t, c) as (values ${wanted})
        select w.t, w.c from wanted w
        left join information_schema.columns i
          on i.table_schema = 'public' and i.table_name = w.t and i.column_name = w.c
        where i.column_name is null order by 1, 2;
    `);
    for (const table of Object.keys(TABLES)) {
        const gaps = missing.filter(row => row.t === table).map(row => row.c);
        say(gaps.length === 0, table, gaps.length ? `missing ${gaps.join(', ')}` : `${TABLES[table].length} columns`);
    }
} else {
    for (const [table, columns] of Object.entries(TABLES)) {
        const response = await rest(`/rest/v1/${table}?select=id&limit=0`);
        if (response.status === 404) { say(false, table, 'the table does not exist'); continue; }
        if (response.status === 401 || response.status === 403) { say(true, table, 'protected, so its columns cannot be checked from here'); continue; }
        // A column that does not exist answers 400 even when the table is open.
        const missing = [];
        for (const column of columns) {
            const probe = await rest(`/rest/v1/${table}?select=${column}&limit=0`);
            if (probe.status === 400) missing.push(column);
        }
        say(missing.length === 0, table, missing.length ? `missing ${missing.join(', ')}` : `${columns.length} columns`);
    }
}

/* ------------------------------------------------------------ the functions */
console.log('\nFunctions the app calls');
if (token) {
    const found = await sql(`select proname from pg_proc where proname in (${FUNCTIONS.map(fn => `'${fn}'`).join(',')});`);
    const names = new Set(found.map(row => row.proname));
    for (const fn of FUNCTIONS) say(names.has(fn), fn, names.has(fn) ? '' : 'does not exist');
} else {
    for (const fn of FUNCTIONS) {
        const response = await rest(`/rest/v1/rpc/${fn}`, { method: 'POST', body: '{}' });
        // 404 here can mean missing, or simply not callable without signing in.
        say(response.status !== 404, fn, response.status === 404 ? 'not visible to the app key (missing, or signed-in only)' : '');
    }
}

/* -------------------------------------------------------------- the privacy */
console.log('\nWhat the app key can reach without signing in');
const email = await rest('/rest/v1/profiles?select=email&limit=1');
const leaked = email.ok && /@/.test(await email.clone().text());
say(!leaked, 'profiles.email', leaked ? 'READABLE BY ANYONE HOLDING THE APP KEY' : 'not readable');

for (const table of ['profiles', 'habits', 'tasks']) {
    const response = await rest(`/rest/v1/${table}?select=id&limit=1`);
    const open = response.ok && (await response.json()).length > 0;
    say(!open, `${table} rows`, open ? 'readable while signed out' : 'not readable');
}

/* -------------------------------------------------- the social tables' guards */
// These hold what one person wrote for another to read. A table with RLS off,
// or with no policy at all, is the failure worth catching before a release.
console.log('\nRow level security on what people write');
if (token) {
    const rows = await sql(`
        select c.relname as t, c.relrowsecurity as rls,
               (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in (${GUARDED.map(t => `'${t}'`).join(',')});
    `);
    for (const table of GUARDED) {
        const found = rows.find(row => row.t === table);
        if (!found) { say(false, table, 'the table does not exist'); continue; }
        const guarded = found.rls && Number(found.policies) > 0;
        say(guarded, table, guarded ? `${found.policies} policies` : found.rls ? 'RLS on but NO POLICIES' : 'RLS IS OFF');
    }
} else {
    for (const table of GUARDED) {
        const response = await rest(`/rest/v1/${table}?select=*&limit=1`);
        const open = response.ok && (await response.json()).length > 0;
        say(!open, `${table} rows`, open ? 'READABLE WHILE SIGNED OUT' : 'not readable');
    }
}

/* ---------------------------------------------------------------- the ways in */
console.log('\nSign-in');
const settings = await rest('/auth/v1/settings');
if (settings.ok) {
    const { external = {} } = await settings.json();
    for (const provider of ['email', 'apple', 'google']) say(!!external[provider], provider, external[provider] ? '' : 'not enabled');
    const google = await rest('/auth/v1/authorize?provider=google&redirect_to=habyss%3A%2F%2Fauth-callback');
    const body = google.ok ? '' : await google.text();
    say(!/missing OAuth secret/.test(body), 'google client secret', /missing OAuth secret/.test(body) ? 'not set' : '');
} else {
    say(false, 'auth service', `unreachable (${settings.status})`);
}

console.log(problems === 0
    ? '\nEverything the app needs is there, and nothing it should not be.\n'
    : `\n${problems} thing${problems === 1 ? '' : 's'} to fix. supabase/migrations/20260918_align_app_and_secure.sql covers the schema ones.\n`);
process.exit(problems === 0 ? 0 : 1);
