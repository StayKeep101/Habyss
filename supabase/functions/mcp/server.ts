import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'
// The app's own repeat rule (no imports of its own), so a habit is due here exactly when it is due in the app.
import { PLANNING_TOOLS, planningRows, validateInput } from '../../../lib/mcpPlanning.ts'
import { matches, parseRecurrence } from '../../../lib/recurrence.ts'

/**
 * Habyss for AI assistants: a Model Context Protocol server (Streamable HTTP,
 * stateless, JSON responses), so Claude, ChatGPT or any MCP client can see
 * today's plan, add a task, tick a task or a habit — for one person.
 *
 * Who it is for comes from a personal key made in the app (Settings →
 * Integrations → AI assistants), sent as `Authorization: Bearer hby_…` or as
 * the last part of the URL (for clients that only take a URL). Only the key's
 * SHA-256 is stored (public.mcp_keys). The data is the person's cloud copy,
 * which the app keeps in sync; what an assistant adds reaches the phone on its
 * next sync, marked as coming from an assistant (source 'mcp').
 */

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id, accept',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }
type Person = { userId: string; timeZone: string }

const TOOLS = [
    {
        name: 'get_today',
        description: "Today's plan in Habyss: the habits due today (done or not) and the open tasks for today, including late ones. Use this first to see what the person has on.",
        inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD; defaults to today in the person\'s time zone' } } },
    },
    {
        name: 'list_tasks',
        description: 'Tasks in Habyss, most urgent first.',
        inputSchema: { type: 'object', properties: {
            status: { type: 'string', enum: ['open', 'done', 'all'], description: 'Default open' },
            limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 30' },
        } },
    },
    ...PLANNING_TOOLS,
    {
        name: 'complete_task',
        description: 'Marks a task done, by its id or its title.',
        inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, title: { type: 'string' } } },
    },
    {
        name: 'list_habits',
        description: 'Every active habit in Habyss, with its days, time and current streak of days done.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'log_habit',
        description: 'Marks a habit done for a day (today by default), by its id or its name.',
        inputSchema: { type: 'object', properties: {
            habit_id: { type: 'string' }, name: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' },
        } },
    },
]

const DATE = /^\d{4}-\d{2}-\d{2}$/

