import type { CloudData } from '../types';
import { rowToHabit, rowToTask } from '../shared/rows';
import { isHabitScheduledForDate, localDateKey } from '../shared/habitSchedule';
import { setHistory } from '../shared/dataStore';
import { flowDay, flowInputs, type DayFlow } from '../shared/dayFlow';
import { streakFrom, tallyDay } from '../shared/dayComplete';
import { doneOnDay } from '../shared/dailyFocus';
import { tasksForDay } from '../shared/tasks';
import { mealSlots, normalizeMeals } from '../shared/meals';
import { emptyMemory, remember, type DayMemory } from '../shared/dayMemory';
import type { Travel } from '../shared/eventTravel';

/**
 * Any day, built the way the phone builds it (Habyss Mobile lib/todayFlow.ts), from the account's habits, tasks and
 * completions plus the day's settings synced with the phone (`day_inputs`): waking window, meals, the day's calendar
 * slots, travel, what the timeline remembered, early ends, reschedules, peak hours and auto-reschedule.
 */
export type ItemKind = 'habit' | 'task' | 'meal' | 'event';
export interface TodayItem {
    id: string; kind: ItemKind; title: string; done: boolean; skipped: boolean; start: number; end: number;
    state: 'done' | 'now' | 'next' | 'later'; locked: boolean; icon?: string; color?: string;
    /** Meals, events and the travel around events: they do not move and have no check. */
    fixed?: boolean;
    priority?: 1 | 2 | 3; difficulty?: 1 | 2 | 3; deadline?: string; due?: string;
    /** Held before or after an event or meal. */
    anchoredTo?: string;
    /** One part of an item the timeline split around something fixed. */
    part?: { index: number; of: number };
}
/** `done`/`total` are the shared day tally (habits plus capped tasks). `tasksDone`/`tasksTotal` count the listed tasks only (Ruling P6): the "Tasks"
 * figure everywhere for today. `listedDone`/`listedTotal` count every listed habit and task. An item split into parts (rule 4) counts once. */
export interface Today {
    day: string; items: TodayItem[]; current: TodayItem | null; next: TodayItem | null;
    done: number; total: number; tasksDone: number; tasksTotal: number; listedDone: number; listedTotal: number; streak: number; signedIn: boolean;
    /** The waking window the day was planned in, minutes from midnight. */
    window: { wake: number; sleep: number };
}

/** The phone's default until a waking window is synced (lib/echo.ts DEFAULT_DAY). */
const DEFAULT_WINDOW = { wake: 7 * 60, sleep: 23 * 60 };
export const minuteOfDay = (now: Date): number => now.getHours() * 60 + now.getMinutes();
const empty = (day: string, signedIn: boolean): Today => ({ day, items: [], current: null, next: null, done: 0, total: 0, tasksDone: 0, tasksTotal: 0, listedDone: 0, listedTotal: 0, streak: 0, signedIn, window: DEFAULT_WINDOW });
const add = (map: Record<string, string[]>, day: string, id: string) => { (map[day] ??= []).push(id); };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutesOf = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };

function windowOf(inputs: Record<string, unknown>): { wake: number; sleep: number } {
    const w = inputs.day_window;
    if (isObject(w) && typeof w.wake === 'string' && typeof w.sleep === 'string' && TIME.test(w.wake) && TIME.test(w.sleep)) return { wake: minutesOf(w.wake), sleep: minutesOf(w.sleep) };
    return DEFAULT_WINDOW;
}
const numbers = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (isObject(v)) for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
    return out;
};
const memoryOf = (inputs: Record<string, unknown>, date: string): DayMemory | null => {
    const m = inputs[`day_memory:${date}`];
    return isObject(m) && m.day === date && isObject(m.slots) && isObject(m.done) && isObject(m.moved) ? m as unknown as DayMemory : null;
};

