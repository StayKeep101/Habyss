import type { PersonalityModeId } from '@/constants/AIPersonalities';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { habitDays, keptRate, shiftDay, type HabitDay, type HistoryDay } from './habitDays';
import { habitMomentum, momentum } from './momentum';
import { recovery } from './recovery';
import type { Energy } from './echoMemory';

/**
 * What Echo notices, read straight off the person's own record.
 *
 * Every insight is computed here, deterministically, from habits, tasks and
 * check-ins; each one carries the numbers behind it (`evidence`) and is only
 * produced when there is enough data to say it honestly. No model is involved:
 * an insight can never invent a streak, a pattern or a reason. The voice only
 * changes how it is said.
 *
 * Cheap on purpose: a few passes over at most eight weeks of days, run when a
 * screen opens, never in the background.
 */

export type InsightKind = 'missed_twice' | 'stuck_task' | 'heavy_day' | 'slipping' | 'goal_no_steps' | 'win' | 'weekday_pattern';
export type InsightAction =
    | { type: 'start'; item: string; title: string }
    | { type: 'experiment'; habitId: string }
    | { type: 'open'; path: string; params?: Record<string, string> }
    | { type: 'remember'; key: string; text: string; evidence: string };

export interface Insight {
    /** Stable, so a dismissed insight stays dismissed: "stuck_task:<id>". */
    id: string;
    kind: InsightKind;
    priority: number;
    text: string;
    /** The numbers behind it, in words. Shown under the line. */
    evidence: string;
    action?: InsightAction;
    actionLabel?: string;
}

export interface InsightInput {
    habits: Habit[];
    tasks: Task[];
    history: HistoryDay[];
    completions: Record<string, boolean>;
    today: string;
    voice: PersonalityModeId;
    energy?: Energy | null;
    /** Insight ids dismissed until a day (inclusive). */
    dismissed?: Record<string, string>;
    /** Pattern keys already in memory, so they are not offered again. */
    remembered?: string[];
}

type Voice = 'supportive' | 'direct' | 'challenging';
const voiceOf = (id: PersonalityModeId): Voice => id === 'friendly' ? 'supportive' : id === 'normal' ? 'direct' : 'challenging';
const say = (voice: Voice, lines: Record<Voice, string>) => lines[voice];

const daysBetween = (from: string, to: string) => {
    const [a, b] = [from, to].map(key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); });
    return Math.round((b - a) / 86400000);
};