function localDate(timeZone: string, at = new Date()): string {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at) }
    catch { return at.toISOString().slice(0, 10) }
}
const shiftDate = (day: string, delta: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10) }
const weekday = (day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${day}T12:00:00Z`).getUTCDay()]

async function sha256(text: string): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function whoIs(admin: SupabaseClient, req: Request): Promise<Person | null> {
    const header = req.headers.get('authorization') ?? ''
    const fromHeader = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    const fromPath = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
    const key = fromHeader.startsWith('hby_') ? fromHeader : fromPath.startsWith('hby_') ? fromPath : ''
    // Signed in with Habyss (OAuth, Supabase Auth's OAuth server): the token is the
    // person's own access token. Claude and ChatGPT get it by "Connect", no key to copy.
    if (!key && fromHeader.split('.').length === 3) return await fromToken(admin, fromHeader)
    if (!/^hby_[0-9a-f]{48}$/.test(key)) return null
    const { data } = await admin.from('mcp_keys').select('id, user_id, time_zone, revoked_at').eq('key_hash', await sha256(key)).maybeSingle()
    if (!data || data.revoked_at) return null
    void admin.from('mcp_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => undefined)
    return { userId: data.user_id, timeZone: data.time_zone || 'UTC' }
}

/** A signed-in person's access token (issued through "Sign in with Habyss"), checked by Supabase Auth itself. */
async function fromToken(admin: SupabaseClient, token: string): Promise<Person | null> {
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user?.id) return null
    const { data: profile } = await admin.from('profiles').select('timezone').eq('id', data.user.id).maybeSingle()
    return { userId: data.user.id, timeZone: profile?.timezone || 'UTC' }
}

/**
 * Where an MCP client learns how to sign in (RFC 9728): the short public
 * address (MCP_PUBLIC_URL, e.g. https://mcp.habyss.app) serves the metadata,
 * and Supabase Auth is the authorization server behind it.
 */
const PUBLIC_URL = (Deno.env.get('MCP_PUBLIC_URL') ?? '').replace(/\/$/, '')
const unauthorized = () => new Response(JSON.stringify({ error: 'Sign in with Habyss to connect, or use a key from Habyss → Settings → Connected apps.' }), {
    status: 401,
    headers: {
        ...cors, 'Content-Type': 'application/json',
        'WWW-Authenticate': PUBLIC_URL ? `Bearer resource_metadata="${PUBLIC_URL}/.well-known/oauth-protected-resource"` : 'Bearer realm="habyss"',
    },
})

const scheduledOn = (habit: { task_days?: unknown; start_date?: string | null; end_date?: string | null; recurrence?: string | null }, day: string) => {
    if (habit.start_date && habit.start_date > day) return false
    if (habit.end_date && habit.end_date < day) return false
    // Every 2 weeks, the 1st of the month, 3 times a week: the rule the app repeats on.
    const rule = parseRecurrence(habit.recurrence)
    if (rule) return matches(rule, new Date(`${day}T12:00:00`), new Date(`${habit.start_date ?? day}T12:00:00`))
    const days = Array.isArray(habit.task_days) ? (habit.task_days as unknown[]).map(d => String(d).toLowerCase().slice(0, 3)) : []
    return days.length === 0 || days.includes(weekday(day))
}
const PRIORITY_NAME = ['', 'high', 'normal', 'low']

async function activeHabits(admin: SupabaseClient, person: Person) {
    const { data, error } = await admin.from('habits')
        .select('id, name, task_days, recurrence, start_date, end_date, start_time, end_time, goal_value, unit, is_goal, is_archived')
        .eq('user_id', person.userId).is('deleted_at', null).eq('is_goal', false).eq('is_archived', false)
    if (error) throw new Error(error.message)
    return data ?? []
}
async function doneOn(admin: SupabaseClient, person: Person, from: string, to: string) {
    const { data, error } = await admin.from('habit_completions').select('habit_id, date')
        .eq('user_id', person.userId).gte('date', from).lte('date', to).is('deleted_at', null).eq('completed', true).eq('skipped', false)
    if (error) throw new Error(error.message)
    return data ?? []
}
function findOne<T extends { id: string }>(rows: T[], id: unknown, name: unknown, label: (row: T) => string, kind: string): T {
    if (typeof id === 'string' && id) {
        const row = rows.find(r => r.id === id)
        if (!row) throw new Error(`No ${kind} with id ${id}.`)
        return row
    }
    const wanted = typeof name === 'string' ? name.trim().toLowerCase() : ''
    if (!wanted) throw new Error(`Give the ${kind}'s id or name.`)
    const exact = rows.filter(r => label(r).toLowerCase() === wanted)
    const matches = exact.length ? exact : rows.filter(r => label(r).toLowerCase().includes(wanted))
    if (matches.length === 1) return matches[0]
    if (!matches.length) throw new Error(`No ${kind} called "${name}".`)
    throw new Error(`Several ${kind}s match "${name}": ${matches.slice(0, 8).map(r => `"${label(r)}" (${r.id})`).join(', ')}. Use the id.`)
}

