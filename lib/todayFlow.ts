import { getDayShare } from './dayShare';
import { flowDay, flowInputs, type DayFlow } from './dayFlow';

/**
 * Today's timeline worked out outside any screen, from the same pieces the
 * Roadmap uses (habits, tasks, meals, calendar, waking day, what was already
 * placed), for things that run without the Roadmap open — the Live Activity.
 */
export async function todayFlow(now = new Date(), options: { ahead?: boolean } = {}): Promise<DayFlow> {
    // `ahead`: a day still to come (tomorrow, for the Day widget after midnight), planned
    // from waking as it stands, with no "now" and nothing remembered over today's layout.
    const { getHabits, getCompletions, getCompletionTimes, isHabitScheduledForDate } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { getTasks, tasksForDay } = require('./tasks') as typeof import('./tasks');
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const { getDayWindow, minutesOf } = require('./echo') as typeof import('./echo');
    const { loadMeals, loadMealsFlexible, mealSlots } = require('./meals') as typeof import('./meals');
    const { eventsFor } = require('./calendarEvents') as typeof import('./calendarEvents');
    const { loadMemory } = require('./dayMemory') as typeof import('./dayMemory');
    const { loadTravel } = require('./eventTravel') as typeof import('./eventTravel');
    const today = localDateKey(now);
    const [habits, tasks, done, day, meals, flexible, events, memory, doneTimes] = await Promise.all([
        // Done tasks too, like the Roadmap (lib/dataStore.ts): without them this line differed from
        // the one on screen and, saved over it, dropped where each done one had been.
        getHabits(), getTasks({ includeDone: true }), getCompletions(today), getDayWindow(), loadMeals(), loadMealsFlexible(), eventsFor(today).catch(() => []), loadMemory(),
        getCompletionTimes(today).catch(() => ({})),
    ]);
    const travel = await loadTravel().catch(() => ({}));
    const { loadReschedules, reschedulesFor } = require('./reschedule') as typeof import('./reschedule');
    const rescheduled = reschedulesFor(await loadReschedules().catch(() => ({ day: '', at: {} })), today);
    const { loadEndedEarly, endedFor } = require('./endedEarly') as typeof import('./endedEarly');
    const endedAll = await loadEndedEarly().catch(() => ({ day: '', at: {} }));
    const items = flowInputs({
        habits: habits.filter(habit => !habit.isGoal && !habit.isArchived && isHabitScheduledForDate(habit, now)),
        tasks: tasksForDay(tasks, today, today), done, doneTimes, day: today, meals: mealSlots(meals), events, travel, today, flexibleMeals: flexible,
        kept: memory.day === today ? memory.slots : undefined, planned: memory.day === today ? memory.planned : undefined,
        lapsed: memory.day === today ? memory.lapsed : undefined, wasDone: memory.day === today ? memory.done : undefined, again: memory.day === today ? memory.again : undefined,
        rescheduled, ended: endedFor(endedAll, today),
    });
    const { readAutoReschedule } = require('@/context/AppSettingsContext') as typeof import('@/context/AppSettingsContext');
    const auto = await readAutoReschedule();
    // The same window the Roadmap plans with: your best hours (where hard things
    // go) and the focus running now. Without them this timeline placed things
    // differently from the one on screen, and Focus opened on the wrong item.
    const peak = await rememberedPeak();
    const { peekFocusActiveId } = require('@/context/FocusTimeContext') as typeof import('@/context/FocusTimeContext');
    const minute = now.getHours() * 60 + now.getMinutes();
    const share = await getDayShare();
    if (options.ahead) return flowDay(items, null, { wake: minutesOf(day.wake), sleep: minutesOf(day.sleep), peak }, { auto, share });
    const flow = flowDay(items, minute, { wake: minutesOf(day.wake), sleep: minutesOf(day.sleep), peak, active: peekFocusActiveId() }, { auto, share });
    // Kept as shown, wherever today's line is worked out (the bar over the tab bar, notifications,
    // the Live Activity), not only on the Roadmap: without it, something just added had no place
    // to keep and was put at "now" again on every look, so its time never ran out.
    (require('./dayMemory') as typeof import('./dayMemory')).rememberFlow(today, flow, minute);
    return flow;
}

type Peak = { start: number; end: number } | null;
const PEAK_KEY = 'habyss_flow_peak';
let peakKnown: { value: Peak } | null = null;

/** Your best hours as the Roadmap last worked them out (lib/energyCurve.ts), kept for the timelines worked out elsewhere. */
async function rememberedPeak(): Promise<Peak> {
    if (peakKnown) return peakKnown.value;
    try {
        const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
        const raw = await AsyncStorage.getItem(PEAK_KEY);
        const value = raw ? JSON.parse(raw) as Peak : null;
        peakKnown = { value };
        return value;
    } catch {
        return null;
    }
}

function keepPeak(peak: Peak) {
    if (peakKnown && JSON.stringify(peakKnown.value) === JSON.stringify(peak)) return;
    peakKnown = { value: peak };
    const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
    void AsyncStorage.setItem(PEAK_KEY, JSON.stringify(peak)).catch(() => undefined);
}

/** Where each open habit and task starts and ends today, in minutes from midnight. */
export type TodayTimes = Record<string, {
    start: number; end: number; cutFrom?: number;
    /** Split around something fixed (rule 4): each part, in order, and what sits between each and the next. */
    parts?: { start: number; end: number }[];
    breaks?: (string | null)[];
}>;

