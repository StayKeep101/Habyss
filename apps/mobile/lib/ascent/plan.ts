import type { Habit } from '../habitsSQLite';
import { suggestions, type Answers, type WhenId } from './story';

/**
 * What the Ascent saves: the first step toward what was chosen, through the
 * app's own storage (the same calls the habit and task sheets make), once.
 * The story waits for this; nothing visual depends on it succeeding, and a
 * second call with what was already made returns that instead of a copy.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** When the first step happens: now (to the next five minutes), this evening, or tomorrow morning. */
export function whenOf(when: WhenId | undefined, now = new Date()): { date: string; time: string } {
    if (when === 'tomorrow') {
        const date = new Date(now); date.setDate(now.getDate() + 1);
        return { date: keyOf(date), time: '09:00' };
    }
    if (when === 'later') {
        const evening = now.getHours() < 18 ? '18:00' : `${pad(Math.min(23, now.getHours() + 1))}:00`;
        return { date: keyOf(now), time: evening };
    }
    const minutes = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 5) * 5;
    return { date: keyOf(now), time: `${pad(Math.min(23, Math.floor(minutes / 60)))}:${pad(minutes % 60)}` };
}

/** The first step as the app will hold it. */
export function stepOf(answers: Answers) {
    const chosen = suggestions(answers).find(item => item.label === answers.action);
    const kind = answers.actionKind ?? chosen?.kind ?? 'task';
    const minutes = chosen?.minutes ?? 15;
    return { title: (answers.action ?? '').trim() || 'My first step', kind, minutes };
}

export async function commitPlan(answers: Answers, made?: { stepId: string; stepKind: 'task' | 'habit' }, now = new Date()):
    Promise<{ stepId: string; stepKind: 'task' | 'habit' }> {
    const { addHabit, getHabits } = require('../habitsSQLite') as typeof import('../habitsSQLite');
    const { createTask, getTasks } = require('../tasks') as typeof import('../tasks');
    const { emit } = require('../appEvents') as typeof import('../appEvents');

    // Already saved (a replay, or a resume after the save): keep it.
    if (made) {
        const [habits, tasks] = await Promise.all([getHabits(), getTasks({ includeDone: true })]);
        const stepThere = made.stepKind === 'habit' ? habits.some(habit => habit.id === made.stepId) : tasks.some(task => task.id === made.stepId);
        if (stepThere) return made;
    }

    const step = stepOf(answers);
    const at = whenOf(answers.when, now);
    if (step.kind === 'habit') {
        const habit = await addHabit({
            name: step.title, type: 'build', category: 'personal', icon: 'repeat', frequency: 'daily', taskDays: [],
            startDate: at.date, goalPeriod: 'daily', goalValue: 1, unit: 'time', trackingMethod: 'boolean',
            startTime: at.time, durationMinutes: step.minutes, reminders: [],
        } as Partial<Habit>);
        if (!habit?.id) throw new Error('The first step could not be saved.');
        return { stepId: habit.id, stepKind: 'habit' };
    }
    const task = await createTask({
        title: step.title, dueDate: at.date, dueTime: at.time, estimatedMinutes: step.minutes, priority: 1,
        // A focus step is measured in time, so Focus opens straight onto its length.
        ...(step.kind === 'focus' ? { measure: 'time' as const, target: step.minutes, unit: 'min' } : {}),
    });
    if (!task?.id) throw new Error('The first step could not be saved.');
    emit('tasks_changed');
    return { stepId: task.id, stepKind: 'task' };
}
