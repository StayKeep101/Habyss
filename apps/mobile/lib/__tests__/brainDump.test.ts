import AsyncStorage from '@react-native-async-storage/async-storage';
import { addThought, byDay, getThoughts, moveItem, removeThought, reorderThoughts, restoreThought, updateThought } from '../brainDump';

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

describe('changing the dump with no friction', () => {
    beforeEach(() => AsyncStorage.clear());

    it('rewords, removes when cleared, restores on undo and keeps a dragged order', async () => {
        const a = await addThought('a', new Date('2026-10-14T10:00:00Z'));
        const b = await addThought('b', new Date('2026-10-15T10:00:00Z'));
        const c = await addThought('c', new Date('2026-10-16T10:00:00Z'));
        await updateThought(b!.id, 'b, better');
        expect((await getThoughts()).map(item => item.text)).toEqual(['c', 'b, better', 'a']);
        await updateThought(a!.id, '   ');
        expect((await getThoughts()).map(item => item.text)).toEqual(['c', 'b, better']);
        await restoreThought(a!, 1);
        expect((await getThoughts()).map(item => item.text)).toEqual(['c', 'a', 'b, better']);
        await reorderThoughts([b!.id, c!.id, a!.id]);
        expect((await getThoughts()).map(item => item.text)).toEqual(['b, better', 'c', 'a']);
    });

    it('moves an item from one place to another', () => {
        expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
        expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    });
});