export function computeInsights(input: InsightInput): Insight[] {
    const { habits, tasks, history, completions, today } = input;
    const voice = voiceOf(input.voice);
    const low = input.energy === 'low';
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived);
    const out: Insight[] = [];

    // 1. Never miss twice: missed last time, due again today, not done yet.
    const bounce = recovery(habits, history, completions, 30, today);
    for (const habit of bounce.atRisk.slice(0, 2)) {
        out.push({
            id: `missed_twice:${habit.id}:${today}`,
            kind: 'missed_twice',
            priority: 90,
            text: say(voice, {
                supportive: `${habit.name} slipped last time. Today is the easy win back.`,
                direct: `${habit.name}: missed last time. Do it today and it stays a blip.`,
                challenging: `${habit.name} was missed. Twice in a row is how habits die. Not today.`,
            }),
            evidence: `Missed on ${habit.lastMiss ?? 'its last day'}, due again today.`,
            action: { type: 'start', item: `habit:${habit.id}`, title: habit.name },
            actionLabel: low ? 'Smallest version' : 'Start now',
        });
    }

    // 2. A task that keeps not starting: overdue two days or more, still open.
    const stuck = tasks
        .filter(task => task.status === 'open' && task.dueDate && daysBetween(task.dueDate, today) >= 2)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    for (const task of stuck.slice(0, 1)) {
        const late = daysBetween(task.dueDate!, today);
        out.push({
            id: `stuck_task:${task.id}`,
            kind: 'stuck_task',
            priority: 80,
            text: say(voice, {
                supportive: `“${task.title}” has been waiting a while. Want a tiny first step?`,
                direct: `“${task.title}” is ${late} days late. Two minutes on it gets it moving.`,
                challenging: `“${task.title}”: ${late} days late. Start it now, two minutes, no excuses.`,
            }),
            evidence: `Due ${task.dueDate}, ${late} days ago.`,
            action: { type: 'start', item: `task:${task.id}`, title: task.title },
            actionLabel: 'Two-minute start',
        });
    }

    // 3. A heavy day: far more due than this person usually finishes.
    const recent = habitDays(habits, history, completions, 14, shiftDay(today, -1), today);
    const doneCounts = recent.map(day => day.done.length).sort((a, b) => a - b);
    const typical = doneCounts.length ? doneCounts[Math.floor(doneCounts.length / 2)] : 0;
    const todayDays = habitDays(habits, history, completions, 1, today, today);
    const dueHabits = (todayDays[0]?.scheduled.length ?? 0) - (todayDays[0]?.done.length ?? 0);
    const dueTasks = tasks.filter(task => task.status === 'open' && task.dueDate === today).length;
    const due = dueHabits + dueTasks;
    const heavyAt = Math.max(6, Math.ceil(typical * (low ? 1.2 : 1.6)));
    if (recent.some(day => day.scheduled.length > 0) && due >= heavyAt) {
        out.push({
            id: `heavy_day:${today}`,
            kind: 'heavy_day',
            priority: low ? 85 : 70,
            text: say(voice, {
                supportive: `Today is full. Pick the three that matter; the rest can wait without guilt.`,
                direct: `${due} things today, and you usually finish about ${typical}. Choose three.`,
                challenging: `${due} on the list. Pick your three and finish them before anything else.`,
            }),
            evidence: `${due} due today; about ${typical} done on a typical day over the last two weeks.`,
            action: { type: 'open', path: '/task-stats' },
            actionLabel: 'Pick three',
        });
    }

    // 4. A habit slipping: clearly down on its own last fortnight.
    const slipping = habitMomentum(habits, history, completions, 14, today)
        .filter(item => item.comparable && item.countable >= 6 && item.delta <= -25 && item.rate < 60);
    for (const habit of slipping.slice(0, 1)) {
        out.push({
            id: `slipping:${habit.id}`,
            kind: 'slipping',
            priority: 60,
            text: say(voice, {
                supportive: `${habit.name} has been harder lately. A 7-day experiment could find what makes it easier.`,
                direct: `${habit.name} dropped to ${habit.rate}%. Try a 7-day experiment to fix it.`,
                challenging: `${habit.name} is down to ${habit.rate}%. Change something for 7 days and see.`,
            }),
            evidence: `${habit.kept} of ${habit.countable} kept in the last 14 days, ${Math.abs(habit.delta)} points below the 14 before.`,
            action: { type: 'experiment', habitId: habit.id },
            actionLabel: 'See the experiment',
        });
    }

    // 5. A goal with nothing under it: no habit, no task, nothing to do today.
    for (const goal of habits.filter(habit => habit.isGoal && !habit.isArchived)) {
        const hasHabit = active.some(habit => habit.goalId === goal.id);
        const hasTask = tasks.some(task => task.goalId === goal.id && task.status !== 'cancelled');
        if (hasHabit || hasTask) continue;
        out.push({
            id: `goal_no_steps:${goal.id}`,
            kind: 'goal_no_steps',
            priority: 50,
            text: say(voice, {
                supportive: `“${goal.name}” has no steps yet. One small habit or task makes it real.`,
                direct: `“${goal.name}” has nothing under it. Add the first step.`,
                challenging: `“${goal.name}” is a wish until it has a step. Add one.`,
            }),
            evidence: 'No habits or tasks are linked to it.',
            action: { type: 'open', path: '/goal-detail', params: { goalId: goal.id } },
            actionLabel: 'Add a step',
        });
        break;
    }

    // 6. A real win: the last 30 days clearly better than the 30 before.
    const trend = momentum(habits, history, completions, 30, today);
    if (trend.comparable && trend.delta >= 10 && trend.countable >= 20) {
        out.push({
            id: `win:${today.slice(0, 7)}`,
            kind: 'win',
            priority: 40,
            text: say(voice, {
                supportive: `You’re keeping ${trend.rate}% of your habits, up from ${trend.previous}%. That is real progress.`,
                direct: `${trend.rate}% kept this month, up ${trend.delta} points. It’s working.`,
                challenging: `Up ${trend.delta} points to ${trend.rate}%. Good. Now hold it.`,
            }),
            evidence: `${trend.kept} of ${trend.countable} kept in the last 30 days; ${trend.previous}% the 30 before.`,
        });
    }

    // 7. A weekday/weekend pattern, only with enough of both to be fair.
    const eight = habitDays(habits, history, completions, 56, shiftDay(today, -1), today);
    const rememberedKeys = new Set(input.remembered ?? []);
    for (const habit of active) {
        const pattern = weekdayPattern(eight, habit.id);
        if (!pattern) continue;
        const key = `weekday:${habit.id}:${pattern.better}`;
        if (rememberedKeys.has(key)) continue;
        const better = pattern.better === 'weekdays' ? 'weekdays' : 'weekends';
        const worse = pattern.better === 'weekdays' ? 'weekends' : 'weekdays';
        const evidence = `${pattern.weekday.kept}/${pattern.weekday.countable} on weekdays, ${pattern.weekend.kept}/${pattern.weekend.countable} on weekends, last 8 weeks.`;
        out.push({
            id: `weekday_pattern:${habit.id}`,
            kind: 'weekday_pattern',
            priority: 30,
            text: `${habit.name} happens far more on ${better} than ${worse}. Worth planning ${worse} differently.`,
            evidence,
            action: { type: 'remember', key, text: `${habit.name} goes better on ${better}.`, evidence },
            actionLabel: 'Remember this',
        });
        break;
    }

    const dismissed = input.dismissed ?? {};
    return out
        .filter(insight => !(dismissed[insight.id] && dismissed[insight.id] >= today))
        .sort((a, b) => b.priority - a.priority);
}

/** Weekday vs weekend kept rate for one habit, when both sides have enough days and differ clearly. */
export function weekdayPattern(days: HabitDay[], habitId: string): {
    better: 'weekdays' | 'weekends';
    weekday: ReturnType<typeof keptRate>;
    weekend: ReturnType<typeof keptRate>;
} | null {
    const only = (source: HabitDay[]) => source.map(day => ({
        date: day.date,
        scheduled: day.scheduled.filter(id => id === habitId),
        done: day.done.filter(id => id === habitId),
        skipped: day.skipped.filter(id => id === habitId),
    }));
    const isWeekend = (key: string) => { const [y, m, d] = key.split('-').map(Number); const dow = new Date(y, m - 1, d).getDay(); return dow === 0 || dow === 6; };
    const weekday = keptRate(only(days.filter(day => !isWeekend(day.date))));
    const weekend = keptRate(only(days.filter(day => isWeekend(day.date))));
    if (weekday.countable < 8 || weekend.countable < 4) return null;
    const gap = weekday.rate - weekend.rate;
    if (Math.abs(gap) < 30) return null;
    return { better: gap > 0 ? 'weekdays' : 'weekends', weekday, weekend };
}
