#!/usr/bin/env node
/** Live integration test. Creates only temporary test users and removes them in finally.
 * Credentials come from .env.local and are never logged. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const env = { ...Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').flatMap(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    return m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : [];
})), ...process.env };
const url = env.EXPO_PUBLIC_SUPABASE_URL, ref = new URL(url).hostname.split('.')[0];
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } });
if (!response.ok) throw new Error(`Cannot obtain test credentials (${response.status})`);
const keys = await response.json();
const service = keys.find(k => k.name === 'service_role')?.api_key;
const anon = keys.find(k => k.name === 'anon')?.api_key;
assert(service && anon, 'Required API keys unavailable');
const admin = createClient(url, service, { auth: { persistSession: false } });
const users = [];
let rpcId = 0;
try {
    async function account() {
        const email = `mcp-test-${randomUUID()}@example.invalid`, password = randomUUID();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (created.error) throw created.error;
        users.push(created.data.user.id);
        const client = createClient(url, anon, { auth: { persistSession: false } });
        const signed = await client.auth.signInWithPassword({ email, password });
        if (signed.error) throw signed.error;
        const key = await client.rpc('create_mcp_key', { p_label: 'MCP integration test', p_time_zone: 'America/Toronto' });
        if (key.error) throw key.error;
        return { client, key: key.data, user: created.data.user.id };
    }
    const a = await account(), b = await account();
    if (process.env.MCP_SDK_PATH) {
        const root = process.env.MCP_SDK_PATH;
        const { Client } = await import(`${root}/dist/esm/client/index.js`);
        const { StreamableHTTPClientTransport } = await import(`${root}/dist/esm/client/streamableHttp.js`);
        const client = new Client({ name: 'habyss-sdk-test', version: '1.0.0' });
        try {
            await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/functions/v1/mcp/${a.key}`)));
            assert((await client.listTools()).tools.some(t => t.name === 'create_roadmap'));
            const result = await client.callTool({ name: 'add_task', arguments: { title: 'SDK-created task' } });
            assert(!result.isError);
            console.log('PASS official MCP SDK connection, discovery and tool invocation');
        } finally { await client.close(); }
    }
    async function rpc(account, method, params = {}, path = false) {
        const res = await fetch(`${url}/functions/v1/mcp${path ? '/' + account.key : ''}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
                ...(path ? {} : { Authorization: `Bearer ${account.key}` }) },
            body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
        });
        assert.equal(res.status, 200, `HTTP ${res.status}`);
        const body = await res.json();
        assert(!body.error, JSON.stringify(body.error));
        return body.result;
    }
    async function call(account, name, args = {}, expectError = false) {
        const result = await rpc(account, 'tools/call', { name, arguments: args });
        assert.equal(!!result.isError, expectError, result.content?.[0]?.text);
        return result.content[0].text;
    }
    const init = await rpc(a, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'habyss-test', version: '1' } }, true);
    assert.equal(init.protocolVersion, '2025-11-25');
    const tools = (await rpc(a, 'tools/list')).tools.map(t => t.name);
    for (const name of ['add_task', 'add_habit', 'add_goal', 'create_roadmap', 'list_goals', 'get_roadmap']) assert(tools.includes(name));
    console.log('PASS initialization, URL key, bearer key, tool discovery');
    const args = { request_id: randomUUID(), goal: { name: 'MCP test project' }, milestones: [
        { title: 'First milestone', tasks: [{ title: 'Draft', subtasks: ['Write', 'Review'] }] },
        { title: 'Second milestone', tasks: [{ title: 'Publish' }] },
    ], habits: [{ name: 'Daily practice', goal_value: 20, unit: 'minutes' }], tasks: [{ title: 'Research' }] };
    const plan = JSON.parse(await call(a, 'create_roadmap', args));
    const goalId = plan.habits[0].id, habitId = plan.habits[1].id, taskId = plan.tasks[0].id;
    const read = JSON.parse(await call(a, 'get_roadmap', { goal_id: goalId }));
    assert.equal(read.milestones.length, 2); assert.equal(read.tasks.length, 3); assert.equal(read.habits.length, 1);
    assert.equal(read.tasks.find(t => t.id === taskId).milestone_id, read.milestones[0].id);
    assert.equal(read.tasks.find(t => t.id === taskId).subtasks.length, 2);
    const [retry1, retry2] = await Promise.all([call(a, 'create_roadmap', args), call(a, 'create_roadmap', args)]);
    assert.deepEqual(JSON.parse(retry1), plan); assert.deepEqual(JSON.parse(retry2), plan);
    await call(a, 'create_roadmap', { ...args, goal: { name: 'Different' } }, true);
    console.log('PASS atomic roadmap creation, readback, nested links, concurrent retries');
    await call(a, 'add_task', { title: 'Standalone task', goal_id: goalId });
    await call(a, 'add_habit', { name: 'Standalone habit', goal_id: goalId });
    await call(a, 'add_goal', { name: 'Read books', kind: 'number', target: 12, unit: 'books' });
    await call(a, 'complete_task', { task_id: taskId });
    await call(a, 'log_habit', { habit_id: habitId });
    for (const name of ['get_today', 'list_tasks', 'list_habits', 'list_goals']) await call(a, name);
    console.log('PASS standalone creates, task completion, habit logging, plan reads');
    await call(b, 'get_roadmap', { goal_id: goalId }, true);
    await call(b, 'add_task', { title: 'Forbidden', goal_id: goalId }, true);
    await call(b, 'add_habit', { name: 'Forbidden', goal_id: goalId }, true);
    await call(a, 'add_task', { title: 'Bad date', due_date: '2026-02-30' }, true);
    const forbidden = await b.client.rpc('mcp_create_plan', { p_user_id: a.user, p_rows: {} });
    assert(forbidden.error, 'Authenticated client must not call privileged RPC');
    // A deliberately invalid last task must roll back the already-inserted goal.
    const rollbackId = randomUUID();
    const rollback = await admin.rpc('mcp_create_plan', { p_user_id: a.user, p_rows: {
        habits: [{ ...plan.habits[0], id: rollbackId }], milestones: [],
        tasks: [{ ...plan.tasks[0], id: randomUUID(), goal_id: b.user }],
    } });
    assert(rollback.error);
    const absent = await admin.from('habits').select('id').eq('id', rollbackId);
    assert.equal(absent.data.length, 0);
    console.log('PASS cross-account isolation, RPC permissions, validation, transaction rollback');
    const listed = await a.client.from('mcp_keys').select('id').eq('label', 'MCP integration test');
    assert.equal(listed.data.length, 1);
    const revoked = await a.client.rpc('revoke_mcp_key', { p_id: listed.data[0].id });
    assert(!revoked.error);
    const denied = await fetch(`${url}/functions/v1/mcp/${a.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
    assert.equal(denied.status, 401);
    console.log('PASS immediate key revocation');
} finally {
    for (const id of users) {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error) throw new Error(`Temporary account cleanup failed: ${id}`);
    }
    console.log('Temporary test accounts removed');
}
