import type { CloudData } from '../types';
import { rowToHabit, rowToTask } from '../shared/rows';
import { isHabitScheduledForDate, localDateKey, setHistory } from '../shared/habitSchedule';
import { flowDay, flowInputs } from '../shared/dayFlow';
import { streakFrom, tallyDay } from '../shared/dayComplete';
import { goalProgress } from '../shared/goalInsights';
export interface TodayItem { id: string; kind: 'habit' | 'task'; title: string; done: boolean; skipped: boolean; start: number; end: number; state: 'done' | 'now' | 'next' | 'later'; locked: boolean; icon?: string; color?: string; goalId?: string }
export interface GoalSummary { id: string; name: string; percent: number; icon?: string; color?: string }
export interface Today { day: string; items: TodayItem[]; current: TodayItem | null; next: TodayItem | null; done: number; total: number; streak: number; goals: GoalSummary[]; goalsDone: number; goalsTotal: number; signedIn: boolean }
const DEFAULT_WINDOW = { wake: 420, sleep: 1380 };
export const minuteOfDay = (now: Date): number => now.getHours() * 60 + now.getMinutes();
const empty = (day: string, signedIn: boolean): Today => ({ day, items: [], current: null, next: null, done: 0, total: 0, streak: 0, goals: [], goalsDone: 0, goalsTotal: 0, signedIn });
const add = (map: Record<string, string[]>, day: string, id: string) => { (map[day] ??= []).push(id); };
export function buildToday(data: CloudData | null, opts: { now: Date; signedIn: boolean; window?: { wake: number; sleep: number } }): Today {
    const { now } = opts;
    const day = localDateKey(now);
    if (!data || !opts.signedIn)
        return empty(day, false);
    const history: Record<string, string[]> = {};
    const skips: Record<string, string[]> = {};
    const doneTimes: Record<string, string> = {};
    for (const c of data.completions) {
        if (c.deleted)
            continue;
        if (c.skipped) {
            add(skips, c.date, c.habit_id);
            continue;
        }
        add(history, c.date, c.habit_id);
        if (c.date === day && (c.updated_at ?? c.created_at))
            doneTimes[c.habit_id] = (c.updated_at ?? c.created_at) as string;
    }
    setHistory(history);
    const allHabits = data.habits.filter(h => !h.deleted).map(rowToHabit);
    const allTasks = data.tasks.filter(t => !t.deleted).map(rowToTask);
    const habits = allHabits.filter(h => !h.isGoal && !h.isArchived && isHabitScheduledForDate(h, now));
    const doneToday = (t: { completedAt?: string }) => t.completedAt !== undefined && Number.isFinite(new Date(t.completedAt).getTime()) && localDateKey(new Date(t.completedAt)) === day;
    const tasks = allTasks.filter(t => (t.status === 'open' || t.status === 'done') && (t.dueDate === day || (t.status === 'done' && doneToday(t))));
    const done: Record<string, boolean> = {};
    for (const id of history[day] ?? [])
        done[id] = true;
    const skipped: Record<string, boolean> = {};
    for (const id of skips[day] ?? [])
        skipped[id] = true;
    const flow = flowDay(flowInputs({ habits, tasks, done, doneTimes, day, today: day }), minuteOfDay(now), opts.window ?? DEFAULT_WINDOW);
    const goalOf = new Map<string, string>();
    for (const h of habits)
        if (h.goalId)
            goalOf.set(h.id, h.goalId);
    for (const t of tasks)
        if (t.goalId)
            goalOf.set(t.id, t.goalId);
    const items: TodayItem[] = flow.timeline.filter(i => i.kind === 'habit' || i.kind === 'task').map(i => ({ id: i.id, kind: i.kind as 'habit' | 'task', title: i.title, done: i.done, skipped: i.kind === 'habit' && !!skipped[i.id], start: i.start, end: i.end, state: i.state, locked: !!i.locked, icon: i.icon, color: i.color, goalId: goalOf.get(i.id) }));
    const current = items.find(i => i.state === 'now') ?? null;
    const next = items.find(i => i.state === 'next') ?? null;
    const tally = tallyDay(habits, done, skipped, tasks, day);
    const { streak } = streakFrom(allHabits, allTasks, history, skips, day);
    const goals = allHabits.filter(h => h.isGoal && !h.isArchived).map(goal => ({ id: goal.id, name: goal.name, percent: goalProgress({ goal, habits: allHabits, tasks: allTasks, history, skips, today: day }), icon: goal.icon, color: goal.color })).sort((a, b) => b.percent - a.percent);
    return { day, items, current, next, done: tally.done, total: tally.total, streak, goals, goalsDone: goals.filter(g => g.percent >= 100).length, goalsTotal: goals.length, signedIn: true };
}
