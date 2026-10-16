import { buildDayCard, cardShare, sameCard } from '../dayCard';
import { buildThread, preview, type ChatMessage, type StoredDayCard } from '../chatThread';
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

describe('a chat thread', () => {
    const message = (id: string, from: string, at: string): ChatMessage => ({ id, fromUser: from, toUser: from === 'me' ? 'sam' : 'me', body: id, createdAt: at });
    const day = (userId: string, date: string, updatedAt: string, total = 2): StoredDayCard => ({
        userId, day: date, updatedAt,
        card: { habitsDone: 1, habitsTotal: total, tasksDone: 0, tasksTotal: 0, streak: 1 },
    });

    it('puts each day card after that day’s messages and leaves out empty days', () => {
        const thread = buildThread('me', [
            message('hi', 'sam', '2026-10-14T10:00:00.000Z'),
            message('yo', 'me', '2026-10-15T08:00:00.000Z'),
        ], [
            day('sam', '2026-10-14', '2026-10-15T09:00:00.000Z'),
            day('me', '2026-10-13', '2026-10-13T12:00:00.000Z', 0),
        ]);
        expect(thread.map(item => item.id)).toEqual(['m:hi', 'c:sam:2026-10-14', 'm:yo']);
        expect(thread[2].mine).toBe(true);
    });

    it('previews the newest item', () => {
        const [item] = buildThread('me', [message('see you', 'me', '2026-10-15T08:00:00.000Z')], []);
        expect(preview(item)).toBe('You: see you');
    });
});
