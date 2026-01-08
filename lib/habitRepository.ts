/**
 * Habit Repository - SQLite CRUD Operations
 * Provides offline-first data access for habits and completions
 */

import { getDatabase, generateId, nowISO, todayString } from './database';
import { DeviceEventEmitter } from 'react-native';
import type { Habit, HabitCategory } from './habits';

// --- Types for SQLite rows ---
interface HabitRow {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    category: string;
    icon: string | null;
    is_goal: number;
    target_date: string | null;
    goal_id: string | null;
    task_days: string;
    reminders: string;
    start_date: string | null;
    end_date: string | null;
    duration_minutes: number | null;
    start_time: string | null;
    end_time: string | null;
    type: string;
    color: string;
    goal_period: string;
    goal_value: number;
    unit: string;
    chart_type: string;
    is_archived: number;
    show_memo: number;
    frequency: string | null;
    week_interval: number;
    time_of_day: string | null;
    created_at: string;
    updated_at: string | null;
    synced: number;
    deleted: number;
}

interface CompletionRow {
    id: string;
    user_id: string;
    habit_id: string;
    date: string;
    value: number;
    memo: string | null;
    created_at: string;
    synced: number;
    deleted: number;
}

// --- Mappers ---

function rowToHabit(row: HabitRow): Habit {
    return {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        category: row.category as HabitCategory,
        icon: row.icon || undefined,
        isGoal: row.is_goal === 1,
        targetDate: row.target_date || undefined,
        goalId: row.goal_id || undefined,
        taskDays: JSON.parse(row.task_days || '[]'),
        reminders: JSON.parse(row.reminders || '[]'),
        startDate: row.start_date || row.created_at,
        endDate: row.end_date || undefined,
        durationMinutes: row.duration_minutes || undefined,
        startTime: row.start_time || undefined,
        endTime: row.end_time || undefined,
        type: row.type as any || 'build',
        color: row.color || '#6B46C1',
        goalPeriod: row.goal_period as any || 'daily',
        goalValue: row.goal_value || 1,
        unit: row.unit || 'count',
        chartType: row.chart_type as any || 'bar',
        isArchived: row.is_archived === 1,
        showMemo: row.show_memo === 1,
        frequency: row.frequency as any,
        weekInterval: row.week_interval,
        timeOfDay: row.time_of_day as any,
        createdAt: row.created_at,
    };
}

// --- Habit Repository ---

export class HabitRepository {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    /**
     * Get all habits for the user
     */
    async getAllHabits(): Promise<Habit[]> {
        const db = await getDatabase();
        const rows = await db.getAllAsync<HabitRow>(
            'SELECT * FROM habits WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC',
            this.userId
        );
        return rows.map(rowToHabit);
    }

    /**
     * Get a single habit by ID
     */
    async getHabit(id: string): Promise<Habit | null> {
        const db = await getDatabase();
        const row = await db.getFirstAsync<HabitRow>(
            'SELECT * FROM habits WHERE id = ? AND user_id = ? AND deleted = 0',
            id, this.userId
        );
        return row ? rowToHabit(row) : null;
    }

    /**
     * Get all goals
     */
    async getGoals(): Promise<Habit[]> {
        const db = await getDatabase();
        const rows = await db.getAllAsync<HabitRow>(
            'SELECT * FROM habits WHERE user_id = ? AND is_goal = 1 AND deleted = 0 ORDER BY created_at DESC',
            this.userId
        );
        return rows.map(rowToHabit);
    }

