jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import { bedtimeLine, minutesPastBedtime, nudgeDue, NUDGE_EVERY_MS } from '../bedtimeNudge';

const day = { wake: '07:00', sleep: '23:00' };
const at = (hh: number, mm: number) => new Date(2026, 10, 21, hh, mm);

describe('bedtime nudge', () => {
    it('knows how late it is, across midnight', () => {
        expect(minutesPastBedtime(at(22, 59), day)).toBeNull();
        expect(minutesPastBedtime(at(23, 0), day)).toBe(0);
        expect(minutesPastBedtime(at(0, 30), day)).toBe(90);
        expect(minutesPastBedtime(at(8, 0), day)).toBeNull();
    });
    it('says one at bedtime, then every quarter hour', () => {
        expect(nudgeDue(at(23, 1), day, null)).toBe(true);
        const last = at(23, 1).getTime();
        expect(nudgeDue(at(23, 10), day, last)).toBe(false);
        expect(nudgeDue(new Date(last + NUDGE_EVERY_MS), day, last)).toBe(true);
        expect(nudgeDue(at(21, 0), day, null)).toBe(false);
    });
    it('never repeats the last line and speaks in the voice', () => {
        const first = bedtimeLine(5, 'goofball', null, () => 0);
        expect(bedtimeLine(5, 'goofball', first, () => 0)).not.toBe(first);
        expect(bedtimeLine(120, 'dad_mode', null, () => 0)).toBe('This is how streaks die. Go to bed.');
    });
});
