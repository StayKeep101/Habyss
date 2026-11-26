import { computeInsights, echoWeek } from '../echoInsights';
import { shiftDay } from '../habitDays';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-10-21';
const habit = (id: string, name: string, taskDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']): Habit =>
    ({ id, name, startDate: '2026-07-01', createdAt: '2026-07-01T09:00:00', taskDays } as Habit);
const task = (id: string, extra: Partial<Task>): Task => ({ id, title: id, status: 'open', ...extra } as Task);
const base = { habits: [] as Habit[], tasks: [] as Task[], history: [], completions: {}, today: TODAY, voice: 'normal' as const };

describe('what Echo notices', () => {
    it('counts a task late from its deadline, not from the day it was planned for', () => {
        // Planned three days ago, due by Friday: waiting, not late.
        const planned = task('Essay', { dueDate: shiftDay(TODAY, -3), deadline: shiftDay(TODAY, 2) });
        expect(computeInsights({ ...base, tasks: [planned] }).find(item => item.kind === 'stuck_task')).toBeUndefined();
        const late = task('Report', { dueDate: shiftDay(TODAY, -5), deadline: shiftDay(TODAY, -3) });
        const found = computeInsights({ ...base, tasks: [late] }).find(item => item.kind === 'stuck_task');
        expect(found?.evidence).toBe(`Due by ${shiftDay(TODAY, -3)}, 3 days ago.`);
    });

    it('reads the week as the last 7 calendar days, and the most consistent habit by share kept', () => {
        const daily = habit('d', 'Read');
        const weekly = habit('w', 'Run', ['mon', 'wed', 'fri']);
        // Two weeks ago, every day full: none of that is this week.
        const old = Array.from({ length: 7 }, (_, i) => ({ date: shiftDay(TODAY, -14 - i), completedIds: ['d', 'w'] }));
        // This week: Read kept 4 of 7, Run kept every time it was due.
        const week = Array.from({ length: 7 }, (_, i) => shiftDay(TODAY, -i));
        const runDays = week.filter(date => [1, 3, 5].includes(new Date(`${date}T12:00:00`).getDay()));
        const rows = week.map((date, i) => ({ date, completedIds: [...(i < 4 ? ['d'] : []), ...(runDays.includes(date) ? ['w'] : [])] }))
            .filter(row => row.date !== TODAY);
        const completions = { d: true, ...(runDays.includes(TODAY) ? { w: true } : {}) };
        const result = echoWeek([daily, weekly], [...old, ...rows], completions, TODAY);
        const activeDays = week.filter((date, i) => i < 4 || runDays.includes(date)).length;
        expect(result.weekConsistency).toBe(Math.round(activeDays / 7 * 100));
        expect(result.bestHabit).toBe('Run');
    });
});
