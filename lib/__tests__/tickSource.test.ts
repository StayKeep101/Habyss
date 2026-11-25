import { asTickSource, isRecorded, sourceShares } from '../tickSource';

describe('tick sources', () => {
    it('reads an unknown or missing source as by hand', () => {
        expect(asTickSource(null)).toBe('manual');
        expect(asTickSource('teleport')).toBe('manual');
        expect(asTickSource('health')).toBe('health');
    });
    it('tells a recorded tick from a claimed one', () => {
        expect(isRecorded('timer')).toBe(true);
        expect(isRecorded('siri')).toBe(false);
    });
    it('shares biggest first', () => {
        expect(sourceShares(['manual', 'timer', 'timer']).map(s => [s.source, s.count])).toEqual([['timer', 2], ['manual', 1]]);
        expect(sourceShares([])).toEqual([]);
    });
});
