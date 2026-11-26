import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { clearSamples, learnedMinutes, loadSamples, recordSamples, sampleFor, samplesOf, worthAdapting, type LengthSample } from './learnedLength';
import { earlierScores, keepScore, loadScores, rankAmong, scoreDay, type ScoreItem } from './dayScore';
import { buildDayReview, type Adaptation, type DayReview } from './dayReview';

/**
 * Putting the evening review together from the day itself (pure parts in
 * lib/learnedLength.ts, lib/dayScore.ts and lib/dayReview.ts):
 *
 *   1. one length sample per done habit and task (focus, else timeline);
 *   2. the day scored against how long each thing has been taking you;
 *   3. habits whose real length has drifted from the plan are changed, once a
 *      day, for next time: Echo says so in the review and Undo puts it back.
 *      Only habits that are a thing to finish; a habit that is a length of
 *      time ("read 30 minutes") is never shortened.
 *
 * Safe to run as often as Home likes: every step is idempotent for the day.
 */

const ADAPTED_KEY = 'habyss_adapted_lengths';
interface AdaptedDay { day: string; changes: (Adaptation & { field: 'durationMinutes' | 'endTime'; was: number | string | null })[] }

const toMinutes = (time?: string | null): number | null => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const toClock = (total: number) => `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const minuteOf = (iso?: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.getHours() * 60 + date.getMinutes();
};

async function readAdapted(): Promise<AdaptedDay | null> {
    try { return JSON.parse((await AsyncStorage.getItem(ADAPTED_KEY)) ?? 'null'); } catch { return null; }
}

export async function runDayReview(now = new Date(), options: { adapt?: boolean } = {}): Promise<DayReview & { adapted: Adaptation[] } | null> {
    const { localDateKey, isHabitScheduledForDate } = require('./habitSchedule') as typeof import('./habitSchedule');
    const { getHabits, getCompletions, getSkipped, getCompletionTimes, updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { loadedData } = require('./dataStore') as typeof import('./dataStore');
    const { currentMemory, loadMemory } = require('./dayMemory') as typeof import('./dayMemory');
    const { currentFocusRecords, loadFocusRecords } = require('./focusStats') as typeof import('./focusStats');
    const { measurementFor } = require('./habitMeasurement') as typeof import('./habitMeasurement');
    const { habitMinutes } = require('./dayPlan') as typeof import('./dayPlan');
    const { doneOnDay } = require('./dailyFocus') as typeof import('./dailyFocus');
    const { countedTasks } = require('./sharedGate') as typeof import('./sharedGate');

    const day = localDateKey(now);
    const [habits, done, skipped, times, data] = await Promise.all([
        getHabits(), getCompletions(day), getSkipped(day), getCompletionTimes(day), loadedData(),
        loadMemory(), loadFocusRecords(), loadSamples(), loadScores(),
    ]);
    const memory = currentMemory();
    const planned = memory.day === day ? { ...memory.slots, ...(memory.planned ?? {}) } : {};
    const focusOf = new Map<string, number>();
    for (const record of currentFocusRecords()) if (record.date === day) focusOf.set(record.itemId, (focusOf.get(record.itemId) ?? 0) + record.seconds);

    const date = new Date(`${day}T12:00:00`);
    const due = habits.filter((habit: Habit) => !habit.isArchived && !skipped[habit.id] && isHabitScheduledForDate(habit, date));
    const tasks = countedTasks(data.tasks).filter((task: Task) => task.status !== 'cancelled' && (doneOnDay(task, day) || (task.status === 'open' && task.dueDate === day)));

    // 1. Today's samples, before anything learnt is read, so today is judged against the days before it.
    const before = new Map<string, LengthSample[]>();
    const fresh: Record<string, LengthSample> = {};
    const items: ScoreItem[] = [];
    const plannedOf = (id: string, fallback: number) => {
        const slot = planned[id];
        return slot && slot.end > slot.start ? slot.end - slot.start : fallback;
    };
    for (const habit of due) {
        const isDone = !!done[habit.id];
        const plan = habitMinutes(habit) || plannedOf(habit.id, 0);
        const timed = measurementFor(habit).kind === 'timer';
        before.set(habit.id, samplesOf(habit.id).filter(sample => sample.day !== day));
        const sample = isDone ? sampleFor({ day, planned: planned[habit.id], doneAt: minuteOf(times[habit.id]), focusSeconds: focusOf.get(habit.id) }) : null;
        if (sample) fresh[habit.id] = sample;
        const learned = learnedMinutes(before.get(habit.id)!, plan, day);
        items.push({ id: habit.id, title: habit.name, kind: 'habit', done: isDone, expected: learned ?? plan, actual: sample?.minutes ?? null, timed });
    }
    for (const task of tasks) {
        const isDone = doneOnDay(task, day);
        const plan = Number(task.estimatedMinutes) > 0 ? Number(task.estimatedMinutes) : plannedOf(task.id, 0);
        const sample = isDone ? sampleFor({ day, planned: planned[task.id], doneAt: minuteOf(task.completedAt), focusSeconds: focusOf.get(task.id) }) : null;
        if (sample) fresh[task.id] = sample;
        items.push({ id: task.id, title: task.title, kind: 'task', done: isDone, expected: plan, actual: sample?.minutes ?? null, timed: task.measure === 'time' });
    }
    if (!items.length) return null;
    await recordSamples(fresh);

    // 2. Scored, and kept for comparing days.
    const score = scoreDay(items);
    const all = await loadScores();
    const rank = rankAmong(score.score, earlierScores(all, day));
    await keepScore(day, score.score);

    // 3. Habits whose real length has drifted: changed once a day.
    let adaptedDay = await readAdapted();
    if (options.adapt !== false && adaptedDay?.day !== day) {
        const changes: AdaptedDay['changes'] = [];
        for (const habit of due) {
            if (!done[habit.id] || measurementFor(habit).kind === 'timer') continue;
            const plan = habitMinutes(habit);
            const learned = learnedMinutes(samplesOf(habit.id), plan, day);
            if (!worthAdapting(plan, learned)) continue;
            const start = toMinutes(habit.startTime);
            const end = toMinutes(habit.endTime);
            if (start !== null && end !== null && end > start) {
                const next = Math.min(start + learned, 24 * 60 - 1);
                changes.push({ id: habit.id, title: habit.name, from: plan, to: next - start, field: 'endTime', was: habit.endTime ?? null });
                await updateHabit({ id: habit.id, endTime: toClock(next) }).catch(() => undefined);
            } else {
                changes.push({ id: habit.id, title: habit.name, from: plan, to: learned, field: 'durationMinutes', was: habit.durationMinutes ?? null });
                await updateHabit({ id: habit.id, durationMinutes: learned }).catch(() => undefined);
            }
        }
        adaptedDay = { day, changes };
        await AsyncStorage.setItem(ADAPTED_KEY, JSON.stringify(adaptedDay)).catch(() => undefined);
    }

    const adapted = (adaptedDay?.day === day ? adaptedDay.changes : []).map(({ id, title, from, to }) => ({ id, title, from, to }));
    const left = items.filter(item => !item.done).map(item => item.title);
    const { getEchoPersonality } = require('./echo') as typeof import('./echo');
    const voice = await getEchoPersonality().catch(() => 'normal');
    const bestHours = await peakLabel(now).catch(() => null);
    return { ...buildDayReview({ score, rank, adapted, left, bestHours, voice }), adapted };
}

/** Puts a habit's length back the way it was before tonight's change. */
export async function undoAdaptation(id: string): Promise<void> {
    const adaptedDay = await readAdapted();
    const change = adaptedDay?.changes.find(item => item.id === id);
    if (!adaptedDay || !change) return;
    const { updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    await updateHabit(change.field === 'endTime' ? { id, endTime: (change.was as string | null) ?? undefined } : { id, durationMinutes: (change.was as number | null) ?? undefined });
    // A length taken back is a choice: its samples go, so it is not changed again tomorrow.
    await clearSamples(id);
    adaptedDay.changes = adaptedDay.changes.filter(item => item.id !== id);
    await AsyncStorage.setItem(ADAPTED_KEY, JSON.stringify(adaptedDay)).catch(() => undefined);
}

/** "9–12", your best three hours, when Echo is sure of them. */
async function peakLabel(now: Date): Promise<string | null> {
    const { energyCurve } = require('./energyCurve') as typeof import('./energyCurve');
    const { currentCheckIns, loadCheckIns } = require('./checkIns') as typeof import('./checkIns');
    const { currentFocusRecords } = require('./focusStats') as typeof import('./focusStats');
    await loadCheckIns();
    const curve = energyCurve({ checkIns: currentCheckIns().entries, focus: currentFocusRecords(), now });
    if (!curve.peak) return null;
    const hour = (value: number) => { const h = Math.floor(value / 60) % 24; return String(h % 12 || 12); };
    return `${hour(curve.peak.start)}–${hour(curve.peak.end)}`;
}
