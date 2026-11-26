import { rowsFromStores, staleKeys, storesFromRows } from '../dayInputs';

const today = '2026-11-26';
const memory = { day: today, slots: { h1: { start: 480, end: 510 } }, done: {}, moved: {} };
const stores = {
    habyss_day_window: JSON.stringify({ wake: '08:00', sleep: '23:30' }),
    habyss_meals: JSON.stringify({ breakfast: { id: 'breakfast', on: true, time: '08:30', minutes: 15 } }),
    habyss_meals_flexible: 'true',
    habyss_event_travel: JSON.stringify({ school: { before: 60, after: 60 }, '@2@school': { before: 30, after: 30 }, '#2026-11-26#E1': { before: 10, after: 0 } }),
    habyss_day_memory: JSON.stringify(memory),
    habyss_ended_early: JSON.stringify({ day: today, at: { 'meal:lunch': 760 } }),
    habyss_reschedules: JSON.stringify({ day: today, at: { t1: 900 } }),
    habyss_flow_peak: JSON.stringify({ start: 540, end: 720 }),
    app_settings: JSON.stringify({ autoReschedule: false, theme: 'dark' }),
};

describe('day input keys', () => {
    it('turns every store into its own keys, one row per travel entry and dated rows per day', () => {
        const rows = rowsFromStores(stores);
        expect(Object.keys(rows).sort()).toEqual([
            'auto_reschedule', 'day_memory:2026-11-26', 'day_window', 'ended:2026-11-26', 'meals', 'meals_flexible', 'peak',
            'reschedule:2026-11-26', 'travel:#2026-11-26#E1', 'travel:@2@school', 'travel:school',
        ]);
        expect(rows.day_window).toEqual({ wake: '08:00', sleep: '23:30' });
        expect(rows.meals_flexible).toBe(true);
        expect(rows.auto_reschedule).toBe(false);
        expect(rows['travel:school']).toEqual({ before: 60, after: 60 });
        expect(rows['ended:2026-11-26']).toEqual({ 'meal:lunch': 760 });
    });

    it('round-trips back into the same stores, keeping the rest of app_settings', () => {
        const back = storesFromRows(rowsFromStores(stores), today, { app_settings: JSON.stringify({ autoReschedule: true, theme: 'dark' }) });
        for (const key of Object.keys(stores)) expect(JSON.parse(back[key]!)).toEqual(JSON.parse(stores[key as keyof typeof stores]));
    });

    it('keeps only today in the one-day stores', () => {
        const rows = { ...rowsFromStores(stores), 'day_memory:2026-11-25': { ...memory, day: '2026-11-25' }, 'ended:2026-11-25': { x: 1 } };
        delete (rows as Record<string, unknown>)['day_memory:2026-11-26'];
        const back = storesFromRows(rows, today);
        expect(back.habyss_day_memory).toBeUndefined();
        expect(JSON.parse(back.habyss_ended_early!)).toEqual({ day: today, at: { 'meal:lunch': 760 } });
    });

    it('carries pending calendar slots as dated rows', () => {
        const rows = rowsFromStores({}, { [today]: [{ id: 'E1', title: 'School', start: 600, minutes: 60 }] });
        expect(rows[`events:${today}`]).toEqual([{ id: 'E1', title: 'School', start: 600, minutes: 60 }]);
    });

    it('marks dated rows older than two weeks as stale', () => {
        expect(staleKeys(['ended:2026-11-01', 'ended:2026-11-20', 'meals', 'events:2026-11-12', 'events:2026-11-11'], today)).toEqual(['ended:2026-11-01', 'events:2026-11-11']);
    });
});
