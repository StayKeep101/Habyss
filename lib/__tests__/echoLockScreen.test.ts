import { awakeAt, buildEchoHours } from '../echoLockScreen';
import type { EchoStats } from '../echoLines';

const stats: EchoStats = {
    streak: 4, todayDone: 2, todayTotal: 5, weekConsistency: 71,
    nextHabit: 'Read', goalsCount: 1, overallProgress: 40,
};
const window = { wake: '07:00', sleep: '23:00' };
const plan = (now: Date, hours = 6) => buildEchoHours({ stats, personality: 'normal', window, now, hours });

describe('awakeAt', () => {
    it('knows a window that does not cross midnight', () => {
        expect(awakeAt(new Date(2026, 8, 27, 8), window)).toBe(true);
        expect(awakeAt(new Date(2026, 8, 27, 4), window)).toBe(false);
    });
    it('knows one that does', () => {
        const night = { wake: '22:00', sleep: '06:00' };
        expect(awakeAt(new Date(2026, 8, 27, 2), night)).toBe(true);
        expect(awakeAt(new Date(2026, 8, 27, 12), night)).toBe(false);
    });
});

describe('buildEchoHours', () => {
    it('speaks now, then on the hour', () => {
        const now = new Date(2026, 8, 27, 9, 20);
        const hours = plan(now);
        expect(hours[0].at).toBe(now.getTime());
        expect(hours.slice(1).map(hour => new Date(hour.at).getHours())).toEqual([10, 11, 12, 13, 14, 15]);
        expect(hours.every(hour => new Date(hour.at).getMinutes() === (hour === hours[0] ? 20 : 0))).toBe(true);
    });

    it('says nothing while the user is asleep', () => {
        // 23:00 is when they sleep, so 22:00 is the last word until morning.
        const hours = plan(new Date(2026, 8, 27, 21, 0), 6);
        expect(hours.map(hour => new Date(hour.at).getHours())).toEqual([21, 22]);
    });

    it('rebuilds the same plan, so a line does not vanish mid-read', () => {
        const now = new Date(2026, 8, 27, 9, 0);
        expect(plan(now)).toEqual(plan(now));
    });

    it('does not repeat itself hour to hour', () => {
        const hours = plan(new Date(2026, 8, 27, 9), 5);
        expect(new Set(hours.map(hour => hour.line)).size).toBe(hours.length);
    });

    it('writes a line for every hour it plans', () => {
        for (const hour of plan(new Date(2026, 8, 27, 9))) {
            expect(hour.line.length).toBeGreaterThan(0);
        }
    });
});
