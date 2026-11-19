import { addDistraction, distractionsBetween, loadDistractions } from '../distractions';

describe('got distracted', () => {
    it('counts taps by day and item', async () => {
        const all = await loadDistractions();
        expect(all).toEqual([]);
        await addDistraction('2026-11-18', 'a', Date.parse('2026-11-18T10:00:00'));
        await addDistraction('2026-11-19', 'a', Date.parse('2026-11-19T10:00:00'));
        const list = await loadDistractions();
        expect(distractionsBetween(list, '2026-11-16', '2026-11-22')).toBe(2);
        expect(distractionsBetween(list, '2026-11-19', '2026-11-19', 'a')).toBe(1);
        expect(distractionsBetween(list, '2026-11-19', '2026-11-19', 'b')).toBe(0);
    });
});