/** The phone's flow for `date`, and what the cards need around it. `now` places "now" only when `date` is its day. */
function flowFor(data: CloudData, date: string, now: Date) {
    const inputs = data.day_inputs ?? {};
    const today = localDateKey(now);
    const isToday = date === today;
    const at = new Date(`${date}T12:00:00`);
    const history: Record<string, string[]> = {};
    const skips: Record<string, string[]> = {};
    const doneTimes: Record<string, string> = {};
    for (const c of data.completions) {
        if (c.deleted) continue;
        if (c.skipped) { add(skips, c.date, c.habit_id); continue; }
        add(history, c.date, c.habit_id);
        // As the phone's getCompletionTimes: created_at only, when it falls on the same local day.
        if (c.date === date && c.created_at && localDateKey(new Date(c.created_at)) === date) doneTimes[c.habit_id] = c.created_at;
    }
    setHistory(history); // side effect: the shared schedule rules read this module-level history
    // A goal row left from before goals were removed is not a habit (the phone counts them as deleted).
    const allHabits = data.habits.filter(h => !h.deleted && !h.is_goal).map(rowToHabit);
    const allTasks = data.tasks.filter(t => !t.deleted).map(rowToTask);
    const habits = allHabits.filter(h => !h.isArchived && isHabitScheduledForDate(h, at));
    const onDay = new Set(tasksForDay(allTasks, date, today).map(t => t.id));
    const tasks = allTasks.filter(t => onDay.has(t.id) || doneOnDay(t, date));
    const done: Record<string, boolean> = {};
    for (const id of history[date] ?? []) done[id] = true;
    const skipped: Record<string, boolean> = {};
    for (const id of skips[date] ?? []) skipped[id] = true;
    const travel: Record<string, Travel> = {};
    for (const [key, value] of Object.entries(inputs)) if (key.startsWith('travel:') && isObject(value)) travel[key.slice(7)] = value as unknown as Travel;
    const events = Array.isArray(inputs[`events:${date}`]) ? inputs[`events:${date}`] as { id: string; title: string; start: number; minutes: number; color?: string; icon?: string }[] : [];
    const memory = memoryOf(inputs, date);
    const window = windowOf(inputs);
    const peak = isObject(inputs.peak) && typeof inputs.peak.start === 'number' && typeof inputs.peak.end === 'number' ? { start: inputs.peak.start, end: inputs.peak.end } : null;
    const items = flowInputs({
        habits, tasks, done, doneTimes, day: date, today: date, meals: mealSlots(normalizeMeals(inputs.meals)), events, travel,
        flexibleMeals: inputs.meals_flexible === true,
        kept: memory?.slots, planned: memory?.planned, lapsed: memory?.lapsed, wasDone: memory?.done, again: memory?.again,
        rescheduled: numbers(inputs[`reschedule:${date}`]), ended: numbers(inputs[`ended:${date}`]),
    });
    const flow = flowDay(items, isToday ? minuteOfDay(now) : null, { ...window, peak }, { auto: inputs.auto_reschedule !== false });
    return { flow, window, habits, tasks, allHabits, allTasks, history, skips, done, skipped, memory, isToday };
}

export function buildDay(data: CloudData | null, opts: { date: string; now: Date; signedIn: boolean }): Today {
    const { date } = opts;
    if (!data || !opts.signedIn) return empty(date, false);
    const { flow, window, habits, tasks, allHabits, allTasks, history, skips, done, skipped } = flowFor(data, date, opts.now);
    const items: TodayItem[] = flow.timeline.map(i => ({
        id: i.id, kind: i.kind, title: i.title, done: i.done, skipped: i.kind === 'habit' && !!skipped[i.id], start: i.start, end: i.end, state: i.state,
        locked: !!i.locked, icon: i.icon, color: i.color, fixed: !!i.fixed, priority: i.priority, difficulty: i.difficulty, deadline: i.deadline, due: i.due,
        anchoredTo: i.anchoredTo, part: i.part,
    }));
    const current = items.find(i => i.state === 'now') ?? null;
    const next = items.find(i => i.state === 'next') ?? null;
    const tally = tallyDay(habits, done, skipped, tasks, date);
    const listed = [...new Map(items.filter(i => i.kind === 'habit' || i.kind === 'task').map(i => [`${i.kind}:${i.id}`, i])).values()];
    const listedTasks = listed.filter(i => i.kind === 'task');
    const { streak } = streakFrom(allHabits, allTasks, history, skips, date);
    return { day: date, items, current, next, done: tally.done, total: tally.total, tasksDone: listedTasks.filter(i => i.done).length, tasksTotal: listedTasks.length, listedDone: listed.filter(i => i.done).length, listedTotal: listed.length, streak, signedIn: true, window };
}

/**
 * Today's memory after this look (phone lib/dayMemory.ts `remember`), or null when nothing changed or `date` is not today.
 * The caller saves it as `day_memory:<date>`, so the phone and this Mac keep the same layout.
 */
export function memoryAfter(data: CloudData | null, date: string, now: Date): DayMemory | null {
    if (!data || date !== localDateKey(now)) return null;
    const { flow, memory } = flowFor(data, date, now) as { flow: DayFlow; memory: DayMemory | null };
    const prev = memory ?? emptyMemory(date);
    const next = remember(prev, date, flow, minuteOfDay(now));
    return JSON.stringify(next) === JSON.stringify(memory) ? null : next;
}
