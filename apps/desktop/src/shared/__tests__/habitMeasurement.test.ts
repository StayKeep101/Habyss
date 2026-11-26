import { describe, it, expect } from 'vitest';
import { formatClock, formatDuration, localHabitDate, measurementFor, parseMeasurement } from '../habitMeasurement';

const config = (goalValue = 1, unit = 'times', rest = {}) => measurementFor({ goalValue, unit, type: 'build', ...rest });

describe('habit measurement contract', () => {
    it('uses time goals in their own units instead of always starting 25 minutes', () => {
        expect(config(10, 'minutes')).toMatchObject({ kind: 'timer', target: 10, secondsPerUnit: 60 });
        expect(config(1.5, 'hours')).toMatchObject({ kind: 'timer', target: 1.5, secondsPerUnit: 3600 });
        expect(config(30, 'seconds')).toMatchObject({ kind: 'timer', target: 30, secondsPerUnit: 1 });
        expect(config(2, ' MIN ')).toMatchObject({ kind: 'timer', secondsPerUnit: 60 });
    });
    it('keeps simple and quit habits as positive check-ins', () => {
        expect(config()).toMatchObject({ kind: 'boolean', target: 1 });
        expect(config(10, 'cigarettes', { type: 'quit' })).toMatchObject({ kind: 'boolean', target: 1 });
    });
    it('supports a fraction or single unit when explicitly measured', () => {
        expect(config(0.5, 'km', { trackingMethod: 'numeric' })).toMatchObject({ kind: 'counter', target: 0.5, step: 0.1 });
        expect(config(1, 'litres', { trackingMethod: 'numeric' }).kind).toBe('counter');
    });
    it('offers useful increments for both glasses and thousands of steps', () => {
        expect(config(8, 'glasses').quickAmounts).toEqual([1, 2, 3]);
        expect(config(10000, 'steps').quickAmounts).toEqual([100, 500, 1000]);
    });
    it('rejects malformed, negative, infinite and excessively large entry', () => {
        for (const input of ['', '-1', 'NaN', 'Infinity', '1.2.3', '1e10', '100000001']) expect(parseMeasurement(input)).toBeNull();
        expect(parseMeasurement(' 2,5 ')).toBe(2.5);
        expect(parseMeasurement('0')).toBe(0);
    });
    it('uses the local calendar day', () => {
        const date = new Date(2026, 8, 22, 23, 59);
        expect(localHabitDate(date)).toBe('2026-09-22');
    });
});

describe('time, the way it is said', () => {
    it('says hours rather than a pile of minutes', () => {
        expect(formatDuration(240 * 60)).toBe('4 hours');
        expect(formatDuration(120 * 60)).toBe('2 hours');
        expect(formatDuration(90 * 60)).toBe('1 hour 30 minutes');
        expect(formatDuration(45 * 60)).toBe('45 minutes');
        expect(formatDuration(90 * 60, true)).toBe('1 h 30 min');
    });
    it('runs a clock with hours, minutes and seconds', () => {
        expect(formatClock(4 * 3600)).toBe('4:00:00');
        expect(formatClock(3 * 3600 + 59 * 60 + 58)).toBe('3:59:58');
        expect(formatClock(45 * 60)).toBe('45:00');
    });
});
