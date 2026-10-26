import { energyCurve } from '../energyCurve';
import { pickQuestion, type CheckIn, type CheckInState } from '../checkIns';

const now = new Date(2026, 9, 26, 12, 0);
const ago = (days: number, hour: number) => new Date(2026, 9, 26 - days, hour, 0).toISOString();
const energy = (days: number, hour: number, value: CheckIn['value']): CheckIn => ({ at: ago(days, hour), kind: 'energy', value });

describe('the energy curve', () => {
    it('says nothing until there is enough behind it', () => {
        expect(energyCurve({ checkIns: [], now }).peak).toBeNull();
        expect(energyCurve({ checkIns: [energy(1, 9, 5), energy(2, 21, 1)], now }).peak).toBeNull();
    });

    it('finds a night owl: high at night, low in the morning', () => {
        const entries: CheckIn[] = [];
        for (let day = 1; day <= 6; day++) entries.push(energy(day, 9, 2), energy(day, 14, 3), energy(day, 21, 5));
        const curve = energyCurve({ checkIns: entries, now, wake: 8 * 60, sleep: 24 * 60 });
        expect(curve.peak!.start).toBeGreaterThanOrEqual(19 * 60);
        expect(curve.hours[21]!).toBeGreaterThan(curve.hours[9]!);
    });

    it('follows a change: recent weeks outweigh old ones', () => {
        const entries: CheckIn[] = [];
        // Two months ago, mornings were best; the last two weeks, evenings.
        for (let day = 50; day <= 60; day++) entries.push(energy(day, 9, 5), energy(day, 14, 3), energy(day, 20, 2));
        for (let day = 1; day <= 12; day++) entries.push(energy(day, 9, 2), energy(day, 14, 3), energy(day, 20, 5));
        expect(energyCurve({ checkIns: entries, now }).peak!.start).toBeGreaterThanOrEqual(17 * 60);
    });

    it('keeps one great morning modest', () => {
        const entries: CheckIn[] = [energy(1, 9, 5)];
        for (let day = 1; day <= 8; day++) entries.push(energy(day, 15, 3));
        const curve = energyCurve({ checkIns: entries, now });
        expect(curve.hours[9]!).toBeLessThan(4.5);
    });

    it('counts finished focus sessions as good hours', () => {
        const focus = Array.from({ length: 10 }, (_, i) => ({ itemId: 'x', startedAt: ago(i + 1, 16), date: '', seconds: 1800, completed: true, mode: 'deep_focus' }));
        const stopped = Array.from({ length: 10 }, (_, i) => ({ itemId: 'x', startedAt: ago(i + 1, 10), date: '', seconds: 600, completed: false, mode: 'deep_focus' }));
        const late = Array.from({ length: 10 }, (_, i) => ({ itemId: 'x', startedAt: ago(i + 1, 20), date: '', seconds: 600, completed: false, mode: 'deep_focus' }));
        const curve = energyCurve({ checkIns: [], focus: [...focus, ...stopped, ...late], now });
        expect(curve.peak!.start).toBeGreaterThanOrEqual(14 * 60);
        expect(curve.peak!.start).toBeLessThanOrEqual(16 * 60);
    });
});

describe('asking about energy', () => {
    const stats = () => ({ asked: 0, answered: 0, hours: Array(24).fill(0) as number[] });
    it('asks again in a later part of the day, never twice in the same part', () => {
        const state: CheckInState = { entries: [{ at: new Date(2026, 9, 26, 9).toISOString(), kind: 'energy', value: 3 }, { at: new Date(2026, 9, 26, 9).toISOString(), kind: 'mood', value: 3 }], stats: { mood: stats(), energy: stats() } };
        expect(pickQuestion(state, new Date(2026, 9, 26, 11), () => 0)).toBeNull();
        expect(pickQuestion(state, new Date(2026, 9, 26, 15), () => 0)).toBe('energy');
    });
});
