import AsyncStorage from '@react-native-async-storage/async-storage';
import { addThought, byDay, getThoughts, removeThought } from '../brainDump';

describe('the brain dump', () => {
    beforeEach(() => AsyncStorage.clear());

    it('keeps thoughts newest first and ignores blanks', async () => {
        await addThought('first', new Date('2026-10-14T10:00:00Z'));
        await addThought('   ');
        const second = await addThought('second', new Date('2026-10-15T10:00:00Z'));
        expect((await getThoughts()).map(item => item.text)).toEqual(['second', 'first']);
        await removeThought(second!.id);
        expect((await getThoughts()).map(item => item.text)).toEqual(['first']);
    });

    it('groups by day', () => {
        const groups = byDay([
            { id: 'a', text: 'a', createdAt: '2026-10-15T09:00:00Z' },
            { id: 'b', text: 'b', createdAt: '2026-10-15T08:00:00Z' },
            { id: 'c', text: 'c', createdAt: '2026-10-14T08:00:00Z' },
        ], iso => iso.slice(0, 10));
        expect(groups.map(group => [group.day, group.thoughts.length])).toEqual([['2026-10-15', 2], ['2026-10-14', 1]]);
    });
});
