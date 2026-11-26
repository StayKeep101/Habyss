import { withThought } from '../habitThoughts';

describe('withThought', () => {
    it('adds the newest first', () => {
        const one = withThought([], '2026-11-20', 'Felt slow', '2026-11-20T08:00:00Z');
        const two = withThought(one, '2026-11-22', 'Easy today', '2026-11-22T08:00:00Z');
        expect(two.map(item => item.date)).toEqual(['2026-11-22', '2026-11-20']);
    });

    it('keeps one a day: writing again replaces it', () => {
        const one = withThought([], '2026-11-22', 'First', '2026-11-22T08:00:00Z');
        const two = withThought(one, '2026-11-22', '  Second  ', '2026-11-22T09:00:00Z');
        expect(two).toEqual([{ date: '2026-11-22', text: 'Second', at: '2026-11-22T09:00:00Z' }]);
    });

    it('takes the day away with no words', () => {
        const one = withThought([], '2026-11-22', 'First', '2026-11-22T08:00:00Z');
        expect(withThought(one, '2026-11-22', '   ', '2026-11-22T09:00:00Z')).toEqual([]);
    });

    it('cuts long words short', () => {
        expect(withThought([], '2026-11-22', 'a'.repeat(900), 'x')[0].text).toHaveLength(600);
    });
});
