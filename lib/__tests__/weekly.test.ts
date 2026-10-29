jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../supabase', () => ({ getSupabase: () => null }));
import { computeMarks } from '../marks';
import { shardMoves } from '../shards';
import { missionText, revealText } from '../weekly';

describe('secret missions, in words', () => {
    it('says what to get the friend to do', () => {
        expect(missionText('full_day', 'Lucas', 1)).toBe('Get Lucas to keep every habit for a whole day before the week ends.');
        expect(missionText('show_up', 'Lucas', 3)).toBe('Get Lucas to show up on 3 days this week.');
        expect(missionText('react', 'Lucas', 1)).toBe('Get Lucas to react to one of your days this week.');
    });
    it('tells the friend once the week is over, and the owner how it went', () => {
        expect(revealText({ ownerName: 'Sam', friendName: 'Lucas', kind: 'show_up', completed: true, mine: false }))
            .toBe('Sam’s secret mission was to get you to show up 3 days. You helped them do it.');
        expect(revealText({ ownerName: 'You', friendName: 'Lucas', kind: 'react', completed: false, mine: true }))
            .toBe('Your secret was to get Lucas to react to one of their days. Not this time.');
    });
    it('earns 50 Marks (XP) and no Shards', () => {
        const marks = computeMarks({ habits: [], tasks: [], history: {}, missions: [{ title: 'Get Lucas…', doneAt: '2026-10-28T10:00:00' }], today: '2026-10-28' });
        expect(marks.total).toBe(50);
        expect(shardMoves(marks.ledger, {})).toHaveLength(0);
    });
});