async function callTool(admin: SupabaseClient, person: Person, name: string, args: Record<string, unknown>): Promise<string> {
    const today = localDate(person.timeZone)
    switch (name) {
        case 'get_today': {
            const day = typeof args.date === 'string' && DATE.test(args.date) ? args.date : today
            const [habits, done, tasksRes] = await Promise.all([
                activeHabits(admin, person),
                doneOn(admin, person, day, day),
                admin.from('tasks').select('id, title, due_date, due_time, priority, estimated_minutes')
                    .eq('user_id', person.userId).is('deleted_at', null).eq('status', 'open').lte('due_date', day).order('due_date').limit(100),
            ])
            if (tasksRes.error) throw new Error(tasksRes.error.message)
            const doneIds = new Set(done.map(row => row.habit_id))
            const due = habits.filter(h => scheduledOn(h, day))
            const habitLines = due.map(h => `- ${doneIds.has(h.id) ? '[x]' : '[ ]'} ${h.name}${h.start_time ? ` at ${h.start_time}` : ''} (id ${h.id})`)
            const taskLines = (tasksRes.data ?? []).map(t => `- ${t.title}${t.due_date && t.due_date < day ? ` (late, due ${t.due_date})` : ''}${t.due_time ? ` at ${t.due_time}` : ''}, ${PRIORITY_NAME[t.priority] ?? 'normal'} priority${t.estimated_minutes ? `, ${t.estimated_minutes} min` : ''} (id ${t.id})`)
            return [`${day}: ${due.filter(h => doneIds.has(h.id)).length} of ${due.length} habits done, ${taskLines.length} open tasks.`,
                '', 'Habits:', ...(habitLines.length ? habitLines : ['- none due']), '', 'Tasks:', ...(taskLines.length ? taskLines : ['- none'])].join('\n')
        }
        case 'list_tasks': {
            const status = args.status === 'done' || args.status === 'all' ? args.status : 'open'
            const limit = Math.min(100, Math.max(1, Number(args.limit) || 30))
            let query = admin.from('tasks').select('id, title, due_date, due_time, priority, status, completed_at')
                .eq('user_id', person.userId).is('deleted_at', null)
            if (status !== 'all') query = query.eq('status', status)
            const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false }).order('priority').limit(limit)
            if (error) throw new Error(error.message)
            if (!data?.length) return `No ${status === 'all' ? '' : status + ' '}tasks.`
            return data.map(t => `- ${t.status === 'done' ? '[x]' : '[ ]'} ${t.title}${t.due_date ? ` · ${t.due_date}${t.due_date < today && t.status === 'open' ? ' (late)' : ''}` : ''}${t.due_time ? ` ${t.due_time}` : ''} · ${PRIORITY_NAME[t.priority] ?? 'normal'} (id ${t.id})`).join('\n')
        }
        case 'add_task':
        case 'add_habit':
        case 'add_goal':
        case 'create_roadmap': {
            const rows = planningRows(name, args, today, () => crypto.randomUUID())
            const { data, error } = await admin.rpc('mcp_create_plan', {
                p_user_id: person.userId, p_rows: rows,
                p_request_id: args.request_id ?? null, p_input: { name, args },
            })
            if (error) throw new Error(error.message)
            return JSON.stringify({ ...data, sync: 'Saved. Appears in Habyss on the next sync.' })
        }
        case 'list_goals': {
            validateInput(args, PLANNING_TOOLS.find(t => t.name === name)!.inputSchema)
            const { data, error } = await admin.from('habits').select('id, name, description, target_date, goal_spec')
                .eq('user_id', person.userId).eq('is_goal', true).eq('is_archived', false).is('deleted_at', null).order('created_at').limit(500)
            if (error) throw new Error(error.message)
            return JSON.stringify({ goals: data })
        }
        case 'get_roadmap': {
            validateInput(args, PLANNING_TOOLS.find(t => t.name === name)!.inputSchema)
            const goal = await admin.from('habits').select('*').eq('user_id', person.userId).eq('id', args.goal_id).eq('is_goal', true).is('deleted_at', null).maybeSingle()
            if (goal.error) throw new Error(goal.error.message)
            if (!goal.data) throw new Error('Goal not found in your account.')
            const results = await Promise.all([
                admin.from('goal_milestones').select('*').eq('user_id', person.userId).eq('goal_id', args.goal_id).is('deleted_at', null).order('position'),
                admin.from('habits').select('*').eq('user_id', person.userId).eq('goal_id', args.goal_id).is('deleted_at', null),
                admin.from('tasks').select('*').eq('user_id', person.userId).eq('goal_id', args.goal_id).is('deleted_at', null),
            ])
            for (const result of results) if (result.error) throw new Error(result.error.message)
            return JSON.stringify({ goal: goal.data, milestones: results[0].data, habits: results[1].data, tasks: results[2].data })
        }
        case 'complete_task': {
            const { data, error } = await admin.from('tasks').select('id, title, status').eq('user_id', person.userId).is('deleted_at', null).eq('status', 'open').limit(500)
            if (error) throw new Error(error.message)
            const task = findOne(data ?? [], args.task_id, args.title, t => t.title, 'open task')
            const now = new Date().toISOString()
            const update = await admin.from('tasks').update({ status: 'done', completed_at: now, updated_at: now }).eq('id', task.id).eq('user_id', person.userId)
            if (update.error) throw new Error(update.error.message)
            return `Done: "${task.title}".`
        }
        case 'list_habits': {
            const habits = await activeHabits(admin, person)
            if (!habits.length) return 'No habits yet.'
            const done = await doneOn(admin, person, shiftDate(today, -60), today)
            const byHabit = new Map<string, Set<string>>()
            for (const row of done) byHabit.set(row.habit_id, (byHabit.get(row.habit_id) ?? new Set()).add(row.date))
            return habits.map(h => {
                // Days in a row done, counting back from today (or yesterday, while today is still open).
                const days = byHabit.get(h.id) ?? new Set()
                let streak = 0
                for (let day = days.has(today) ? today : shiftDate(today, -1); ; day = shiftDate(day, -1)) {
                    if (!scheduledOn(h, day)) { if (day < shiftDate(today, -60)) break; continue }
                    if (!days.has(day)) break
                    streak++
                }
                const when = Array.isArray(h.task_days) && h.task_days.length && h.task_days.length < 7 ? (h.task_days as string[]).join(', ') : 'every day'
                return `- ${h.name}: ${when}${h.start_time ? ` at ${h.start_time}` : ''}, streak ${streak}, ${days.has(today) ? 'done today' : 'not done today'} (id ${h.id})`
            }).join('\n')
        }
        case 'log_habit': {
            const habits = await activeHabits(admin, person)
            const habit = findOne(habits, args.habit_id, args.name, h => h.name, 'habit')
            const day = typeof args.date === 'string' && DATE.test(args.date) ? args.date : today
            if (day > today) throw new Error('A habit cannot be done on a day that has not come yet.')
            const now = new Date().toISOString()
            const { error } = await admin.from('habit_completions').upsert({
                user_id: person.userId, habit_id: habit.id, date: day, completed: true, skipped: false,
                value: Number(habit.goal_value) > 0 ? Number(habit.goal_value) : 1, deleted_at: null, updated_at: now,
            }, { onConflict: 'user_id,habit_id,date' })
            if (error) throw new Error(error.message)
            return `Logged "${habit.name}" as done for ${day}.`
        }
        default:
            throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 })
    }
}

