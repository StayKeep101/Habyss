/**
 * Translating rows between the phone and the server.
 *
 * The phone stores SQLite rows: 0/1 for booleans, JSON as text, a `deleted`
 * flag, and `synced` to mark changes not yet uploaded. The server stores
 * Postgres rows: real booleans, jsonb, and `deleted_at`. Everything here is a
 * pure function so each conversion can be tested on its own.
 *
 * Values are also cleaned against the server's rules. A single row the server
 * rejects fails its whole upload batch, so an old or odd value is corrected to
 * something valid rather than allowed to block everyone else's backup.
 */

type Row = Record<string, any>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const GRAPH_STYLES = ['progress', 'bar', 'line', 'heatmap', 'streak'];
const TRACKING = ['boolean', 'numeric', 'quantity', 'duration', 'rating'];
const TASK_STATUS = ['open', 'done', 'cancelled'];
/** The three the server's check constraint allows; anything else uploads as null. */
const EVIDENCE = ['verified', 'context', 'self'];
const TASK_SOURCE = ['app', 'mcp', 'shortcut'];
const TASK_MEASURE = ['done', 'count', 'time'];

export function parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

const toJsonText = (value: unknown, fallback: string): string =>
    value === null || value === undefined ? fallback : JSON.stringify(value);

/** A calendar date, whether stored as "YYYY-MM-DD" or a full timestamp. */
export function dateOnly(value: unknown): string | null {
    if (typeof value !== 'string' || value.length < 10) return null;
    const head = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

const finite = (value: unknown): number | null => {
    const n = Number(value);
    return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
};

const bool = (value: unknown): boolean => value === true || value === 1 || value === '1';

/** When a locally deleted row stops existing, as the server records it. */
const deletedAt = (row: Row): string | null =>
    bool(row.deleted) ? (row.updated_at ?? new Date().toISOString()) : null;

/* -------------------------------------------------------------------------- */
/*  Habits (and goals, which are habits with is_goal set)                      */
/* -------------------------------------------------------------------------- */

export function habitToRemote(row: Row, userId: string): Row {
    const goalValue = finite(row.goal_value);
    const weekInterval = finite(row.week_interval);
    const duration = finite(row.duration_minutes);

    return {
        id: row.id,
        user_id: userId,
        name: (row.name ?? '').trim() || 'Untitled',
        description: row.description ?? null,
        category: row.category || 'personal',
        icon: row.icon ?? null,
        is_goal: bool(row.is_goal),
        target_date: dateOnly(row.target_date),
        goal_id: isUuid(row.goal_id) ? row.goal_id : null,
        task_days: parseJson(row.task_days, []),
        reminders: parseJson(row.reminders, []),
        start_date: dateOnly(row.start_date),
        end_date: dateOnly(row.end_date),
        duration_minutes: duration !== null && duration >= 0 ? Math.round(duration) : null,
        start_time: row.start_time ?? null,
        end_time: row.end_time ?? null,
        type: row.type || 'build',
        color: row.color || '#6B46C1',
        goal_period: row.goal_period || 'daily',
        goal_value: goalValue !== null && goalValue >= 0 ? goalValue : 1,
        unit: row.unit || 'count',
        chart_type: row.chart_type || 'bar',
        is_archived: bool(row.is_archived),
        show_memo: bool(row.show_memo),
        frequency: row.frequency ?? null,
        week_interval: weekInterval !== null && weekInterval >= 1 ? Math.floor(weekInterval) : 1,
        time_of_day: row.time_of_day ?? null,
        graph_style: GRAPH_STYLES.includes(row.graph_style) ? row.graph_style : null,
        tracking_method: TRACKING.includes(row.tracking_method) ? row.tracking_method : 'boolean',
        reminder_offset: finite(row.reminder_offset),
        // Both of these were held out of the mapping while the server had no
        // column for them — uploading a column it lacks fails the whole batch.
        // It has both now, so a restored habit keeps the sentence its reminder
        // says and the rule it actually repeats on.
        reminder_message: row.reminder_message ?? null,
        recurrence: row.recurrence ?? null,
        location_reminders: parseJson(row.location_reminders, []),
        health_kit_metric: row.health_kit_metric ?? null,
        health_kit_target: finite(row.health_kit_target),
        ringtone: row.ringtone ?? 'default',
        goal_spec: parseJson(row.goal_spec, null),
        ...planningToRemote(row),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        deleted_at: deletedAt(row),
    };
}

export function habitToLocal(row: Row): Row {
    return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description ?? null,
        category: row.category ?? 'personal',
        icon: row.icon ?? null,
        is_goal: row.is_goal ? 1 : 0,
        target_date: dateOnly(row.target_date),
        goal_id: row.goal_id ?? null,
        task_days: toJsonText(row.task_days, '[]'),
        reminders: toJsonText(row.reminders, '[]'),
        start_date: dateOnly(row.start_date),
        end_date: dateOnly(row.end_date),
        duration_minutes: row.duration_minutes ?? null,
        start_time: row.start_time ?? null,
        end_time: row.end_time ?? null,
        type: row.type ?? 'build',
        color: row.color ?? '#6B46C1',
        goal_period: row.goal_period ?? 'daily',
        goal_value: finite(row.goal_value) ?? 1,
        unit: row.unit ?? 'count',
        chart_type: row.chart_type ?? 'bar',
        is_archived: row.is_archived ? 1 : 0,
        show_memo: row.show_memo ? 1 : 0,
        frequency: row.frequency ?? null,
        week_interval: row.week_interval ?? 1,
        time_of_day: row.time_of_day ?? null,
        graph_style: row.graph_style ?? null,
        // The app shows done/not done or an amount; older server rows used finer
        // names for amounts, which would otherwise not display.
        tracking_method: row.tracking_method === 'boolean' || !row.tracking_method ? 'boolean' : 'numeric',
        reminder_offset: row.reminder_offset ?? null,
        reminder_message: row.reminder_message ?? null,
        recurrence: row.recurrence ?? null,
        location_reminders: toJsonText(row.location_reminders, '[]'),
        health_kit_metric: row.health_kit_metric ?? null,
        health_kit_target: finite(row.health_kit_target),
        ringtone: row.ringtone ?? 'default',
        goal_spec: row.goal_spec === null || row.goal_spec === undefined ? null : JSON.stringify(row.goal_spec),
        ...planningToLocal(row),
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
        deleted: row.deleted_at ? 1 : 0,
        // Came from the server, so there is nothing to upload.
        synced: 1,
    };
}

