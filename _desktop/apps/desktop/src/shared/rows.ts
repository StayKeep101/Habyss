// Ported from Habyss Mobile lib/habitsSQLite.ts getHabits() row mapping and lib/tasks.ts rowToTask @0fcd218. Keep in sync; do not re-derive rules.
/* eslint-disable @typescript-eslint/no-explicit-any -- copied mobile code reads untyped rows */
import { parseAnchor } from './habitAnchor';
import type { HabitRow, TaskRow } from '../types';
import type { Habit, HabitCategory, LocationReminder } from './habitsSQLite';
import { parseSubtasks, type Task, type TaskPriority, type TaskSource, type TaskStatus } from './tasks';

function storedArray(value: unknown, fallback: any[] = []): any[] {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : fallback;
    } catch { return fallback; }
}

// The mobile mapping reads untyped SQLite rows (`row: any`), so null columns pass through exactly as they do there.
const habitFrom = (row: any): Habit => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as HabitCategory,
    icon: row.icon,
    createdAt: row.created_at,
    durationMinutes: row.duration_minutes,
    startTime: row.start_time,
    endTime: row.end_time,
    type: row.type || 'build',
    color: row.color || '#6B46C1',
    goalPeriod: row.goal_period || 'daily',
    goalValue: row.goal_value || 1,
    unit: row.unit || 'count',
    taskDays: storedArray(row.task_days).filter(day => typeof day === 'string'),
    reminders: storedArray(row.reminders).filter(time => typeof time === 'string'),
    chartType: row.chart_type || 'bar',
    startDate: row.start_date || row.created_at,
    endDate: row.end_date,
    isArchived: row.is_archived === 1,
    showMemo: row.show_memo === 1,
    frequency: row.frequency,
    weekInterval: row.week_interval,
    timeOfDay: row.time_of_day,
    ringtone: row.ringtone || 'default',
    reminderOffset: row.reminder_offset,
    // Held before or after an event or meal (lib/habitAnchor.ts); stored as JSON text.
    anchor: parseAnchor(row.anchor) ?? null,
    locationReminders: storedArray(row.location_reminders)
        .filter(location => location && typeof location.name === 'string' && Number.isFinite(location.latitude) && Number.isFinite(location.longitude))
        // Rebuilt rather than passed through, so a hand-edited
        // row cannot put an unknown direction on a geofence.
        .map((location): LocationReminder => ({
            name: location.name, latitude: location.latitude, longitude: location.longitude,
            radius: Number.isFinite(location.radius) ? location.radius : undefined,
            trigger: location.trigger === 'leave' ? 'leave' : 'arrive',
        })),
    reminderMessage: row.reminder_message || undefined,
    priority: row.priority === 1 || row.priority === 3 ? row.priority : row.priority === 2 ? 2 : undefined,
    difficulty: row.difficulty === 1 || row.difficulty === 2 || row.difficulty === 3 ? row.difficulty : undefined,
    flexible: row.flexible === 0 ? false : row.flexible === 1 ? true : undefined,
    recurrence: row.recurrence || undefined,
    graphStyle: row.graph_style,
    trackingMethod: row.tracking_method,
    healthKitMetric: row.health_kit_metric,
    healthKitTarget: row.health_kit_target,
});

const taskFrom = (row: any): Task => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    dueTime: row.due_time ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    priority: (row.priority ?? 2) as TaskPriority,
    status: (row.status ?? 'open') as TaskStatus,
    completedAt: row.completed_at ?? undefined,
    source: (row.source ?? 'app') as TaskSource,
    externalId: row.external_id ?? undefined,
    measure: row.measure === 'count' || row.measure === 'time' ? row.measure : undefined,
    target: Number.isFinite(row.target) && row.target > 0 ? row.target : undefined,
    unit: row.unit ?? undefined,
    amount: Number.isFinite(row.amount) ? row.amount : undefined,
    difficulty: row.difficulty === 1 || row.difficulty === 2 || row.difficulty === 3 ? row.difficulty : undefined,
    deadline: typeof row.deadline === 'string' && row.deadline ? row.deadline : undefined,
    flexible: row.flexible === 0 ? false : row.flexible === 1 ? true : undefined,
    subtasks: parseSubtasks(row.subtasks),
    section: typeof row.section === 'string' && row.section ? row.section : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const rowToHabit = (row: HabitRow): Habit => habitFrom(row);
export const rowToTask = (row: TaskRow): Task => taskFrom(row);
