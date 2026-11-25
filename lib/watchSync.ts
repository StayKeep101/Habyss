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
    /** Whether a tap ticks it: always, timed habits included (kept for older watch apps). */
    canTick: boolean;
    /** Where the timeline has it today, in minutes from midnight (-1 when it has no place). */
    start: number;
    end: number;
    /** Cut short to fit the day. */
    cut: boolean;
    /** The one you are on. */
    now: boolean;
}

export interface WatchTask {
    id: string;
    title: string;
    completed: boolean;
    /** "HH:MM", when it has one. */
    time: string;
    start: number;
    end: number;
    cut: boolean;
    now: boolean;
}

/** Where the timeline puts each thing today, for the watch. */
export type WatchSlots = Record<string, { start: number; end: number; cut: boolean; now: boolean }>;

export function slotsFromFlow(flow: import('./dayFlow').DayFlow | null): WatchSlots {
    const out: WatchSlots = {};
    for (const item of flow?.timeline ?? []) {
        if (item.kind !== 'habit' && item.kind !== 'task') continue;
        out[item.id] = { start: item.start, end: item.end, cut: !!item.cutFrom, now: item.state === 'now' };
    }
    return out;
}

const NO_SLOT = { start: -1, end: -1, cut: false, now: false };

/** The focus session on the phone, for the watch to show. */
export interface WatchFocus {
    id: string; title: string;
    /** When the countdown ends (ms since 1970); 0 while paused or for a stopwatch. */
    endsAt: number;
    /** When it began, for a stopwatch's count up (ms since 1970). */
    startedAt: number;
    /** Seconds left, for a paused countdown. */
    left: number;
    paused: boolean; stopwatch: boolean;
}

/** Today's tasks as the watch draws them: open first, timed ones by time. */
export function buildWatchTasks(tasks: Task[], today: string, slots: WatchSlots = {}): WatchTask[] {
    return tasksForDay(tasks, today, today)
        .map(task => ({ id: task.id, title: task.title, completed: task.status === 'done', time: task.dueTime ?? '', ...(slots[task.id] ?? NO_SLOT) }))
        .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.time || '99').localeCompare(b.time || '99'));
}

/** Today's habits as the watch draws them, scheduled ones only, unfinished first. */
export function buildWatchHabits(habits: Habit[], history: Record<string, string[]>, today: string, slots: WatchSlots = {}): WatchHabit[] {
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
            canTick: true,
            ...(slots[habit.id] ?? NO_SLOT),
        }))
        .sort((a, b) => Number(a.completed) - Number(b.completed));
}

type WatchBridge = { updateContext: (context: Record<string, unknown>) => void };
const bridge = (): WatchBridge | null =>
    Platform.OS === 'ios' && NativeModules.WatchModule ? (NativeModules.WatchModule as WatchBridge) : null;

let lastSent: string | null = null;
let lastContext: Record<string, unknown> | null = null;
let focusNow: WatchFocus | null = null;

function send(context: Record<string, unknown>): void {
    const watch = bridge();
    if (!watch) return;
    const fingerprint = JSON.stringify(context);
    if (fingerprint === lastSent) return;
    try {
        watch.updateContext(context);
        lastSent = fingerprint;
        lastContext = context;
    } catch { /* no watch paired, or the session is not active yet */ }
}

/**
 * The phone's focus session, mirrored on the wrist (or cleared when it ends).
 * Sent with the rest of the day, so the watch always has both.
 */
export function pushFocusToWatch(focus: WatchFocus | null): void {
    focusNow = focus;
    if (lastContext) send({ ...lastContext, focus: focus ?? {} });
}

/** Sends the snapshot, unless it is exactly what the watch already has. */
export function pushToWatch(input: {
    habits: Habit[]; tasks: Task[]; history: Record<string, string[]>; today: string; streak: number;
    accent: { from: string; to: string };
    /** Where the timeline puts each thing today (lib/todayFlow.ts). */
    slots?: WatchSlots;
}): void {
    if (!bridge()) return;
    const context = {
        habits: buildWatchHabits(input.habits, input.history, input.today, input.slots),
        tasks: buildWatchTasks(input.tasks, input.today, input.slots),
        streak: input.streak,
        dayKey: input.today,
        accent: mixHex(input.accent.from, input.accent.to),
        accentFrom: input.accent.from,
        accentTo: input.accent.to,
        focus: focusNow ?? {},
    };
    send(context);
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
        } else if (message?.action === 'FOCUS_NEXT') {
            // Next, from the wrist: the focus page finishes this one and moves on.
            const { emit } = require('./appEvents') as typeof import('./appEvents');
            emit('focus_next', { id: message.payload?.id });
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
    // In a challenge or a bet it needs proof, which the Watch can't take: held, and asked for in Habyss.
    const habit = (await (require('./habitsSQLite') as typeof import('./habitsSQLite')).getHabits()).find(item => item.id === habitId);
    if (habit && await (require('./challengeProof') as typeof import('./challengeProof')).holdForProof({ kind: 'habit', habit })) return;
    // Saving announces itself, so Home, widgets and friends all follow.
    await toggleCompletion(habitId, today, undefined, 'watch');
}
