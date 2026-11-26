import { addSample, learnedMinutes, sampleFor, worthAdapting, type LengthSample } from '../learnedLength';

const s = (day: string, minutes: number, planned = 60): LengthSample => ({ day, minutes, planned, source: 'timeline' });

describe('sampleFor', () => {
    it('prefers minutes focused', () => {
        expect(sampleFor({ day: '2026-11-01', planned: { start: 600, end: 660 }, doneAt: 700, focusSeconds: 45 * 60 })?.minutes).toBe(45);
    });
    it('reads the timeline from the planned start to the tick', () => {
        expect(sampleFor({ day: '2026-11-01', planned: { start: 600, end: 660 }, doneAt: 690 })).toMatchObject({ minutes: 90, planned: 60, source: 'timeline' });
    });
    it('ignores a tick far outside the slot (forgot to tick, or ticked ahead)', () => {
        expect(sampleFor({ day: '2026-11-01', planned: { start: 600, end: 660 }, doneAt: 600 + 200 })).toBeNull();
        expect(sampleFor({ day: '2026-11-01', planned: { start: 600, end: 660 }, doneAt: 605 })).toBeNull();
    });
    it('says nothing without a plan or a tick', () => {
        expect(sampleFor({ day: '2026-11-01', doneAt: 700 })).toBeNull();
        expect(sampleFor({ day: '2026-11-01', planned: { start: 600, end: 660 } })).toBeNull();
    });
});

describe('learnedMinutes', () => {
    it('needs three samples', () => {
        expect(learnedMinutes([s('2026-11-01', 90), s('2026-11-02', 90)], 60, '2026-11-03')).toBeNull();
    });
    it('moves toward what it really takes, pulled toward the plan', () => {
        const learned = learnedMinutes([s('2026-11-01', 90), s('2026-11-02', 90), s('2026-11-03', 90)], 60, '2026-11-03')!;
        expect(learned).toBeGreaterThan(70);
        expect(learned).toBeLessThan(90);
        expect(learned % 5).toBe(0);
    });
    it('is not thrown by one odd day', () => {
        const learned = learnedMinutes([s('2026-11-01', 30), s('2026-11-02', 30), s('2026-11-03', 30), s('2026-11-04', 170)], 30, '2026-11-04');
        expect(learned).toBe(30);
    });
    it('lets recent days speak louder', () => {
        const old = [s('2026-08-01', 120), s('2026-08-02', 120), s('2026-08-03', 120)];
        const recent = [s('2026-11-01', 40), s('2026-11-02', 40), s('2026-11-03', 40)];
        expect(learnedMinutes([...old, ...recent], 60, '2026-11-03')!).toBeLessThan(60);
    });
});

describe('worthAdapting', () => {
    it('ignores small drift', () => {
        expect(worthAdapting(60, 65)).toBe(false);
        expect(worthAdapting(60, null)).toBe(false);
    });
    it('changes a real gap', () => {
        expect(worthAdapting(60, 75)).toBe(true);
        expect(worthAdapting(60, 45)).toBe(true);
    });
});

describe('addSample', () => {
    it('keeps one per day, the newest', () => {
        const list = addSample([s('2026-11-01', 50)], s('2026-11-01', 70));
        expect(list).toHaveLength(1);
        expect(list[0].minutes).toBe(70);
    });
});
