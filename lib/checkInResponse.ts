import type { CheckInKind } from './checkIns';
import type { Task } from './tasks';

/**
 * What Echo does with an answer, not just what it says. Low energy: today gets
 * lighter (the hardest task moves to tomorrow, one tap). High energy: the
 * hardest thing now, with the focus timer. A low mood: the habit your own
 * record says lifts it, or the smallest win on the list. A good mood: the task
 * you keep putting off. Okay: noted, and a nudge to start small. Pure.
 */
export type CheckInAction =
    | { kind: 'move_tomorrow'; label: string; taskId: string }
    | { kind: 'focus'; label: string; item: 'task' | 'habit'; id: string; title: string; minutes?: number }
    | { kind: 'open_habit'; label: string; id: string }
    | { kind: 'done'; label: string };

export interface CheckInResponse { line: string; actions: CheckInAction[] }

export interface ResponseInput {
    kind: CheckInKind;
    value: 1 | 2 | 3 | 4 | 5;
    /** Open tasks planned for today or late. */
    tasks: Task[];
    /** Habits due today and not done yet, smallest first is not known: in the day's order. */
    habitsLeft: { id: string; name: string }[];
    /** The habit your mood is better on (Echo's mood_habit pattern), if any. */
    moodHabit?: { id: string; name: string } | null;
    today: string;
}

const hardness = (task: Task) => (task.difficulty ?? 2) * 10 + (task.estimatedMinutes ?? 30) / 10;
const quote = (title: string) => `“${title}”`;

export function respondToCheckIn(input: ResponseInput): CheckInResponse {
    const { kind, value, tasks, habitsLeft, moodHabit, today } = input;
    const open = tasks.filter(task => task.status === 'open' && (!task.dueDate || task.dueDate <= today));
    const hardest = [...open].sort((a, b) => hardness(b) - hardness(a))[0];
    // The one put off longest: made earliest and still open.
    const stuck = [...open].filter(task => task.createdAt && task.createdAt.slice(0, 10) < today)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const smallestHabit = habitsLeft[0];
    const keep: CheckInAction = { kind: 'done', label: 'Keep today as is' };

    if (kind === 'energy') {
        if (value <= 2) {
            if (hardest && open.length > 1) return {
                line: `Low battery. Let's protect it: move ${quote(hardest.title)} to tomorrow, and today is only what really matters.`,
                actions: [{ kind: 'move_tomorrow', label: 'Move it to tomorrow', taskId: hardest.id }, keep],
            };
            if (smallestHabit) return {
                line: `Low battery. Do one small thing, ${smallestHabit.name}, and call today a win.`,
                actions: [{ kind: 'focus', label: `10 min of ${smallestHabit.name}`, item: 'habit', id: smallestHabit.id, title: smallestHabit.name, minutes: 10 }, { kind: 'done', label: 'Not now' }],
            };
            return { line: 'Low battery, light day. Rest is part of the plan too.', actions: [{ kind: 'done', label: 'Got it' }] };
        }
        if (value >= 4 && hardest) return {
            line: `Full battery. Spend it on the hardest thing first: ${quote(hardest.title)}.`,
            actions: [{ kind: 'focus', label: 'Start focus on it', item: 'task', id: hardest.id, title: hardest.title }, { kind: 'done', label: 'Later' }],
        };
        if (value >= 4 && smallestHabit) return {
            line: `Full battery and the list is clear. Knock out ${smallestHabit.name} while you're charged.`,
            actions: [{ kind: 'focus', label: `Start ${smallestHabit.name}`, item: 'habit', id: smallestHabit.id, title: smallestHabit.name }, { kind: 'done', label: 'Later' }],
        };
        return {
            line: value >= 4 ? 'Full battery and nothing left. Rare. Enjoy it.' : 'Okay is enough. Start with the easiest thing; momentum does the rest.',
            actions: [{ kind: 'done', label: 'Got it' }],
        };
    }

    // Mood.
    if (value <= 2) {
        const lift = moodHabit && habitsLeft.some(habit => habit.id === moodHabit.id) ? moodHabit : null;
        if (lift) return {
            line: `Rough one. Your own record says days you do ${lift.name} feel better. Want to do it now?`,
            actions: [{ kind: 'focus', label: `Start ${lift.name}`, item: 'habit', id: lift.id, title: lift.name }, { kind: 'done', label: 'Not now' }],
        };
        if (smallestHabit) return {
            line: `Rough one. One small win changes a day: ${smallestHabit.name}. Just that.`,
            actions: [{ kind: 'focus', label: `10 min of ${smallestHabit.name}`, item: 'habit', id: smallestHabit.id, title: smallestHabit.name, minutes: 10 }, { kind: 'done', label: 'Not now' }],
        };
        return { line: "Rough one. Nothing left on the list, so be easy on yourself tonight.", actions: [{ kind: 'done', label: 'Thanks' }] };
    }
    if (value >= 4 && stuck) return {
        line: `Good mood is rare fuel. Use it on the one you keep putting off: ${quote(stuck.title)}.`,
        actions: [{ kind: 'focus', label: 'Start focus on it', item: 'task', id: stuck.id, title: stuck.title }, { kind: 'done', label: 'Later' }],
    };
    return {
        line: value >= 4 ? "Love that. I'll remember what today looked like." : "Noted. I'll learn what makes the good days.",
        actions: [{ kind: 'done', label: 'Got it' }],
    };
}