    /**
     * Add a new habit
     */
    async addHabit(habit: Partial<Habit>): Promise<Habit> {
        const db = await getDatabase();
        const id = generateId();
        const now = nowISO();

        await db.runAsync(`
            INSERT INTO habits (
                id, user_id, name, description, category, icon, is_goal, target_date, goal_id,
                task_days, reminders, start_date, end_date, duration_minutes, start_time, end_time,
                type, color, goal_period, goal_value, unit, chart_type, is_archived, show_memo,
                frequency, week_interval, time_of_day, created_at, updated_at, synced, deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `,
            id,
            this.userId,
            habit.name || 'New Habit',
            habit.description || null,
            habit.category || 'misc',
            habit.icon || null,
            habit.isGoal ? 1 : 0,
            habit.targetDate || null,
            habit.goalId || null,
            JSON.stringify(habit.taskDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
            JSON.stringify(habit.reminders || []),
            habit.startDate || now.split('T')[0],
            habit.endDate || null,
            habit.durationMinutes || null,
            habit.startTime || null,
            habit.endTime || null,
            habit.type || 'build',
            habit.color || '#6B46C1',
            habit.goalPeriod || 'daily',
            habit.goalValue || 1,
            habit.unit || 'count',
            habit.chartType || 'bar',
            habit.isArchived ? 1 : 0,
            habit.showMemo ? 1 : 0,
            habit.frequency || null,
            habit.weekInterval || 1,
            habit.timeOfDay || null,
            now,
            now
        );

        // Queue for sync
        await this.queueSync('habits', 'INSERT', id, habit);

        const created = await this.getHabit(id);
        DeviceEventEmitter.emit('habit_created', { habit: created });
        return created!;
    }

    /**
     * Update an existing habit
     */
    async updateHabit(id: string, updates: Partial<Habit>): Promise<void> {
        const db = await getDatabase();
        const now = nowISO();

        const setClauses: string[] = ['updated_at = ?', 'synced = 0'];
        const params: any[] = [now];

        if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
        if (updates.description !== undefined) { setClauses.push('description = ?'); params.push(updates.description); }
        if (updates.category !== undefined) { setClauses.push('category = ?'); params.push(updates.category); }
        if (updates.icon !== undefined) { setClauses.push('icon = ?'); params.push(updates.icon); }
        if (updates.isGoal !== undefined) { setClauses.push('is_goal = ?'); params.push(updates.isGoal ? 1 : 0); }
        if (updates.targetDate !== undefined) { setClauses.push('target_date = ?'); params.push(updates.targetDate); }
        if (updates.goalId !== undefined) { setClauses.push('goal_id = ?'); params.push(updates.goalId); }
        if (updates.taskDays !== undefined) { setClauses.push('task_days = ?'); params.push(JSON.stringify(updates.taskDays)); }
        if (updates.reminders !== undefined) { setClauses.push('reminders = ?'); params.push(JSON.stringify(updates.reminders)); }
        if (updates.isArchived !== undefined) { setClauses.push('is_archived = ?'); params.push(updates.isArchived ? 1 : 0); }

        params.push(id, this.userId);

        await db.runAsync(
            `UPDATE habits SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
            ...params
        );

        await this.queueSync('habits', 'UPDATE', id, updates);
        DeviceEventEmitter.emit('habit_updated', { habitId: id });
    }

    /**
     * Delete a habit (soft delete)
     */
    async deleteHabit(id: string): Promise<void> {
        const db = await getDatabase();
        await db.runAsync(
            'UPDATE habits SET deleted = 1, synced = 0, updated_at = ? WHERE id = ? AND user_id = ?',
            nowISO(), id, this.userId
        );

        await this.queueSync('habits', 'DELETE', id, null);
        DeviceEventEmitter.emit('habit_deleted', { habitId: id });
    }

    // --- Completions ---

    /**
     * Get completions for a specific date
     */
    async getCompletions(date?: string): Promise<Record<string, boolean>> {
        const db = await getDatabase();
        const dateStr = date || todayString();

        const rows = await db.getAllAsync<{ habit_id: string }>(
            'SELECT habit_id FROM completions WHERE user_id = ? AND date = ? AND deleted = 0',
            this.userId, dateStr
        );

        const result: Record<string, boolean> = {};
        rows.forEach(row => { result[row.habit_id] = true; });
        return result;
    }

    /**
     * Toggle a completion for a habit on a specific date
     */
    async toggleCompletion(habitId: string, date?: string): Promise<boolean> {
        const db = await getDatabase();
        const dateStr = date || todayString();

        // Check if already completed
        const existing = await db.getFirstAsync<{ id: string }>(
            'SELECT id FROM completions WHERE habit_id = ? AND date = ? AND user_id = ? AND deleted = 0',
            habitId, dateStr, this.userId
        );

        if (existing) {
            // Mark as deleted
            await db.runAsync(
                'UPDATE completions SET deleted = 1, synced = 0 WHERE id = ?',
                existing.id
            );
            await this.queueSync('completions', 'DELETE', existing.id, null);
            DeviceEventEmitter.emit('habit_completion_updated', { habitId, date: dateStr, completed: false });
            return false;
        } else {
            // Insert new completion
            const id = generateId();
            const now = nowISO();
            await db.runAsync(
                'INSERT INTO completions (id, user_id, habit_id, date, value, created_at, synced, deleted) VALUES (?, ?, ?, ?, 1, ?, 0, 0)',
                id, this.userId, habitId, dateStr, now
            );
            await this.queueSync('completions', 'INSERT', id, { habitId, date: dateStr });
            DeviceEventEmitter.emit('habit_completion_updated', { habitId, date: dateStr, completed: true });
            return true;
        }
    }

    /**
     * Get completions for a date range
     */
    async getCompletionsRange(startDate: string, endDate: string): Promise<{ date: string; completedIds: string[] }[]> {
        const db = await getDatabase();
        const rows = await db.getAllAsync<{ date: string; habit_id: string }>(
            'SELECT date, habit_id FROM completions WHERE user_id = ? AND date >= ? AND date <= ? AND deleted = 0',
            this.userId, startDate, endDate
        );

        const map = new Map<string, string[]>();
        rows.forEach(row => {
            if (!map.has(row.date)) map.set(row.date, []);
            map.get(row.date)!.push(row.habit_id);
        });

        const result: { date: string; completedIds: string[] }[] = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            const dateStr = todayString(current);
            result.push({
                date: dateStr,
                completedIds: map.get(dateStr) || []
            });
            current.setDate(current.getDate() + 1);
        }

        return result;
    }

    // --- Sync Queue ---

    private async queueSync(table: string, operation: string, recordId: string, payload: any): Promise<void> {
        const db = await getDatabase();
        await db.runAsync(
            'INSERT INTO sync_queue (table_name, operation, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
            table, operation, recordId, payload ? JSON.stringify(payload) : null, nowISO()
        );
    }
}
