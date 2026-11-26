/** Pure MCP input contract, shared by the edge function and regression tests. */
export type Schema = { type: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: readonly string[]; minimum?: number; maximum?: number; maxLength?: number; minLength?: number; maxItems?: number; format?: string; description?: string };
export const str = (maxLength = 500): Schema => ({ type: 'string', minLength: 1, maxLength });
export const date: Schema = { ...str(10), format: 'date', description: 'YYYY-MM-DD' };
export const time: Schema = { ...str(5), format: 'time', description: 'HH:MM, 24 hour' };
export const uuid: Schema = { ...str(36), format: 'uuid' };
export const minutes: Schema = { type: 'integer', minimum: 1, maximum: 1440 };
export const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
export const array = (items: Schema, maxItems = 100): Schema => ({ type: 'array', items, maxItems });
export const taskFields = {
    title: str(), notes: str(5000), due_date: date, due_time: time, estimated_minutes: minutes,
    priority: { type: 'string', enum: ['high', 'normal', 'low'] } as Schema,
    subtasks: array(str(200), 50),
};
export const habitFields = {
    name: str(), description: str(5000), category: str(80), start_date: date, end_date: date,
    start_time: time, duration_minutes: minutes,
    task_days: array({ type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, 7),
    goal_value: { type: 'number', minimum: 0.000001, maximum: 1000000000 } as Schema, unit: str(40),
};
const request_id: Schema = { ...uuid, description: 'Optional UUID: reuse with identical arguments on retries to avoid duplicates.' };
export const PLANNING_TOOLS = [
    { name: 'add_task', description: 'Create a task. Default duration 90 minutes.', inputSchema: obj({ ...taskFields, request_id }, ['title']) },
    { name: 'add_habit', description: 'Create a repeating habit. Defaults to every day, 30 minutes. A numeric goal_value (its daily amount) enables amount tracking.', inputSchema: obj({ ...habitFields, request_id }, ['name']) },
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
    } else if (schema.type === 'boolean') {
        if (typeof value !== 'boolean') bad('expected true or false');
    } else if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) bad('number outside the allowed range');
}
type Row = Record<string, any>;
export function planningRows(name: string, args: Row, today: string, id: () => string) {
    const tool = PLANNING_TOOLS.find(t => t.name === name);
    if (!tool) throw new Error('Unknown planning tool');
    validateInput(args, tool.inputSchema);
    const habits: Row[] = [], tasks: Row[] = [];
    const habit = (a: Row) => {
        const start = a.start_date ?? today;
        if (a.end_date && a.end_date < start) throw new Error('end_date must be on or after start_date');
        return { id: id(), name: a.name.trim(), description: a.description ?? null, category: a.category ?? 'personal',
            start_date: start, end_date: a.end_date ?? null, start_time: a.start_time ?? null,
            duration_minutes: a.duration_minutes ?? 30, task_days: a.task_days ?? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            goal_value: a.goal_value ?? 1, unit: a.unit ?? 'count', tracking_method: a.goal_value !== undefined ? 'numeric' : 'boolean', is_archived: false };
    };
    const task = (a: Row) => ({ id: id(), title: a.title.trim(), description: a.notes ?? null,
        due_date: a.due_date ?? null, due_time: a.due_time ?? null, estimated_minutes: a.estimated_minutes ?? 90,
        priority: ({ high: 1, normal: 2, low: 3 } as Row)[a.priority ?? 'normal'], source: 'mcp', status: 'open',
        subtasks: a.subtasks?.map((title: string) => ({ id: id(), title: title.trim(), done: false })) ?? null });
    if (name === 'add_task') tasks.push(task(args));
    else if (name === 'add_habit') habits.push(habit(args));
    return { habits, tasks };
}
