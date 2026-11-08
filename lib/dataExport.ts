import { Share } from 'react-native';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import type { FocusRecord } from './focusStats';
import { localDateKey } from './habitSchedule';

/**
 * Your data, out of Habyss: one CSV of everything done, kept or planned, a
 * row each, that Numbers, Excel and Google Sheets open as they are. Habit and
 * goal check-ins (done or skipped, with the amount), tasks, focus sessions.
 * Nothing is kept from you: the file is yours to take anywhere.
 */
export const EXPORT_COLUMNS = ['date', 'type', 'name', 'status', 'amount', 'unit', 'minutes'] as const;

type Row = Record<(typeof EXPORT_COLUMNS)[number], string | number>;

/** A cell as CSV: quoted when it holds a comma, a quote or a line break. */
export const csvCell = (value: string | number): string => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const dayOf = (stamp?: string | null): string => {
    if (!stamp) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return stamp;
    const parsed = new Date(stamp);
    return Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : stamp.slice(0, 10);
};

/** The whole record as CSV text, oldest first. Pure, so it is tested. */
export function exportCsv({ habits, completions, tasks, focus }: {
    habits: Habit[];
    completions: { habitId: string; date: string; value: number; skipped: boolean }[];
    tasks: Task[];
    focus: FocusRecord[];
}): string {
    const byId = new Map(habits.map(habit => [habit.id, habit]));
    const titleOf = (id: string) => byId.get(id)?.name ?? tasks.find(task => task.id === id)?.title ?? 'Deleted';
    const rows: Row[] = [];
    for (const tick of completions) {
        const habit = byId.get(tick.habitId);
        rows.push({
            date: tick.date, type: habit?.isGoal ? 'goal' : 'habit', name: habit?.name ?? 'Deleted habit',
            status: tick.skipped ? 'skipped' : 'done', amount: tick.skipped ? '' : tick.value, unit: habit?.unit ?? '', minutes: '',
        });
    }
    for (const task of tasks) {
        const date = task.status === 'done' ? dayOf(task.completedAt ?? task.updatedAt) : dayOf(task.dueDate ?? task.createdAt);
        rows.push({ date, type: 'task', name: task.title, status: task.status, amount: '', unit: '', minutes: '' });
    }
    for (const session of focus) {
        rows.push({
            date: session.date, type: 'focus', name: titleOf(session.itemId), status: session.completed ? 'finished' : 'stopped',
            amount: '', unit: '', minutes: Math.round(session.seconds / 60),
        });
    }
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return [EXPORT_COLUMNS.join(','), ...rows.map(row => EXPORT_COLUMNS.map(column => csvCell(row[column])).join(','))].join('\n');
}

/** Writes the file and opens the share sheet with it (Save to Files, Mail, AirDrop…). */
export async function exportMyData(): Promise<'shared' | 'cancelled' | 'failed'> {
    try {
        const { getHabits, getAllCompletionRows } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const { loadFocusRecords, currentFocusRecords } = require('./focusStats') as typeof import('./focusStats');
        const [habits, completions, tasks] = await Promise.all([getHabits(), getAllCompletionRows(), getTasks({ includeDone: true }), loadFocusRecords()]);
        const csv = exportCsv({ habits, completions, tasks, focus: currentFocusRecords() });
        const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
        const file = new File(Paths.cache, `Habyss ${localDateKey(new Date())}.csv`);
        if (file.exists) file.delete();
        file.create();
        file.write(csv);
        const result = await Share.share({ url: file.uri, title: 'Habyss data' });
        return result.action === Share.sharedAction ? 'shared' : 'cancelled';
    } catch {
        return 'failed';
    }
}
