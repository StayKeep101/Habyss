import { rankAmong, scoreDay, type ScoreItem } from '../dayScore';
import { buildDayReview } from '../dayReview';

const item = (id: string, done: boolean, expected: number, actual: number | null, extra: Partial<ScoreItem> = {}): ScoreItem =>
    ({ id, title: id, kind: 'habit', done, expected, actual, ...extra });

describe('scoreDay', () => {
    it('scores everything done at the usual pace as 85', () => {
        expect(scoreDay([item('a', true, 60, 60), item('b', true, 30, 30)]).score).toBe(85);
    });
    it('ranks faster above slower when everything is done', () => {
        const faster = scoreDay([item('a', true, 60, 40), item('b', true, 30, 20)]).score;
        const slower = scoreDay([item('a', true, 60, 90), item('b', true, 30, 45)]).score;
        expect(faster).toBeGreaterThan(85);
        expect(slower).toBeLessThan(85);
        expect(faster).toBeLessThanOrEqual(100);
        expect(slower).toBeGreaterThanOrEqual(70);
    });
    it('scales by what got done', () => {
        expect(scoreDay([item('a', true, 60, 60), item('b', false, 30, null)]).score).toBe(43);
    });
    it('leaves lengths of time out of efficiency', () => {
        const day = scoreDay([item('read', true, 30, 60, { timed: true })]);
        expect(day.efficiency).toBeNull();
        expect(day.score).toBe(85);
    });
    it('names what ran over and what went faster', () => {
        const day = scoreDay([item('gym', true, 60, 90), item('mail', true, 30, 15)]);
        expect(day.over).toEqual([{ id: 'gym', title: 'gym', kind: 'habit', extra: 30 }]);
        expect(day.under[0]).toMatchObject({ id: 'mail', saved: 15 });
    });
    it('scores an empty day 0', () => {
        expect(scoreDay([]).score).toBe(0);
    });
});

describe('rankAmong', () => {
    it('needs five earlier days', () => {
        expect(rankAmong(80, [10, 20])).toBeNull();
    });
    it('is the share of days beaten', () => {
        expect(rankAmong(80, [70, 75, 85, 90, 60])).toBeCloseTo(0.6);
    });
});

describe('buildDayReview', () => {
    it('says what ran over and what was changed for next time', () => {
        const score = scoreDay([item('Gym', true, 60, 90)]);
        const review = buildDayReview({ score, rank: null, adapted: [{ id: 'Gym', title: 'Gym', from: 60, to: 75 }], left: [] });
        expect(review.lines[0]).toBe('Gym took 30 min extra. Next time it gets 1 h 15.');
    });
    it('points at what is left first', () => {
        const score = scoreDay([item('a', true, 60, 60), item('b', false, 30, null)]);
        expect(buildDayReview({ score, rank: null, adapted: [], left: ['Taxes'], bestHours: '9–12' }).tomorrow)
            .toBe('1 left. Put Taxes in your best hours, 9–12.');
    });
    it('keeps to three lines', () => {
        const score = scoreDay(['a', 'b', 'c', 'd'].map(id => item(id, true, 30, 60)));
        const adapted = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id, from: 30, to: 45 }));
        expect(buildDayReview({ score, rank: null, adapted, left: [] }).lines.length).toBeLessThanOrEqual(3);
    });
});
