import { buildDayCard, cardShare, sameCard } from '../dayCard';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit>): Habit => ({
    id: 'h', name: 'Run', startDate: '2026-09-01', createdAt: '2026-09-01', taskDays: EVERY_DAY, ...over,
} as Habit);
const task = (over: Partial<Task>): Task => ({
    id: 't', title: 'Task', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-09-01', updatedAt: '2026-09-01', ...over,
});

describe('the day card', () => {
    const card = buildDayCard({
        habits: [habit({ id: 'run', name: 'Run' }), habit({ id: 'read', name: 'Read' }), habit({ id: 'swim', name: 'Swim' })],
        tasks: [
            task({ id: 'call', title: 'Call mum', dueDate: '2026-10-15', status: 'done', completedAt: '2026-10-15T09:00:00' }),
            task({ id: 'tax', title: 'Taxes', dueDate: '2026-10-15' }),
        ],
        history: { '2026-10-15': ['run'] },
        skips: { '2026-10-15': ['swim'] },
        day: '2026-10-15',
        streak: 4,
    });

    it('names what was done and what was not, habits and tasks', () => {
        expect(card.habits).toEqual([
            { name: 'Run', done: true }, { name: 'Read', done: false }, { name: 'Swim', done: false, skipped: true },
        ]);
        expect(card.tasks).toEqual([{ name: 'Call mum', done: true }, { name: 'Taxes', done: false }]);
    });

    it('counts a skipped habit as neither done nor asked for', () => {
        expect([card.habitsDone, card.habitsTotal, card.tasksDone, card.tasksTotal]).toEqual([1, 2, 1, 2]);
        expect(cardShare(card)).toBe(0.5);
        expect(card.streak).toBe(4);
    });

    it('knows when nothing changed, so nothing is sent', () => {
        expect(sameCard(card, { ...card })).toBe(true);
        expect(sameCard(card, { ...card, habitsDone: 2 })).toBe(false);
        expect(sameCard(null, card)).toBe(false);
    });
});

describe('what a friend reads off the card', () => {
    it('carries active habits and goals, and which goals moved today', () => {
        const goal = habit({ id: 'g', name: 'Marathon', isGoal: true });
        const card = buildDayCard({
            habits: [goal, habit({ id: 'run', name: 'Run', goalId: 'g' }), habit({ id: 'read', name: 'Read' }), habit({ id: 'old', name: 'Old', isArchived: true })],
            tasks: [],
            history: { '2026-10-15': ['run'] },
            skips: {},
            day: '2026-10-15',
            streak: 1,
        });
        expect([card.habitsActive, card.goalsActive, card.goalsMoved]).toEqual([2, 1, 1]);
    });
});
