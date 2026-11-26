import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncDayInputs } from '../dayInputsSync';

jest.mock('../cloudSync', () => ({ syncNow: jest.fn(), isApplyingRemote: () => false }));

type Row = { user_id: string; key: string; value: unknown; updated_at: string; deleted_at: string | null };
const ME = 'user-1';

/** Just enough of the Supabase client for day_inputs: select/upsert/update with the filters used. */
function fakeServer(rows: Row[] = [], opts: { offline?: boolean } = {}) {
    let clock = 1000;
    const stamp = () => new Date(Date.UTC(2026, 10, 26, 0, 0, clock++)).toISOString();
    const builder = (op: 'select' | 'update' | 'upsert', payload?: any) => {
        const filters: ((row: Row) => boolean)[] = [];
        let limit = Infinity;
        const run = async () => {
            if (opts.offline) return { data: null, error: { message: 'Network request failed' } };
            if (op === 'upsert') {
                for (const item of payload) {
                    const at = rows.findIndex(row => row.key === item.key && row.user_id === item.user_id);
                    const row = { ...(at >= 0 ? rows[at] : {}), ...item, updated_at: stamp() } as Row;
                    if (at >= 0) rows[at] = row; else rows.push(row);
                }
                return { data: null, error: null };
            }
            const hit = rows.filter(row => filters.every(test => test(row)));
            if (op === 'update') { hit.forEach(row => Object.assign(row, payload, { updated_at: stamp() })); return { data: hit, error: null }; }
            return { data: [...hit].sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, limit).map(row => ({ ...row })), error: null };
        };
        const chain: any = {
            eq: (c: keyof Row, v: any) => { filters.push(r => r[c] === v); return chain; },
            gt: (c: keyof Row, v: any) => { filters.push(r => String(r[c]) > v); return chain; },
            in: (c: keyof Row, v: any[]) => { filters.push(r => v.includes(r[c])); return chain; },
            is: (c: keyof Row, v: null) => { filters.push(r => r[c] === v); return chain; },
            order: () => chain,
            limit: (n: number) => { limit = n; return chain; },
            then: (resolve: any, reject: any) => run().then(resolve, reject),
        };
        return chain;
    };
    const sb = { from: () => ({ select: () => builder('select'), update: (p: any) => builder('update', p), upsert: (p: any) => builder('upsert', p) }) };
    return { sb, rows, setOffline: (v: boolean) => { opts.offline = v; } };
}
const row = (key: string, value: unknown, at = '2026-11-25T10:00:00.000Z'): Row => ({ user_id: ME, key, value, updated_at: at, deleted_at: null });
const meals = (time: string) => ({ breakfast: { id: 'breakfast', on: true, time, minutes: 20 }, lunch: { id: 'lunch', on: false, time: '12:30', minutes: 45 }, supper: { id: 'supper', on: false, time: '18:30', minutes: 45 } });
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');