/**
 * How the timeline plans a habit or task: urgency (habits; a task's priority
 * is mapped with the task), how hard it is (1 easy … 3 hard) and whether its
 * set time may move. Null means "not said", as on the phone.
 */
function planningToRemote(row: Row, withPriority = true): Row {
    const level = (value: unknown, low: number, high: number) => {
        const number = finite(value);
        return number !== null && number >= low && number <= high ? Math.round(number) : null;
    };
    return {
        ...(withPriority ? { priority: level(row.priority, 0, 4) } : {}),
        difficulty: level(row.difficulty, 1, 3),
        flexible: row.flexible === null || row.flexible === undefined ? null : bool(row.flexible),
    };
}

/**
 * The same, coming down. Only what the server sent: one without these columns
 * yet must not blank what this phone has.
 */
function planningToLocal(row: Row, fields = ['priority', 'difficulty', 'flexible']): Row {
    const out: Row = {};
    for (const field of fields) {
        if (!(field in row)) continue;
        const value = row[field];
        out[field] = field === 'flexible'
            ? (value === null || value === undefined ? null : value ? 1 : 0)
            : finite(value);
    }
    return out;
}

/* -------------------------------------------------------------------------- */
/*  Completions                                                                */
/* -------------------------------------------------------------------------- */

export function completionToRemote(row: Row, userId: string): Row {
    return {
        // No id: the server assigns one, and the row is matched on
        // (user_id, habit_id, date).
        user_id: userId,
        habit_id: row.habit_id,
        date: dateOnly(row.date),
        value: finite(row.value) ?? 1,
        memo: row.memo ?? null,
        completed: true,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? row.created_at ?? null,
        skipped: bool(row.skipped),
        // How it was evidenced, so a friend's feed card can tell a recorded run
        // from a ticked box. Null on every row written before schema v13, which
        // reads as self-logged.
        evidence: EVIDENCE.includes(row.evidence) ? row.evidence : null,
        deleted_at: deletedAt({ ...row, updated_at: row.updated_at ?? row.created_at }),
    };
}

export function completionToLocal(row: Row): Row {
    return {
        id: row.id,
        user_id: row.user_id,
        habit_id: row.habit_id,
        date: dateOnly(row.date),
        value: finite(row.value) ?? 1,
        memo: row.memo ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
        evidence: EVIDENCE.includes(row.evidence) ? row.evidence : null,
        // A completion the server marks as not completed is treated as removed.
        skipped: row.skipped ? 1 : 0,
        deleted: row.deleted_at || row.completed === false ? 1 : 0,
        synced: 1,
    };
}

