import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { Habit } from './habitsSQLite';
import { createHabitSchedule } from './habitSchedule';
import { dateAt, summarizeHabit } from './goalInsights';
import { countedHistory } from './sharedGate';
import { mixHex } from './colorContrast';
import { measurementFor } from './habitMeasurement';
import { tasksForDay, type Task } from './tasks';

/**
 * Keeps the Apple Watch app in step with the phone.
 *
 * The watch had a full app and a bridge on the phone, but nothing ever sent it
 * anything, and nothing listened to what it sent back — so it showed nothing
 * and its ticks were lost. The phone now hands it today's habits (with the
 * same streaks and accent the app shows) whenever the day changes, and a tick
 * on the wrist is applied here like any other.
 *
 * The watch is one list: today's tasks, then today's habits, each a tap to
 * tick. A tick is written where widget taps go (the phone's bridge does it, so
 * it lands even when the app is closed) and applied the same way.
 */

export interface WatchHabit {
    id: string;
    title: string;
    icon: string;
    color: string;
    completed: boolean;
    streakCount: number;
    targetCount: number;
    unit: string;
    /** A timed habit is finished by its timer, not a tap. */
    canTick: boolean;
}

export interface WatchTask {
    id: string;
    title: string;
    completed: boolean;
    /** "HH:MM", when it has one. */
    time: string;
}

/** Today's tasks as the watch draws them: open first, timed ones by time. */
export function buildWatchTasks(tasks: Task[], today: string): WatchTask[] {
    return tasksForDay(tasks, today, today)
        .map(task => ({ id: task.id, title: task.title, completed: task.status === 'done', time: task.dueTime ?? '' }))
        .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.time || '99').localeCompare(b.time || '99'));
}

/** Today's habits as the watch draws them, scheduled ones only, unfinished first. */
export function buildWatchHabits(habits: Habit[], history: Record<string, string[]>, today: string): WatchHabit[] {
    const counted = countedHistory(history);
    const done = new Set(history[today] ?? []);
    return habits
        .filter(habit => !habit.isGoal && !habit.isArchived && createHabitSchedule(habit)(dateAt(today)))
        .map(habit => ({
            id: habit.id,
            title: habit.name,
            icon: 'circle',
            color: habit.color || '',
            completed: done.has(habit.id),
            streakCount: summarizeHabit(habit, counted, today).streak,
            targetCount: 1,
            unit: habit.unit ?? '',
            canTick: measurementFor(habit).kind !== 'timer',
        }))
        .sort((a, b) => Number(a.completed) - Number(b.completed));
}

type WatchBridge = { updateContext: (context: Record<string, unknown>) => void };
const bridge = (): WatchBridge | null =>
    Platform.OS === 'ios' && NativeModules.WatchModule ? (NativeModules.WatchModule as WatchBridge) : null;

let lastSent: string | null = null;

/** Sends the snapshot, unless it is exactly what the watch already has. */
export function pushToWatch(input: {
    habits: Habit[]; tasks: Task[]; history: Record<string, string[]>; today: string; streak: number;
    accent: { from: string; to: string };
}): void {
    const watch = bridge();
    if (!watch) return;
    const context = {
        habits: buildWatchHabits(input.habits, input.history, input.today),
        tasks: buildWatchTasks(input.tasks, input.today),
        streak: input.streak,
        dayKey: input.today,
        accent: mixHex(input.accent.from, input.accent.to),
        accentFrom: input.accent.from,
        accentTo: input.accent.to,
    };
    const fingerprint = JSON.stringify(context);
    if (fingerprint === lastSent) return;
    try {
        watch.updateContext(context);
        lastSent = fingerprint;
    } catch { /* no watch paired, or the session is not active yet */ }
}

/**
 * Applies what the watch sends: a tick (already in the widget inbox, so a
 * refresh applies it), an old build's habit tick, or a request for the latest
 * snapshot. Returns the way to stop listening.
 */
export function listenToWatch(onRequest: () => void): () => void {
    if (!bridge()) return () => undefined;
    const emitter = new NativeEventEmitter(NativeModules.WatchModule);
    const subscription = emitter.addListener('onWatchMessage', (message: { action?: string; payload?: { id?: string } }) => {
        if (message?.action === 'COMPLETE_HABIT' && message.payload?.id) {
            void completeFromWatch(message.payload.id);
        } else if (message?.action === 'TOGGLE') {
            onRequest();
        } else if (message?.action === 'REQUEST_INITIAL_DATA' || message?.action === 'REQUEST_FULL_SYNC') {
            lastSent = null;
            onRequest();
        }
    });
    return () => subscription.remove();
}

async function completeFromWatch(habitId: string): Promise<void> {
    const { getCompletions, toggleCompletion } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const today = localDateKey(new Date());
    // The watch only ever marks done; a tap on something already done is a no-op.
    if ((await getCompletions(today))[habitId]) return;
    // Saving announces itself, so Home, widgets and friends all follow.
    await toggleCompletion(habitId, today);
}
