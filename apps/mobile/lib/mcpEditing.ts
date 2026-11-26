/**
 * The MCP tools that change, remove and look back over what is already in
 * Habyss, and the brain dump: their input contract and the database changes
 * they make. Pure, shared by the edge function (supabase/functions/mcp) and
 * the tests. Every delete is soft (deleted_at), so the phone's sync removes
 * it there too and nothing is lost for good on a misheard request.
 */
// The edge function (Deno) needs the extension; the app's TypeScript does not allow it.
// @ts-ignore TS5097
import { array, date, minutes, obj, str, time, uuid, validateInput, type Schema } from './mcpPlanning.ts';

const bool: Schema = { type: 'boolean' };
const int = (minimum: number, maximum: number): Schema => ({ type: 'integer', minimum, maximum });
const days: Schema = array({ type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, 7);
const find: Schema = { ...str(200), description: 'The name or title, when the id is not known; a unique part of it is enough.' };
const thoughtId: Schema = { ...str(64), description: 'The id list_thoughts gives.' };

type Row = Record<string, any>;
type Tool = { name: string; description: string; inputSchema: Schema };

export const EDITING_TOOLS: Tool[] = [
    { name: 'update_task', description: 'Change a task: rename it, reschedule it (due_date, due_time), change its length, priority or notes, or reopen it (status open) or tick it (status done). Only the fields given change.',
        inputSchema: obj({ task_id: uuid, find, title: str(), notes: str(5000), due_date: date, due_time: time, estimated_minutes: minutes,
            priority: { type: 'string', enum: ['high', 'normal', 'low'] }, status: { type: 'string', enum: ['open', 'done'] } }) },
    { name: 'delete_task', description: 'Delete a task.', inputSchema: obj({ task_id: uuid, find }) },
    { name: 'update_habit', description: 'Change a habit: rename it, its days, time, length, amount or dates, or pause it (paused true) and bring it back (paused false). Only the fields given change.',
        inputSchema: obj({ habit_id: uuid, find, name: str(), description: str(5000), start_time: time, duration_minutes: minutes, task_days: days,
            start_date: date, end_date: date, goal_value: { type: 'number', minimum: 0.000001, maximum: 1000000000 }, unit: str(40), paused: bool }) },
    { name: 'delete_habit', description: 'Delete a habit and stop it repeating. Its history goes with it.', inputSchema: obj({ habit_id: uuid, find }) },
    { name: 'undo_habit', description: 'Un-tick a habit for a day (today by default), when it was marked done by mistake.', inputSchema: obj({ habit_id: uuid, find, date }) },
    { name: 'get_range', description: 'A day-by-day view of a date range (up to 92 days): each day\'s habits (done or not) and the tasks due that day (done or open).',
        inputSchema: obj({ from: date, to: date }, ['from', 'to']) },
    { name: 'get_stats', description: 'How it is going over a date range (the last 30 days by default, up to 366): habit completion rate overall and per habit, current streaks, tasks done and overdue, and each goal\'s progress.',
        inputSchema: obj({ from: date, to: date }) },
    { name: 'add_thought', description: 'Put a thought in the brain dump: anything on the person\'s mind, to deal with later. Private to them.', inputSchema: obj({ text: str(5000) }, ['text']) },
    { name: 'list_thoughts', description: 'The brain dump, newest first: optionally only between two dates, or containing some words.',
        inputSchema: obj({ from: date, to: date, search: str(200), limit: int(1, 200) }) },
    { name: 'update_thought', description: 'Reword a thought in the brain dump.', inputSchema: obj({ thought_id: thoughtId, text: str(5000) }, ['thought_id', 'text']) },
    { name: 'delete_thought', description: 'Remove a thought from the brain dump (done with it, or turned into a task).', inputSchema: obj({ thought_id: thoughtId }, ['thought_id']) },
];

export function checkEditing(name: string, args: Row): void {
    const tool = EDITING_TOOLS.find(t => t.name === name);
    if (!tool) throw new Error('Unknown tool');
    validateInput(args, tool.inputSchema);
}

const PRIORITY: Row = { high: 1, normal: 2, low: 3 };

/** The columns update_task changes. A task ticked done gets its time; reopened, loses it. */
export function taskPatch(args: Row, now: string): Row {
    const patch: Row = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.notes !== undefined) patch.description = args.notes;
    if (args.due_date !== undefined) patch.due_date = args.due_date;
    if (args.due_time !== undefined) patch.due_time = args.due_time;
    if (args.estimated_minutes !== undefined) patch.estimated_minutes = args.estimated_minutes;
    if (args.priority !== undefined) patch.priority = PRIORITY[args.priority];
    if (args.status === 'done') { patch.status = 'done'; patch.completed_at = now; }
    if (args.status === 'open') { patch.status = 'open'; patch.completed_at = null; }
    if (!Object.keys(patch).length) throw new Error('Nothing to change: give at least one field.');
    return patch;
}

/** The columns update_habit changes. */
export function habitPatch(args: Row, current: { start_date?: string | null; end_date?: string | null }): Row {
    const patch: Row = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.description !== undefined) patch.description = args.description;
    if (args.start_time !== undefined) patch.start_time = args.start_time;
    if (args.duration_minutes !== undefined) patch.duration_minutes = args.duration_minutes;
    if (args.task_days !== undefined) { patch.task_days = [...new Set(args.task_days as string[])]; patch.recurrence = null; }
    if (args.start_date !== undefined) patch.start_date = args.start_date;
    if (args.end_date !== undefined) patch.end_date = args.end_date;
    if (args.goal_value !== undefined) { patch.goal_value = args.goal_value; patch.tracking_method = 'numeric'; }
    if (args.unit !== undefined) patch.unit = args.unit;
    if (args.paused !== undefined) patch.is_archived = args.paused;
    const start = patch.start_date ?? current.start_date, end = patch.end_date ?? current.end_date;
    if (start && end && end < start) throw new Error('end_date must be on or after start_date');
    if (!Object.keys(patch).length) throw new Error('Nothing to change: give at least one field.');
    return patch;
}

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string, most: number): string[] {
    if (to < from) throw new Error('to must be on or after from');
    const out: string[] = [];
    for (let d = new Date(`${from}T12:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10);
        if (day > to) break;
        out.push(day);
        if (out.length > most) throw new Error(`At most ${most} days at a time.`);
    }
    return out;
}

/** "62%" (or "–" when nothing was due). */
export const percent = (done: number, due: number): string => (due ? `${Math.round((done / due) * 100)}%` : '–');
