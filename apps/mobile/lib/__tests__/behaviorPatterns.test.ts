import { deepPatterns, twoProportionZ } from '../behaviorPatterns';
import { shiftDay, type HistoryDay } from '../habitDays';
import type { PatternInput } from '../echoPatterns';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const TODAY = '2026-10-20'; // a Tuesday
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (id: string, name: string): Habit => ({ id, name, startDate: '2026-06-01', createdAt: '2026-06-01T09:00:00', taskDays: EVERY_DAY } as Habit);
const lastDays = (n: number) => Array.from({ length: n }, (_, index) => shiftDay(TODAY, -(n - index)));
const at = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:15:00`).toISOString();
const empty: PatternInput = { habits: [], history: [], tasks: [], sleep: {}, checkIns: [], focus: [], ticks: [], today: TODAY };
const kinds = (input: PatternInput) => deepPatterns(input).map(pattern => pattern.kind);

describe('twoProportionZ', () => {
    it('is large for a real gap and small for noise', () => {
        expect(twoProportionZ({ hit: 18, n: 20 }, { hit: 4, n: 20 })).toBeGreaterThan(4);
        expect(Math.abs(twoProportionZ({ hit: 5, n: 10 }, { hit: 4, n: 10 }))).toBeLessThan(1);
        expect(twoProportionZ({ hit: 0, n: 0 }, { hit: 1, n: 2 })).toBe(0);
    });
});

describe('deepPatterns', () => {
    it('says nothing on an empty or flat record', () => {
        expect(deepPatterns(empty)).toEqual([]);
        const habits = [habit('a', 'Run'), habit('b', 'Read')];
        const history: HistoryDay[] = lastDays(95).map(date => ({ date, completedIds: ['a', 'b'] }));
        expect(kinds({ ...empty, habits, history }).filter(kind => kind !== 'comeback')).toEqual([]);
    });

    it('finds the habit that pulls another along', () => {
        const habits = [habit('gym', 'Gym'), habit('read', 'Read')];
        // Gym every other day; Read follows on gym days, rarely otherwise.
        const days = lastDays(60);
        const history: HistoryDay[] = days.map((date, i) => ({
            date, completedIds: i % 2 === 0 ? ['gym', ...(i % 6 !== 0 ? ['read'] : [])] : (i % 10 === 1 ? ['read'] : []),
        }));
        // Gym is ticked first (7 am), Read after (9 pm): Gym leads.
        const ticks = history.flatMap(day => day.completedIds.map(id => ({ habitId: id, date: day.date, at: at(day.date, id === 'gym' ? 7 : 21) })));
        const chain = deepPatterns({ ...empty, habits, history, ticks }).find(pattern => pattern.kind === 'chain');
        expect(chain?.text).toMatch(/^Gym and Read go together/);
        expect(deepPatterns({ ...empty, habits, history, ticks }).filter(pattern => pattern.kind === 'chain')).toHaveLength(1);
    });

    it('measures what one miss does to the next day', () => {
        const habits = [habit('a', 'A'), habit('b', 'B'), habit('c', 'C')];
        // A miss every 4th day, and the day after it mostly lost too.
        const history: HistoryDay[] = lastDays(80).map((date, i) => ({
            date, completedIds: i % 4 === 0 ? ['a', 'b'] : i % 4 === 1 ? ['a'] : ['a', 'b', 'c'],
        }));
        const spiral = deepPatterns({ ...empty, habits, history }).find(pattern => pattern.kind === 'miss_spiral');
        expect(spiral?.text).toContain('the day after you miss something');
    });

    it('finds your capacity', () => {
        const habits = Array.from({ length: 3 }, (_, i) => habit(`h${i}`, `H${i}`));
        const days = lastDays(60);
        // Every other day gets 6 tasks on top; those days, nearly nothing gets done.
        const tasks: Task[] = days.flatMap((date, i) => i % 2 ? Array.from({ length: 6 }, (_, k) => ({ id: `${date}-${k}`, title: 't', status: k === 0 ? 'done' : 'open', dueDate: date, createdAt: at(date, 8) } as Task)) : []);
        const history: HistoryDay[] = days.map((date, i) => ({ date, completedIds: i % 2 ? ['h0'] : ['h0', 'h1', 'h2'] }));
        const overload = deepPatterns({ ...empty, habits, history, tasks }).find(pattern => pattern.kind === 'overload');
        expect(overload?.text).toMatch(/^Your capacity is about \d+ things a day/);
    });

    it('sees a habit slipping and one taking off', () => {
        const habits = [habit('up', 'Stretch'), habit('down', 'Journal')];
        const history: HistoryDay[] = lastDays(42).map((date, i) => ({
            date, completedIds: i >= 28 ? ['up', ...(i % 4 === 0 ? ['down'] : [])] : ['down', ...(i % 4 === 0 ? ['up'] : [])],
        }));
        const found = deepPatterns({ ...empty, habits, history }).filter(pattern => pattern.kind === 'trend').map(pattern => pattern.text);
        expect(found.some(text => text.startsWith('Journal is slipping'))).toBe(true);
        expect(found.some(text => text.startsWith('Stretch is taking off'))).toBe(true);
    });

    it('finds the hour after which a habit rarely happens', () => {
        const habits = [habit('m', 'Meditate')];
        const days = lastDays(20);
        const ticks = days.map((date, i) => ({ habitId: 'm', date, at: at(date, 7 + (i % 3)) }));
        const found = deepPatterns({ ...empty, habits, history: days.map(date => ({ date, completedIds: ['m'] })), ticks }).find(pattern => pattern.kind === 'habit_window');
        expect(found?.text).toBe("If Meditate isn't done by 10 am, it almost never happens: 100% of the times you do it are before then.");
    });

    it('sees habits drifting later', () => {
        const habits = [habit('a', 'A')];
        const days = lastDays(42);
        const ticks = days.map((date, i) => ({ habitId: 'a', date, at: at(date, i >= 28 ? 21 : 8) }));
        const drift = deepPatterns({ ...empty, habits, history: days.map(date => ({ date, completedIds: ['a'] })), ticks }).find(pattern => pattern.kind === 'drift');
        expect(drift?.text).toContain('drifting later');
    });

    it('names the habit most likely to slip today', () => {
        const habits = [habit('ok', 'Walk'), habit('risky', 'Read')];
        // Read: kept most days, but never on Tuesdays, and missed yesterday.
        const history: HistoryDay[] = lastDays(56).map(date => {
            const day = new Date(`${date}T12:00:00`).getDay();
            return { date, completedIds: ['ok', ...(day === 2 || date === shiftDay(TODAY, -1) ? [] : ['read-never', 'risky'])] };
        });
        const risk = deepPatterns({ ...empty, habits, history }).find(pattern => pattern.kind === 'risk_today');
        expect(risk?.text).toMatch(/^Read is the one most likely to slip today \(Tuesdays you keep it 0%/);
    });

    it('sees tasks going stale', () => {
        const days = lastDays(80);
        const tasks: Task[] = days.map((date, i) => {
            const quick = i % 2 === 0;
            return { id: `t${i}`, title: 't', createdAt: at(date, 9), status: quick || i % 10 === 1 ? 'done' : 'open', completedAt: quick ? at(date, 15) : i % 10 === 1 ? at(shiftDay(date, 6), 9) : undefined } as Task;
        });
        const decay = deepPatterns({ ...empty, tasks }).find(pattern => pattern.kind === 'task_decay');
        expect(decay?.text).toContain('Tasks go stale fast');
    });
});
