import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'
// The app's own repeat rule (no imports of its own), so a habit is due here exactly when it is due in the app.
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

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
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
    {
        name: 'add_task',
        description: 'Adds a task to Habyss. It appears in the app on its next sync.',
        inputSchema: { type: 'object', required: ['title'], properties: {
            title: { type: 'string', description: 'What to do, short' },
            due_date: { type: 'string', description: 'YYYY-MM-DD, the day to do it' },
            due_time: { type: 'string', description: 'HH:MM, 24 hour' },
            priority: { type: 'string', enum: ['high', 'normal', 'low'] },
            estimated_minutes: { type: 'integer', minimum: 1, maximum: 1440 },
            notes: { type: 'string' },
        } },
    },
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
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    if (!/^hby_[0-9a-f]{48}$/.test(key)) return null
    const { data } = await admin.from('mcp_keys').select('id, user_id, time_zone, revoked_at').eq('key_hash', await sha256(key)).maybeSingle()
    if (!data || data.revoked_at) return null
    void admin.from('mcp_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => undefined)
    return { userId: data.user_id, timeZone: data.time_zone || 'UTC' }
}

const scheduledOn = (habit: { task_days?: unknown; start_date?: string | null; end_date?: string | null; recurrence?: string | null }, day: string) => {
    if (habit.start_date && habit.start_date > day) return false
    if (habit.end_date && habit.end_date < day) return false
    // Every 2 weeks, the 1st of the month, 3 times a week: the rule the app repeats on.
    const rule = parseRecurrence(habit.recurrence)
    if (rule) return matches(rule, new Date(`${day}T12:00:00`), new Date(`${habit.start_date ?? day}T12:00:00`))
    const days = Array.isArray(habit.task_days) ? (habit.task_days as unknown[]).map(d => String(d).toLowerCase().slice(0, 3)) : []
    return days.length === 0 || days.includes(weekday(day))
}
const PRIORITY: Record<string, number> = { high: 1, normal: 2, low: 3 }
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
        case 'add_task': {
            const title = typeof args.title === 'string' ? args.title.trim().slice(0, 500) : ''
            if (!title) throw new Error('A task needs a title.')
            const row = {
                user_id: person.userId, title, source: 'mcp', status: 'open',
                description: typeof args.notes === 'string' && args.notes.trim() ? args.notes.trim().slice(0, 5000) : null,
                due_date: typeof args.due_date === 'string' && DATE.test(args.due_date) ? args.due_date : null,
                due_time: typeof args.due_time === 'string' && TIME.test(args.due_time) ? args.due_time : null,
                priority: PRIORITY[String(args.priority ?? 'normal')] ?? 2,
                estimated_minutes: Number.isInteger(args.estimated_minutes) && (args.estimated_minutes as number) > 0 ? args.estimated_minutes : null,
            }
            const { data, error } = await admin.from('tasks').insert(row).select('id').single()
            if (error) throw new Error(error.message)
            return `Added "${title}"${row.due_date ? ` for ${row.due_date}` : ''}${row.due_time ? ` at ${row.due_time}` : ''} (id ${data.id}). It shows in Habyss on its next sync.`
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
                serverInfo: { name: 'habyss', title: 'Habyss', version: '1.0.0' },
                instructions: 'Habyss is the person\'s habit and task app. Start with get_today. Tasks you add reach their phone on its next sync.',
            })
        }
        case 'ping': return reply({})
        case 'tools/list': return reply({ tools: TOOLS })
        case 'tools/call': {
            const name = String(message.params?.name ?? '')
            const args = (message.params?.arguments ?? {}) as Record<string, unknown>
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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    // Stateless: no server-sent stream to open.
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...cors, Allow: 'POST' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
    const person = await whoIs(admin, req)
    if (!person) {
        return new Response(JSON.stringify({ error: 'A Habyss key is needed: make one in Habyss → Settings → Integrations → AI assistants.' }), {
            status: 401, headers: { ...cors, 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="habyss"' },
        })
    }

    let body: unknown
    try { body = await req.json() } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400) }
    const messages = (Array.isArray(body) ? body : [body]) as Rpc[]
    const replies = []
    for (const message of messages) {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            replies.push({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } })
            continue
        }
        // Notifications (no id) get no reply.
        if (message.id === undefined || message.id === null) continue
        replies.push(await handle(admin, person, message))
    }
    if (!replies.length) return new Response(null, { status: 202, headers: cors })
    return json(Array.isArray(body) ? replies : replies[0])
})
