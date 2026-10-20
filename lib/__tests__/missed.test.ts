import { missed, missedDayLabel } from '../missed';
import { shiftDay, type HistoryDay } from '../habitDays';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-10-20';
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (id: string, name: string): Habit => ({ id, name, startDate: '2026-07-01', createdAt: '2026-07-01T09:00:00', taskDays: EVERY_DAY } as Habit);
const back = (n: number) => shiftDay(TODAY, -n);

describe('what was missed, day by day', () => {
    it('lists each missed habit with what happened the next time', () => {
        const habits = [habit('run', 'Run')];
        // Done every day except 3 and 2 days ago: missed twice, then done yesterday.
        const history: HistoryDay[] = Array.from({ length: 50 }, (_, i) => back(i + 1))
            .map(date => ({ date, completedIds: date === back(3) || date === back(2) ? [] : ['run'] }));
        const result = missed({ habits, history, completions: {}, tasks: [], today: TODAY });
        expect(result.days.map(day => day.day)).toEqual([back(2), back(3)]);
        expect(result.days[0].items[0]).toMatchObject({ title: 'Run', tone: 'recovered', outcome: 'Done Monday' });
        expect(result.days[1].items[0]).toMatchObject({ tone: 'again', outcome: 'Missed again Sunday' });
        expect(result.thisWeek).toBe(2);
    });

    it('says when a task was moved to the next day for you, or is still waiting', () => {
        const tasks = [
            { id: 'a', title: 'Essay', status: 'open', dueDate: back(2) },
            { id: 'b', title: 'Call', status: 'done', dueDate: back(4), completedAt: `${back(1)}T10:00:00` },
            { id: 'c', title: 'On time', status: 'done', dueDate: back(4), completedAt: `${back(4)}T10:00:00` },
        ] as Task[];
        const moves = [{ id: 'd', title: 'Slides', from: back(1), to: TODAY }];
        const result = missed({ habits: [], history: [], completions: {}, tasks, moves, today: TODAY });
        const all = result.days.flatMap(day => day.items);
        expect(all.find(item => item.title === 'Slides')).toMatchObject({ tone: 'moved', outcome: 'No room before bedtime, moved to today automatically' });
        expect(all.find(item => item.title === 'Essay')).toMatchObject({ tone: 'pending', outcome: 'Still to do, 2 days late' });
        expect(all.find(item => item.title === 'Call')).toMatchObject({ tone: 'late', outcome: 'Done 3 days late' });
        expect(all.find(item => item.title === 'On time')).toBeUndefined();
        expect(result.behind).toBe(1);
    });

    it('names the days plainly', () => {
        expect(missedDayLabel(back(1), TODAY)).toBe('Yesterday');
        expect(missedDayLabel(back(2), TODAY)).toBe('Sunday');
    });
});
