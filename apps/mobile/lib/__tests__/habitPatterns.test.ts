import { habitPatterns } from '../habitPatterns';
import type { Pattern } from '../echoPatterns';
import type { TickSource } from '../tickSource';

const TODAY = '2026-11-24';
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** The `count` days before today, oldest first. */
const pastDays = (count: number) => Array.from({ length: count }, (_, i) => {
    const date = new Date(2026, 10, 24 - count + i, 12);
    return keyOf(date);
});
const dow = (key: string) => new Date(`${key}T12:00:00`).getDay();

describe('a habit’s own patterns', () => {
    it('says nothing on too little data', () => {
        const days = pastDays(6).map(date => ({ date, scheduled: true, completed: true, skipped: false }));
        expect(habitPatterns({ habitId: 'h', days, ticks: [], sources: {}, today: TODAY })).toEqual([]);
    });

    it('names the hard weekday when it really is different', () => {
        const days = pastDays(84).map(date => ({ date, scheduled: true, completed: dow(date) !== 4, skipped: false }));
        const found = habitPatterns({ habitId: 'h', days, ticks: [], sources: {}, today: TODAY });
        expect(found.find(p => p.id === 'weekday:4')?.text).toMatch(/^Thursdays are the hard ones: 0% kept/);
    });

    it('finds the usual hour and the hour after which it rarely happens', () => {
        const ticks = pastDays(20).map((date, i) => ({ date, at: new Date(`${date}T${i < 18 ? '07' : '10'}:00:00`).toISOString() }));
        const days = pastDays(20).map(date => ({ date, scheduled: true, completed: true, skipped: false }));
        const time = habitPatterns({ habitId: 'h', days, ticks, sources: {}, today: TODAY }).find(p => p.id === 'time');
        expect(time?.text).toMatch(/^Usually done around 7 am\./);
    });

    it('measures what a miss does to the next one', () => {
        // Misses come in pairs: after a miss, the next is missed too.
        const days = pastDays(80).map((date, i) => ({ date, scheduled: true, completed: i % 8 >= 2, skipped: false }));
        const miss = habitPatterns({ habitId: 'h', days, ticks: [], sources: {}, today: TODAY }).find(p => p.id === 'miss');
        expect(miss?.text).toMatch(/^One miss tends to become two/);
    });

    it('says how it is logged', () => {
        const sources: Record<string, TickSource> = {};
        pastDays(10).forEach((date, i) => { sources[date] = i < 7 ? 'timer' : 'manual'; });
        const days = pastDays(10).map(date => ({ date, scheduled: true, completed: true, skipped: false }));
        const source = habitPatterns({ habitId: 'h', days, ticks: [], sources, today: TODAY }).find(p => p.id === 'source');
        expect(source?.text).toBe('Logged with the timer 70% of the time, by hand 30%.');
    });

    it('keeps Echo’s findings about this habit only', () => {
        const global = [
            { id: 'relapse:h', kind: 'relapse', text: 'About h', evidence: '', strength: 1, short: '' },
            { id: 'relapse:other', kind: 'relapse', text: 'About another', evidence: '', strength: 1, short: '' },
            { id: 'comeback', kind: 'comeback', text: 'General', evidence: '', strength: 1, short: '' },
        ] as Pattern[];
        const found = habitPatterns({ habitId: 'h', days: [], ticks: [], sources: {}, global, today: TODAY });
        expect(found.map(p => p.text)).toEqual(['About h']);
    });
});
