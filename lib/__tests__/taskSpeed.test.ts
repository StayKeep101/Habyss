import { speedLabel, taskSpeed } from '../taskSpeed';

describe('taskSpeed', () => {
    it('pays double in half the time or less', () => {
        expect(taskSpeed({ minutes: 60, start: 600, doneAt: 630 })).toBe(2);
        expect(taskSpeed({ minutes: 60, start: 600, doneAt: 590 })).toBe(2);
    });
    it('pays one and a half within the time', () => {
        expect(taskSpeed({ minutes: 60, start: 600, doneAt: 660 })).toBe(1.5);
    });
    it('pays the usual amount when late', () => {
        expect(taskSpeed({ minutes: 60, start: 600, doneAt: 661 })).toBe(1);
    });
    it('pays the usual amount with no length or no start', () => {
        expect(taskSpeed({ minutes: undefined, start: 600, doneAt: 610 })).toBe(1);
        expect(taskSpeed({ minutes: 30, start: null, doneAt: 610 })).toBe(1);
    });
    it('says it only when it pays more', () => {
        expect(speedLabel(1.5)).toBe('Early ×1.5');
        expect(speedLabel(1)).toBeNull();
    });
});
