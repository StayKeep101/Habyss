import { minutesAsleep } from '../sleepMath';

const at = (time: string) => `2026-10-16T${time}:00.000Z`;
const prev = (time: string) => `2026-10-15T${time}:00.000Z`;

describe('minutes asleep', () => {
    it('counts the stages a watch records, not the awake time between', () => {
        expect(minutesAsleep([
            { value: 'CORE', startDate: prev('23:00'), endDate: at('01:00') },
            { value: 'AWAKE', startDate: at('01:00'), endDate: at('01:10') },
            { value: 'DEEP', startDate: at('01:10'), endDate: at('02:40') },
            { value: 'REM', startDate: at('02:40'), endDate: at('07:38') },
        ])).toBe(120 + 90 + 298);
    });

    it('merges two sources recording the same night instead of adding them', () => {
        expect(minutesAsleep([
            { value: 'CORE', startDate: prev('23:00'), endDate: at('07:00') },
            { value: 'ASLEEP', startDate: prev('23:30'), endDate: at('07:30') },
        ])).toBe(510);
    });

    it('falls back to time in bed only when nothing recorded sleep', () => {
        expect(minutesAsleep([{ value: 'INBED', startDate: prev('23:00'), endDate: at('07:00') }])).toBe(480);
        expect(minutesAsleep([
            { value: 'INBED', startDate: prev('22:00'), endDate: at('08:00') },
            { value: 'CORE', startDate: prev('23:00'), endDate: at('07:00') },
        ])).toBe(480);
        expect(minutesAsleep([])).toBe(0);
    });
});
