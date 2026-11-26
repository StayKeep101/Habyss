import { activityWeek, clockMinutes, sleepWeek } from '../healthStats';
import { sleepNight } from '../sleepMath';

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('sleepNight', () => {
    it('reads stages in order, with bed and wake, and merges two sources', () => {
        const night = sleepNight([
            { value: 'CORE', startDate: iso(at(21, 23, 30)), endDate: iso(at(22, 1)) },
            { value: 'DEEP', startDate: iso(at(22, 1)), endDate: iso(at(22, 2)) },
            { value: 'AWAKE', startDate: iso(at(22, 2)), endDate: iso(at(22, 2, 10)) },
            { value: 'REM', startDate: iso(at(22, 2, 10)), endDate: iso(at(22, 3)) },
            // A ring said core over the same deep hour: deep wins.
            { value: 'CORE', startDate: iso(at(22, 1)), endDate: iso(at(22, 2)) },
            { value: 'INBED', startDate: iso(at(21, 23)), endDate: iso(at(22, 3, 30)) },
        ])!;
        expect(night.staged).toBe(true);
        expect(night.bed).toBe(at(21, 23, 30));
        expect(night.wake).toBe(at(22, 3));
        expect(night.stages).toEqual({ core: 90, deep: 60, awake: 10, rem: 50 });
        expect(night.asleep).toBe(200);
        expect(night.segments.map(segment => segment[0])).toEqual(['core', 'deep', 'awake', 'rem']);
    });

    it('a tracker without stages gives one core block', () => {
        const night = sleepNight([{ value: 'ASLEEP', startDate: iso(at(21, 23)), endDate: iso(at(22, 7)) }])!;
        expect(night.staged).toBe(false);
        expect(night.stages.core).toBe(480);
    });

    it('nothing asleep is no night', () => {
        expect(sleepNight([{ value: 'INBED', startDate: iso(at(21, 23)), endDate: iso(at(22, 7)) }])).toBeNull();
    });
});

describe('the week', () => {
    it('averages only nights recorded, and bedtimes across midnight', () => {
        expect(clockMinutes(at(21, 23, 40))).toBe(-20);
        const details = {
            a: { bed: at(20, 23, 40) }, b: { bed: at(21, 0, 20) },
        } as never;
        const week = sleepWeek(['a', 'b', 'c'], { a: 420, b: 480 }, details, 450);
        expect(week).toEqual({ average: 450, met: 1, recorded: 2, bedtime: 0, spread: 20 });
    });

    it('activity: averages and days at the goal', () => {
        const week = activityWeek(['a', 'b', 'c'], { a: { minutes: 30, steps: 8000 }, b: { minutes: 10, steps: 4000 } }, 30);
        expect(week).toEqual({ averageMinutes: 20, averageSteps: 6000, met: 1, recorded: 2 });
    });
});
