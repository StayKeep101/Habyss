import { yearFromCards } from '../friendYear';

it('fills each day by how much of it was done', () => {
    const days = yearFromCards([
        { day: '2026-11-20', card: { habitsDone: 3, habitsTotal: 4, tasksDone: 1, tasksTotal: 0 } },
        { day: '2026-11-19', card: { habitsDone: 0, habitsTotal: 2, tasksDone: 0, tasksTotal: 0 } },
    ]);
    expect(days.find(day => day.date === '2026-11-20')!.fill).toBe(1);
    expect(days.find(day => day.date === '2026-11-19')!.fill).toBe(0);
});
