import { missed } from '../missed';
import { shiftDay, type HistoryDay } from '../habitDays';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-10-20';
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (id: string, name: string): Habit => ({ id, name, startDate: '2026-07-01', createdAt: '2026-07-01T09:00:00', taskDays: EVERY_DAY } as Habit);
const back = (n: number) => shiftDay(TODAY, -n);
/** Done every day for 50 days except the ones listed. */
const history = (id: string, missedDaysBack: number[]): HistoryDay[] => Array.from({ length: 50 }, (_, i) => i + 1)
    .map(n => ({ date: back(n), completedIds: missedDaysBack.includes(n) ? [] : [id] }));

describe('what is missed right now', () => {
    it('lists a habit missed twice in a row first, with how many times', () => {
        const habits = [habit('run', 'Run'), habit('read', 'Read')];
        const days = history('run', [1, 2, 3]).map((day, i) => ({ ...day, completedIds: [...day.completedIds, ...(i === 0 ? [] : ['read'])] }));
        const result = missed({ habits, history: days, completions: {}, tasks: [], today: TODAY });
        expect(result.items.map(item => [item.title, item.level, item.count])).toEqual([['Run', 'twice', 3], ['Read', 'once', 1]]);
        expect(result.items[0].line).toBe('Missed 3 times in a row, since Saturday. Due today.');
        expect(result.items[1].line).toBe("Missed Monday. Once is fine, don't make it twice. Due today.");
        expect(result.twice).toBe(1);
    });

    it('drops a habit once it is done, and an old miss already made up', () => {
        const habits = [habit('run', 'Run')];
        expect(missed({ habits, history: history('run', [1]), completions: { run: true }, tasks: [], today: TODAY }).items).toEqual([]);
        expect(missed({ habits, history: history('run', [3, 4]), completions: {}, tasks: [], today: TODAY }).items).toEqual([]);
    });

    it('lists late open tasks and the ones moved to today for you', () => {
        const tasks = [
            { id: 'a', title: 'Essay', status: 'open', dueDate: back(2) },
            { id: 'b', title: 'Done late', status: 'done', dueDate: back(4) },
            { id: 'c', title: 'Slides', status: 'open', dueDate: TODAY },
        ] as Task[];
        const moves = [{ id: 'c', title: 'Slides', from: back(1), to: TODAY }];
        const result = missed({ habits: [], history: [], completions: {}, tasks, moves, today: TODAY });
        expect(result.items.map(item => [item.title, item.level, item.line])).toEqual([
            ['Essay', 'late', '2 days late, due Sunday'],
            ['Slides', 'moved', 'No room yesterday, moved to today automatically'],
        ]);
    });
});

describe('a task with a deadline', () => {
    it('is not missed while its deadline is ahead, and says it was moved for you', () => {
        const tasks = [
            { id: 'p', title: 'Project', status: 'open', dueDate: TODAY, deadline: shiftDay(TODAY, 3) },
            { id: 'q', title: 'Past deadline', status: 'open', dueDate: back(3), deadline: back(1) },
        ] as Task[];
        const moves = [{ id: 'p', title: 'Project', from: back(1), to: TODAY, why: 'undone' as const }];
        const result = missed({ habits: [], history: [], completions: {}, tasks, moves, today: TODAY });
        expect(result.items.map(item => [item.title, item.level, item.line])).toEqual([
            ['Past deadline', 'late', 'A day late, due Monday'],
            ['Project', 'moved', 'Not done yesterday, moved to today. Due Friday'],
        ]);
    });
});