/* -------------------------------------------------------------------------- */
/*  Tasks                                                                      */
/* -------------------------------------------------------------------------- */

const validTime = (value: unknown): string | null =>
    typeof value === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : null;

export function taskToRemote(row: Row, userId: string): Row {
    const priority = finite(row.priority);
    const minutes = finite(row.estimated_minutes);
    const title = (row.title ?? '').trim().slice(0, 500);

    return {
        id: row.id,
        user_id: userId,
        title: title || 'Untitled task',
        description: typeof row.description === 'string' ? row.description.slice(0, 5000) : null,
        due_date: dateOnly(row.due_date),
        due_time: validTime(row.due_time),
        estimated_minutes: minutes !== null && minutes >= 0 ? Math.round(minutes) : null,
        priority: priority !== null && priority >= 1 && priority <= 3 ? Math.round(priority) : 2,
        goal_id: isUuid(row.goal_id) ? row.goal_id : null,
        status: TASK_STATUS.includes(row.status) ? row.status : 'open',
        completed_at: row.completed_at ?? null,
        source: TASK_SOURCE.includes(row.source) ? row.source : 'app',
        external_id: row.external_id ?? null,
        measure: TASK_MEASURE.includes(row.measure) ? row.measure : null,
        target: finite(row.target),
        unit: typeof row.unit === 'string' ? row.unit.slice(0, 40) : null,
        amount: finite(row.amount),
        milestone_id: typeof row.milestone_id === 'string' ? row.milestone_id : null,
        deadline: dateOnly(row.deadline),
        ...planningToRemote(row, false),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        deleted_at: deletedAt(row),
    };
}

export function taskToLocal(row: Row): Row {
    return {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description ?? null,
        due_date: dateOnly(row.due_date),
        due_time: row.due_time ?? null,
        estimated_minutes: row.estimated_minutes ?? null,
        priority: row.priority ?? 2,
        goal_id: row.goal_id ?? null,
        status: row.status ?? 'open',
        completed_at: row.completed_at ?? null,
        source: row.source ?? 'app',
        external_id: row.external_id ?? null,
        measure: TASK_MEASURE.includes(row.measure) ? row.measure : null,
        target: finite(row.target),
        unit: row.unit ?? null,
        amount: finite(row.amount),
        milestone_id: row.milestone_id ?? null,
        ...('deadline' in row ? { deadline: dateOnly(row.deadline) } : {}),
        ...planningToLocal(row, ['difficulty', 'flexible']),
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
        deleted: row.deleted_at ? 1 : 0,
        synced: 1,
    };
}

/* -------------------------------------------------------------------------- */
/*  Milestones                                                                 */
/* -------------------------------------------------------------------------- */

export function milestoneToRemote(row: Row, userId: string): Row {
    return {
        id: row.id,
        user_id: userId,
        goal_id: isUuid(row.goal_id) ? row.goal_id : null,
        title: String(row.title ?? '').slice(0, 200),
        due_date: dateOnly(row.due_date),
        done_at: row.done_at ?? null,
        position: Number.isFinite(Number(row.position)) ? Math.round(Number(row.position)) : 0,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        deleted_at: deletedAt(row),
    };
}

export function milestoneToLocal(row: Row): Row {
    return {
        id: row.id,
        user_id: row.user_id,
        goal_id: row.goal_id,
        title: row.title,
        due_date: dateOnly(row.due_date),
        done_at: row.done_at ?? null,
        position: row.position ?? 0,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
        deleted: row.deleted_at ? 1 : 0,
        synced: 1,
    };
}

/* -------------------------------------------------------------------------- */
/*  Upload order                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Goals before the habits that point at them.
 *
 * habits.goal_id references another habit, so a habit uploaded ahead of its
 * goal would fail the foreign key. Rows that cannot be uploaded at all, because
 * their id is not a UUID, are returned separately so they are reported rather
 * than failing the batch.
 */
export function orderForUpload<T extends Row>(rows: T[]): { upload: T[]; skipped: T[] } {
    const skipped = rows.filter(row => !isUuid(row.id));
    const valid = rows.filter(row => isUuid(row.id));
    const goals = valid.filter(row => bool(row.is_goal));
    const rest = valid.filter(row => !bool(row.is_goal));
    return { upload: [...goals, ...rest], skipped };
}

export function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}
