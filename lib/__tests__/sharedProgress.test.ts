import { friendHistory, peopleColors, togetherHistory } from '../sharedProgress';
import { consistencyFrom } from '../habitRecord';

const days = (dates: string[], done: string[] = []) => dates.map(date => ({ date, scheduled: true, skipped: false, completed: done.includes(date) }));
const week = ['2026-11-01', '2026-11-02', '2026-11-03'];

describe('a shared habit, person by person', () => {
    it("a friend's days follow the habit's schedule, ticked where they ticked", () => {
        expect(friendHistory(days(week), new Set(['2026-11-02'])).map(day => day.completed)).toEqual([false, true, false]);
    });
    it('together: done once all of you did it, shaded by how many did', () => {
        const all = togetherHistory([days(week, ['2026-11-01', '2026-11-02']), days(week, ['2026-11-02'])]);
        expect(all.map(day => [day.completed, day.share])).toEqual([[false, 0.5], [true, 1], [false, 0]]);
    });
    it('gives each person a colour of their own, you in the habit colour', () => {
        expect(peopleColors('#a', ['#b', '#a', '#c'], 4)).toEqual(['#a', '#b', '#c', '#b']);
    });
    it('consistency starts on the day the habit began, so everyone starts on the left', () => {
        const line = consistencyFrom(days(week, week), '2026-11-03', '2026-11-01', 0);
        expect(line.map(point => point.date)).toEqual(week);
        expect(line[2].share).toBe(1);
    });
});