async function handle(admin: SupabaseClient, person: Person, message: Rpc) {
    const reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id ?? null, result })
    const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id: message.id ?? null, error: { code, message: text } })
    switch (message.method) {
        case 'initialize': {
            const asked = String(message.params?.protocolVersion ?? '')
            return reply({
                protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'habyss', title: 'Habyss', version: '1.1.0' },
                instructions: 'Habyss manages habits, tasks, goals and roadmaps. Start with get_today or list_goals. Use create_roadmap for a complete plan, with a request_id UUID reused on retries. Changes reach the app on its next sync. Dates use the account time zone.',
            })
        }
        case 'ping': return reply({})
        case 'tools/list': return reply({ tools: TOOLS })
        case 'tools/call': {
            const name = String(message.params?.name ?? '')
            const args = (message.params?.arguments ?? {}) as Record<string, unknown>
            if (!args || typeof args !== 'object' || Array.isArray(args)) return fail(-32602, 'arguments must be an object')
            try {
                return reply({ content: [{ type: 'text', text: await callTool(admin, person, name, args) }] })
            } catch (error) {
                const code = (error as { code?: number }).code
                if (code === -32602) return fail(code, (error as Error).message)
                // A tool that could not do it says why, so the assistant can tell the person.
                return reply({ content: [{ type: 'text', text: (error as Error).message }], isError: true })
            }
        }
        default:
            return fail(-32601, `Method not found: ${message.method}`)
    }
}

export async function serveRequest(req: Request, admin: SupabaseClient) {
    const origin = req.headers.get('origin')
    if (origin) {
        try {
            const url = new URL(origin)
            // Public remote clients may have any HTTPS origin. Local browser clients
            // may use HTTP loopback; opaque, malformed and insecure remote origins fail.
            if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) return json({ error: 'Invalid origin' }, 403)
        } catch { return json({ error: 'Invalid origin' }, 403) }
    }
    const version = req.headers.get('mcp-protocol-version')
    if (version && !PROTOCOL_VERSIONS.includes(version)) return json({ error: 'Unsupported MCP protocol version' }, 400)
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    // Stateless: no server-sent stream to open.
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...cors, Allow: 'POST' } })

    const person = await whoIs(admin, req)
    if (!person) return unauthorized()

    if (Number(req.headers.get('content-length')) > 1048576) return json({ error: 'Request too large' }, 413)
    let body: unknown
    try {
        const text = await req.text()
        if (text.length > 1048576) return json({ error: 'Request too large' }, 413)
        body = JSON.parse(text)
    } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400) }
    if (Array.isArray(body)) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch requests are not supported' } }, 400)
    const messages = [body] as Rpc[]
    const replies = []
    for (const message of messages) {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (message.id !== undefined && typeof message.id !== 'string' && typeof message.id !== 'number') || (message.params !== undefined && (!message.params || typeof message.params !== 'object' || Array.isArray(message.params)))) {
            replies.push({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } })
            continue
        }
        // Notifications (no id) get no reply.
        if (message.id === undefined) continue
        replies.push(await handle(admin, person, message))
    }
    if (!replies.length) return new Response(null, { status: 202, headers: cors })
    return json(replies[0])
}