describe('day inputs sync', () => {
    beforeEach(() => AsyncStorage.clear());

    it('sends a changed setting as its own key', async () => {
        const server = fakeServer();
        await syncDayInputs(server.sb, ME);
        await AsyncStorage.setItem('habyss_meals', JSON.stringify(meals('08:00')));
        const report = await syncDayInputs(server.sb, ME);
        expect(report.sent).toBe(1);
        expect(server.rows.map(r => r.key)).toEqual(['meals']);
    });

    it('brings another device\'s change into the store and the module that holds it', async () => {
        const server = fakeServer();
        await AsyncStorage.setItem('habyss_day_window', JSON.stringify({ wake: '07:00', sleep: '23:00' }));
        await syncDayInputs(server.sb, ME);
        server.rows.push(row('day_window', { wake: '08:00', sleep: '23:30' }, '2026-11-27T00:00:00.000Z'));
        const { getDayWindow } = require('../echo') as typeof import('../echo');
        await getDayWindow();
        await syncDayInputs(server.sb, ME);
        expect(await stored('habyss_day_window')).toEqual({ wake: '08:00', sleep: '23:30' });
        expect(await getDayWindow()).toEqual({ wake: '08:00', sleep: '23:30' });
    });

    it('keeps a setting changed here that was not sent yet, and sends it next', async () => {
        const server = fakeServer();
        await AsyncStorage.setItem('habyss_meals', JSON.stringify(meals('08:00')));
        await syncDayInputs(server.sb, ME);
        server.setOffline(true);
        await AsyncStorage.setItem('habyss_meals', JSON.stringify(meals('09:00')));
        await syncDayInputs(server.sb, ME);
        server.setOffline(false);
        server.rows[0] = row('meals', meals('07:00'), '2026-11-27T00:00:00.000Z');
        await syncDayInputs(server.sb, ME);
        expect((await stored('habyss_meals')).breakfast.time).toBe('09:00');
        expect((server.rows[0].value as any).breakfast.time).toBe('09:00');
    });

    it('on a first sync takes what the account has and sends only what it lacks', async () => {
        const server = fakeServer([row('meals', meals('07:15'))]);
        await AsyncStorage.setItem('habyss_meals', JSON.stringify(meals('10:00')));
        await AsyncStorage.setItem('habyss_meals_flexible', 'true');
        await syncDayInputs(server.sb, ME);
        expect((await stored('habyss_meals')).breakfast.time).toBe('07:15');
        expect(server.rows.find(r => r.key === 'meals')!.value).toEqual(meals('07:15'));
        expect(server.rows.find(r => r.key === 'meals_flexible')!.value).toBe(true);
    });

    it('keeps two devices\' changes to different settings', async () => {
        const server = fakeServer();
        await AsyncStorage.setItem('habyss_meals_flexible', 'false');
        await syncDayInputs(server.sb, ME);
        await AsyncStorage.setItem('habyss_meals_flexible', 'true');
        server.rows.push(row('travel:school', { before: 45, after: 45 }, '2026-11-27T00:00:00.000Z'));
        await syncDayInputs(server.sb, ME);
        expect(await stored('habyss_event_travel')).toEqual({ school: { before: 45, after: 45 } });
        expect(server.rows.find(r => r.key === 'meals_flexible')!.value).toBe(true);
    });

    it('removes a travel time removed here, and one removed elsewhere', async () => {
        const server = fakeServer();
        await AsyncStorage.setItem('habyss_event_travel', JSON.stringify({ school: { before: 30, after: 30 }, gym: { before: 10, after: 10 } }));
        await syncDayInputs(server.sb, ME);
        await AsyncStorage.setItem('habyss_event_travel', JSON.stringify({ gym: { before: 10, after: 10 } }));
        await syncDayInputs(server.sb, ME);
        expect(server.rows.find(r => r.key === 'travel:school')!.deleted_at).not.toBeNull();
        Object.assign(server.rows.find(r => r.key === 'travel:gym')!, { deleted_at: '2026-11-27T01:00:00.000Z', updated_at: '2026-11-27T01:00:00.000Z' });
        await syncDayInputs(server.sb, ME);
        expect(await stored('habyss_event_travel')).toEqual({});
    });

    it('never throws when offline or before the table exists', async () => {
        await AsyncStorage.setItem('habyss_meals_flexible', 'true');
        expect(await syncDayInputs(fakeServer([], { offline: true }).sb, ME)).toEqual({ sent: 0, received: 0 });
    });

    it('never sends a day older than two weeks, so old early ends do not loop', async () => {
        const server = fakeServer();
        await AsyncStorage.setItem('habyss_ended_early', JSON.stringify({ day: '2026-10-01', at: { 'meal:lunch': 760 } }));
        await syncDayInputs(server.sb, ME);
        const second = await syncDayInputs(server.sb, ME);
        const third = await syncDayInputs(server.sb, ME);
        expect([second.sent, third.sent]).toEqual([0, 0]);
        expect(server.rows.filter(r => r.key === 'ended:2026-10-01' && r.deleted_at === null)).toEqual([]);
    });
});
