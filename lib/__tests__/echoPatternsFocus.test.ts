import { findPatterns } from '../echoPatterns';

const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;

describe('sleep and energy against focus', () => {
    it('finds that longer nights come with more focus', () => {
        const sleep: Record<string, number> = {};
        const focus: never[] = [];
        for (let n = 1; n <= 10; n++) {
            const long = n % 2 === 0;
            sleep[day(n)] = long ? 480 : 360;
            focus.push({ date: day(n), seconds: (long ? 90 : 30) * 60, itemId: 'x' } as never);
        }
        const found = findPatterns({ habits: [], history: [], tasks: [], sleep, checkIns: [], focus, ticks: [], today: day(15) });
        expect(found.find(pattern => pattern.kind === 'sleep_focus')?.text).toBe('After 8h of sleep or more you focus 90 min a day; after less, 30.');
    });

    it('finds that high-energy days come with more focus', () => {
        const checkIns: { at: string; kind: "energy"; value: 5 | 2 }[] = [];
        const focus: never[] = [];
        for (let n = 1; n <= 10; n++) {
            const high = n % 2 === 0;
            checkIns.push({ at: `${day(n)}T09:00:00`, kind: 'energy' as const, value: (high ? 5 : 2) as 5 | 2 });
            focus.push({ date: day(n), seconds: (high ? 80 : 20) * 60, itemId: 'x' } as never);
        }
        const found = findPatterns({ habits: [], history: [], tasks: [], sleep: {}, checkIns, focus, ticks: [], today: day(15) });
        expect(found.find(pattern => pattern.kind === 'energy_focus')?.text).toBe('On high-energy days you focus 80 min; on the others, 20.');
    });
});