/** The Roadmap's own timeline, the freshest truth, while it is from today. */
let latest: { day: string; flow: DayFlow; at: number } | null = null;
/** How long the Roadmap's timeline is taken as current: it moves with the minute only while on screen. */
const FRESH_MS = 90_000;
const fresh = (day: string) => !!latest && latest.day === day && Date.now() - latest.at < FRESH_MS;
export function rememberTodayFlow(day: string, flow: DayFlow, peak?: Peak) {
    latest = { day, flow, at: Date.now() };
    if (peak !== undefined) keepPeak(peak);
}

/** Today's timeline: the Roadmap's own while it is fresh, else worked out here the same way. */
export async function currentTodayFlow(now = new Date()): Promise<DayFlow | null> {
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const day = localDateKey(now);
    return fresh(day) ? latest!.flow : await todayFlow(now).catch(() => null);
}

/**
 * The next thing that cannot wait: a class or other calendar event, or the
 * walk to one (lib/eventTravel.ts), still ahead today. A focus session ends
 * there by itself (context/FocusTimeContext.tsx), so being deep in work never
 * makes you miss it. Not the way back, which follows the class. Pure.
 */
export function hardStopAfter(flow: DayFlow | null, now: number): { at: number; title: string } | null {
    const { isTravel } = require('./dayFlow') as typeof import('./dayFlow');
    const next = flow?.timeline
        .filter(item => item.kind === 'event' && !item.done && item.start > now && (!isTravel(item.id) || /:to$/.test(item.id)))
        .sort((a, b) => a.start - b.start)[0];
    return next ? { at: next.start, title: next.title } : null;
}

/**
 * Today's start and end for every open habit and task on the timeline: what
 * reminders, Echo's nudges and the Live Activity are timed from, so they follow
 * the auto-schedule rather than a time set once.
 */
export async function todayTimes(now = new Date()): Promise<TodayTimes> {
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const day = localDateKey(now);
    // No timeline to read: say so (reminders then keep the times they were given).
    const flow = fresh(day) ? latest!.flow : await todayFlow(now);
    // A split one (rule 4) runs from its first part's start to its last part's end,
    // and keeps its parts, so focus can stop where the first part does.
    const times: TodayTimes = {};
    for (const item of flow.timeline) {
        if (item.fixed || item.done || (item.kind !== 'habit' && item.kind !== 'task')) continue;
        const was = times[item.id];
        const part = { start: item.start, end: item.end };
        times[item.id] = was
            ? { ...was, start: Math.min(was.start, item.start), end: Math.max(was.end, item.end), parts: [...(was.parts ?? [{ start: was.start, end: was.end }]), part] }
            : { start: item.start, end: item.end, ...(item.cutFrom ? { cutFrom: item.cutFrom } : null) };
    }
    // What is in each gap between parts: the meal, the event or the exact-time thing that split it.
    for (const entry of Object.values(times)) {
        if (!entry.parts) continue;
        entry.parts.sort((a, b) => a.start - b.start);
        entry.breaks = entry.parts.slice(0, -1).map((part, index) => {
            const next = entry.parts![index + 1];
            const between = flow.timeline.find(other => other.start >= part.end && other.start < next.start);
            return between?.title ?? null;
        });
    }
    return times;
}

/**
 * Focusing all day: what comes next from `now` on today's timeline. A habit
 * or task not done yet, or a meal or calendar event not over yet, in the
 * order the timeline has them; `skip` is the one just finished (its tick may
 * still be saving). An exact-time one that has not started yet comes back
 * with `wait`: the free time before it is the step.
 */
export interface DayStep {
    item: import('./dayFlow').FlowItem; wait: boolean;
    /** A gap before it: free since this minute (the end of the last thing before now). */
    freeFrom?: number;
    /** Nothing on now: habits and tasks whose time went by unticked, which can be fitted in. */
    missed?: string[];
}
export function nextStep(flow: DayFlow | null, now: number, skip?: string): DayStep | null {
    // The next open thing on the line (lib/dayFlow.ts), in its order: a habit
    // or task still open whatever its slot says, a meal or event only until it is over.
    // What is on now comes first, then what comes after now, and only then
    // something whose time has already gone by (Done · Next after the 10:30
    // job used to go back to the 9:00 task, an hour over).
    const open = (flow?.timeline ?? [])
        .filter(entry => entry.id !== skip && !entry.done && entry.state !== 'done' && (!entry.fixed || entry.end > now))
        .sort((a, b) => a.start - b.start);
    const item = open.find(entry => entry.start <= now && entry.end > now)
        ?? open.find(entry => entry.start >= now)
        ?? open[0];
    if (!item) return null;
    // A habit or task can start straight away; a meal or an event waits for its time.
    const waits = !!item.fixed && item.start > now;
    if (item.start <= now && item.end > now) return { item, wait: waits };
    // Nothing on: what went by unticked can be fitted in (lib/dayMemory.ts bringBack).
    const missed = [...new Set((flow?.timeline ?? [])
        .filter(entry => !entry.done && !entry.fixed && !entry.locked && entry.id !== skip && (entry.part?.index ?? 1) === (entry.part?.of ?? 1) && entry.end <= now)
        .map(entry => entry.id))];
    const more = missed.length ? { missed } : null;
    // Free time until it: since the last thing before now ended (or since now, when nothing did).
    if (item.start > now) {
        const before = (flow?.timeline ?? []).filter(entry => entry.end <= now && entry.end > entry.start).map(entry => entry.end);
        return { item, wait: waits, freeFrom: before.length ? Math.max(...before) : now, ...more };
    }
    return { item, wait: waits, ...more };
}
