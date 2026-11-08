/** Pure MCP input contract, shared by the edge function and regression tests. */
type Schema = { type: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: readonly string[]; minimum?: number; maximum?: number; maxLength?: number; minLength?: number; maxItems?: number; format?: string; description?: string };
const str = (maxLength = 500): Schema => ({ type: 'string', minLength: 1, maxLength });
const date: Schema = { ...str(10), format: 'date', description: 'YYYY-MM-DD' };
const time: Schema = { ...str(5), format: 'time', description: 'HH:MM, 24 hour' };
const uuid: Schema = { ...str(36), format: 'uuid' };
const minutes: Schema = { type: 'integer', minimum: 1, maximum: 1440 };
const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
const array = (items: Schema, maxItems = 100): Schema => ({ type: 'array', items, maxItems });
const taskFields = {
    title: str(), notes: str(5000), due_date: date, due_time: time, estimated_minutes: minutes,
    priority: { type: 'string', enum: ['high', 'normal', 'low'] } as Schema,
    subtasks: array(str(200), 50),
};
const habitFields = {
    name: str(), description: str(5000), category: str(80), start_date: date, end_date: date,
    start_time: time, duration_minutes: minutes,
    task_days: array({ type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, 7),
    goal_value: { type: 'number', minimum: 0.000001, maximum: 1000000000 } as Schema, unit: str(40),
};
const goalFields = {
    name: str(), description: str(5000), category: str(80), start_date: date, target_date: date,
    kind: { type: 'string', enum: ['complete', 'number', 'time'], description: 'Default complete (tasks done). number accumulates units; time accumulates minutes.' } as Schema,
    target: { type: 'number', minimum: 0.000001, maximum: 1000000000 } as Schema, unit: str(40),
};
const request_id: Schema = { ...uuid, description: 'Optional UUID: reuse with identical arguments on retries to avoid duplicates.' };
export const PLANNING_TOOLS = [
    { name: 'add_task', description: 'Create a task, optionally linked to a goal and milestone. Default duration 90 minutes.', inputSchema: obj({ ...taskFields, goal_id: uuid, milestone_id: uuid, request_id }, ['title']) },
    { name: 'add_habit', description: 'Create a repeating habit, optionally linked to a goal. Defaults to every day, 30 minutes. Numeric goal_value enables amount tracking.', inputSchema: obj({ ...habitFields, goal_id: uuid, request_id }, ['name']) },
    { name: 'add_goal', description: 'Create a goal. Use create_roadmap to include its milestones, habits and tasks.', inputSchema: obj({ ...goalFields, request_id }, ['name']) },
    { name: 'create_roadmap', description: 'Atomically create a goal with ordered milestones, tasks and habits. Tasks nested under a milestone link to that milestone; all items link to the goal. Reuse request_id when retrying.', inputSchema: obj({
        goal: obj(goalFields, ['name']),
        milestones: array(obj({ title: str(200), due_date: date, tasks: array(obj(taskFields, ['title'])) }, ['title']), 50),
        tasks: array(obj(taskFields, ['title'])), habits: array(obj(habitFields, ['name'])), request_id,
    }, ['goal']) },
    { name: 'list_goals', description: 'List active goals and their IDs. Use get_roadmap to inspect a goal and everything linked to it.', inputSchema: obj({}) },
    { name: 'get_roadmap', description: 'Read a goal, its ordered milestones, linked habits and tasks.', inputSchema: obj({ goal_id: uuid }, ['goal_id']) },
];
export function validateInput(value: unknown, schema: Schema, path = 'arguments'): void {
    const bad = (why: string): never => { throw new Error(`${path}: ${why}`); };
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) bad('expected an object');
        const row = value as Record<string, unknown>;
        for (const key of schema.required ?? []) if (row[key] === undefined) bad(`missing ${key}`);
        for (const [key, child] of Object.entries(row)) {
            const field = schema.properties?.[key];
            if (!field) bad(`unknown field ${key}`);
            validateInput(child, field!, `${path}.${key}`);
        }
    } else if (schema.type === 'array') {
        if (!Array.isArray(value)) bad('expected an array');
        const items = value as unknown[];
        if (items.length > (schema.maxItems ?? 100)) bad('too many items');
        items.forEach((item, i) => validateInput(item, schema.items!, `${path}[${i}]`));
    } else if (schema.type === 'string') {
        if (typeof value !== 'string') bad('expected text');
        const text = value as string;
        if (!text.trim() || text.length > (schema.maxLength ?? 500)) bad('empty or too long');
        if (schema.enum && !schema.enum.includes(text)) bad(`expected ${schema.enum.join(', ')}`);
        if (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) bad('expected a real YYYY-MM-DD date');
        if (schema.format === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) bad('expected HH:MM');
        if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) bad('expected a UUID');
    } else if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) bad('number outside the allowed range');
}
type Row = Record<string, any>;
export function planningRows(name: string, args: Row, today: string, id: () => string) {
    const tool = PLANNING_TOOLS.find(t => t.name === name);
    if (!tool) throw new Error('Unknown planning tool');
    validateInput(args, tool.inputSchema);
    const habits: Row[] = [], tasks: Row[] = [], milestones: Row[] = [];
    const habit = (a: Row, goalId?: string) => {
        const start = a.start_date ?? today;
        if (a.end_date && a.end_date < start) throw new Error('end_date must be on or after start_date');
        return { id: id(), name: a.name.trim(), description: a.description ?? null, category: a.category ?? 'personal', is_goal: false,
            goal_id: goalId ?? a.goal_id ?? null, start_date: start, end_date: a.end_date ?? null, start_time: a.start_time ?? null,
            duration_minutes: a.duration_minutes ?? 30, task_days: a.task_days ?? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            goal_value: a.goal_value ?? 1, unit: a.unit ?? 'count', tracking_method: a.goal_value !== undefined ? 'numeric' : 'boolean', is_archived: false };
    };
    const task = (a: Row, goalId?: string, milestoneId?: string) => ({ id: id(), title: a.title.trim(), description: a.notes ?? null,
        due_date: a.due_date ?? null, due_time: a.due_time ?? null, estimated_minutes: a.estimated_minutes ?? 90,
        priority: ({ high: 1, normal: 2, low: 3 } as Row)[a.priority ?? 'normal'], goal_id: goalId ?? a.goal_id ?? null,
        milestone_id: milestoneId ?? a.milestone_id ?? null, source: 'mcp', status: 'open',
        subtasks: a.subtasks?.map((title: string) => ({ id: id(), title: title.trim(), done: false })) ?? null });
    if (name === 'add_task') tasks.push(task(args));
    else if (name === 'add_habit') habits.push(habit(args));
    else if (name === 'add_goal' || name === 'create_roadmap') {
        const a = name === 'add_goal' ? args : args.goal;
        const kind = a.kind ?? 'complete', start = a.start_date ?? today;
        if (a.target_date && a.target_date < start) throw new Error('target_date must be on or after start_date');
        if (kind !== 'complete' && !a.target) throw new Error('number and time goals need a target');
        if (kind === 'number' && !a.unit) throw new Error('number goals need a unit');
        const goalId = id();
        habits.push({ ...habit({ ...a, start_date: start }), id: goalId, is_goal: true, target_date: a.target_date ?? null,
            goal_spec: { kind, title: a.name.trim(), type: kind === 'complete' ? null : 'volume', metric_unit: kind === 'time' ? 'minutes' : a.unit ?? null,
                aggregation: kind === 'complete' ? null : 'sum', direction: kind === 'complete' ? null : 'at_least', target: a.target ?? null,
                baseline: null, delta_from_baseline: null, window: a.target_date ? { kind: 'fixed', start, end: a.target_date } : null,
                linked_habits: [], suggested_habit: null } });
        if (name === 'create_roadmap') {
            for (const [position, m] of (args.milestones ?? []).entries()) {
                const milestoneId = id();
                milestones.push({ id: milestoneId, goal_id: goalId, title: m.title.trim(), due_date: m.due_date ?? null, position });
                tasks.push(...(m.tasks ?? []).map((t: Row) => task(t, goalId, milestoneId)));
            }
            tasks.push(...(args.tasks ?? []).map((t: Row) => task(t, goalId)));
            habits.push(...(args.habits ?? []).map((h: Row) => habit(h, goalId)));
            habits[0].goal_spec.linked_habits = habits.slice(1).map(h => h.id);
        }
    }
    if (tasks.length + habits.length + milestones.length > 300) throw new Error('A roadmap can contain at most 300 items');
    return { habits, tasks, milestones };
}
