import { findPatterns, nextPatternLine, patternDigest, peakWindow, sleepLabel, type PatternInput } from '../echoPatterns';
import { shiftDay, type HistoryDay } from '../habitDays';
import type { CheckIn } from '../checkIns';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const TODAY = '2026-10-20';
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (id: string, name: string): Habit => ({
    id, name, startDate: '2026-07-01', createdAt: '2026-07-01T09:00:00', taskDays: EVERY_DAY,
} as Habit);
/** The last `n` days, oldest first, ending yesterday. */
const lastDays = (n: number) => Array.from({ length: n }, (_, index) => shiftDay(TODAY, -(n - index)));
const at = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:15:00`).toISOString();
const empty: PatternInput = { habits: [], history: [], tasks: [], sleep: {}, checkIns: [], focus: [], ticks: [], today: TODAY };

describe("Echo's patterns", () => {
    it('says nothing without enough of a record', () => {
        expect(findPatterns(empty)).toEqual([]);
        // A week of sleep and energy is not enough to call a pattern.
        const days = lastDays(5);
        const sleep = Object.fromEntries(days.map(date => [date, 390]));
        const checkIns: CheckIn[] = days.map(date => ({ at: at(date, 9), kind: 'energy', value: 5 }));
        expect(findPatterns({ ...empty, sleep, checkIns })).toEqual([]);
    });

    it('finds the amount of sleep you have the most energy after', () => {
        const days = lastDays(12);
        // 6h30 nights → energy 5; 8h and 5h nights → energy 2.
        const minutes = [390, 480, 300];
        const sleep = Object.fromEntries(days.map((date, i) => [date, minutes[i % 3]]));
        const checkIns: CheckIn[] = days.map((date, i) => ({ at: at(date, 9), kind: 'energy', value: i % 3 === 0 ? 5 : 2 }));
        const found = findPatterns({ ...empty, sleep, checkIns }).find(pattern => pattern.kind === 'sleep_energy');
        expect(found?.text).toBe('You have the most energy after about 6h30 of sleep.');
        expect(found?.evidence).toContain('(4 days)');
    });

    it('finds the hours tasks get finished in', () => {
        const days = lastDays(20);
        const tasks = days.map((date, i) => ({
            id: `t${i}`, title: 'T', status: 'done', completedAt: at(date, i % 4 === 0 ? 18 : 12),
        })) as Task[];
        const found = findPatterns({ ...empty, tasks }).find(pattern => pattern.kind === 'task_hour');
        expect(found?.text).toContain('between 12 pm and 2 pm');
        expect(found?.evidence).toBe('15 of 20 tasks finished in that window, last 60 days.');
    });

    it('finds a keystone habit and the best day of the week', () => {
        const habits = [habit('run', 'Run'), habit('read', 'Read'), habit('water', 'Water')];
        // Run on even days; on those days the others are done too, otherwise
        // not. Never on Sundays.
        const history: HistoryDay[] = lastDays(56).map((date, i) => {
            const sunday = new Date(`${date}T12:00:00`).getDay() === 0;
            return { date, completedIds: !sunday && i % 2 === 0 ? ['run', 'read', 'water'] : [] };
        });
        const patterns = findPatterns({ ...empty, habits, history });
        const keystone = patterns.find(pattern => pattern.kind === 'keystone');
        expect(keystone?.text).toMatch(/is your keystone: on days you do it you keep 100% of everything else, 0% when you skip it\./);
        expect(patterns.find(pattern => pattern.kind === 'weekday')?.text).toContain('Sunday your weakest (0%)');
    });

    it('finds the habit your mood is better on', () => {
        const habits = [habit('walk', 'Walk')];
        const days = lastDays(14);
        const history: HistoryDay[] = days.map((date, i) => ({ date, completedIds: i % 2 ? ['walk'] : [] }));
        const checkIns: CheckIn[] = days.map((date, i) => ({ at: at(date, 20), kind: 'mood', value: i % 2 ? 5 : 3 }));
        expect(findPatterns({ ...empty, habits, history, checkIns }).map(pattern => pattern.text))
            .toContain('Your mood is better on days you do Walk.');
    });

    it('hands the model everything in a line that stays short', () => {
        const patterns = [
            { id: 'a', kind: 'task_hour' as const, text: '', evidence: '', strength: 2, short: 'tasks@12-14h 60%' },
            { id: 'b', kind: 'sleep_energy' as const, text: '', evidence: '', strength: 1, short: 'sleep6h30→energy4.5/3.2' },
        ];
        expect(patternDigest(patterns, { streak: 12, todayDone: 2, todayTotal: 5, sleepLast: 410 }))
            .toBe('streak12d;today2/5;slept6h50;tasks@12-14h 60%;sleep6h30→energy4.5/3.2');
        expect(patternDigest(patterns, { streak: 12 }, 30)).toBe('streak12d;tasks@12-14h 60%');
        expect(sleepLabel(420)).toBe('7h');
    });

    it('says a pattern now and then, cycling through them', () => {
        const patterns = ['one', 'two'].map((text, i) => ({ id: text, kind: 'weekday' as const, text, evidence: '', strength: 2 - i, short: text }));
        expect(nextPatternLine(patterns, () => 0.9)).toBeNull();
        const said = [nextPatternLine(patterns, () => 0), nextPatternLine(patterns, () => 0)];
        expect(new Set(said)).toEqual(new Set(['one', 'two']));
        expect(nextPatternLine([], () => 0)).toBeNull();
    });
});

describe('your best hours', () => {
    const p = (id: string, kind: string) => ({ id, kind, text: '', evidence: '', strength: 1, short: '' }) as never;
    it('comes from when energy peaks, else when focus holds or tasks get done', () => {
        expect(peakWindow([p('task_hour:14', 'task_hour'), p('energy_time:evening', 'energy_time')])).toEqual({ start: 1080, end: 1320 });
        expect(peakWindow([p('focus_hour:21', 'focus_hour')])).toEqual({ start: 1260, end: 1440 });
        expect(peakWindow([])).toBeNull();
    });
});
