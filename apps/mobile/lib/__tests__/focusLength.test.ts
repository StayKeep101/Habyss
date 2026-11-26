import { focusMinutesFor } from '../focusLength';

describe('how long to focus on a habit', () => {
    it('uses the habit’s own length first', () => {
        expect(focusMinutesFor({ durationMinutes: 25, startTime: '09:00', endTime: '11:00' })).toBe(25);
    });
    it('falls back to its time slot, wrapping past midnight', () => {
        expect(focusMinutesFor({ startTime: '09:00', endTime: '10:30' })).toBe(90);
        expect(focusMinutesFor({ startTime: '23:30', endTime: '00:15' })).toBe(45);
    });
    it('has nothing to focus on without a time', () => {
        expect(focusMinutesFor({ startTime: '09:00' })).toBeNull();
        expect(focusMinutesFor({})).toBeNull();
        expect(focusMinutesFor({ startTime: '09:00', endTime: '09:00' })).toBeNull();
    });
});
