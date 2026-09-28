import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTE_LIMIT, NOTES_PER_CARD, addNote, cleanNote, getNotes, mergeNotes, pendingNotes, removeNote } from '../dayNotes';

const DAY = '2026-09-27';

describe('what is worth saving', () => {
    it('collapses the shape of whatever it was pasted out of', () => {
        expect(cleanNote('  nice   run\n\n today  ')).toBe('nice run today');
    });
    it('treats nothing as nothing', () => {
        expect(cleanNote('')).toBeNull();
        expect(cleanNote('   \n ')).toBeNull();
    });
    it('caps a note rather than refusing it', () => {
        const long = cleanNote('a'.repeat(NOTE_LIMIT + 50));
        expect(long).toHaveLength(NOTE_LIMIT);
    });
});

describe('notes on a day', () => {
    beforeEach(async () => { await AsyncStorage.clear(); });

    it('keeps them in the order they were written', async () => {
        await addNote(DAY, 'friend-1', 'How was the long run?');
        await addNote(DAY, 'friend-1', 'Same time tomorrow?');
        const notes = await getNotes(DAY);
        expect(notes['friend-1'].map(note => note.text)).toEqual(['How was the long run?', 'Same time tomorrow?']);
    });

    it('keeps each person separate', async () => {
        await addNote(DAY, 'friend-1', 'one');
        await addNote(DAY, 'friend-2', 'two');
        const notes = await getNotes(DAY);
        expect(notes['friend-1']).toHaveLength(1);
        expect(notes['friend-2']).toHaveLength(1);
    });

    it('saves nothing for an empty send', async () => {
        expect(await addNote(DAY, 'friend-1', '   ')).toBeNull();
        expect(await getNotes(DAY)).toEqual({});
    });

    it('takes one back', async () => {
        const note = await addNote(DAY, 'friend-1', 'oops');
        await removeNote(DAY, 'friend-1', note!.id);
        expect(await getNotes(DAY)).toEqual({});
    });

    it('keeps a card a card, however much is said', async () => {
        for (let index = 0; index < NOTES_PER_CARD + 5; index++) await addNote(DAY, 'friend-1', `note ${index}`);
        const notes = await getNotes(DAY);
        expect(notes['friend-1']).toHaveLength(NOTES_PER_CARD);
        // The oldest go, not the newest: a conversation reads forwards.
        expect(notes['friend-1'][notes['friend-1'].length - 1].text).toBe(`note ${NOTES_PER_CARD + 4}`);
    });

    it('reads nothing out of something that is not notes', async () => {
        await AsyncStorage.setItem(`feed_notes_${DAY}`, '{"friend-1":[{"nope":true},"text"]}');
        expect(await getNotes(DAY)).toEqual({ 'friend-1': [] });
    });

    it('survives a corrupt store rather than throwing at the feed', async () => {
        await AsyncStorage.setItem(`feed_notes_${DAY}`, 'not json');
        expect(await getNotes(DAY)).toEqual({});
    });
});

describe('what a card shows when some notes have not sent', () => {
    it('puts what the server has first, then what has not reached it', () => {
        const server = [{ id: 's1', cardId: 'f1', date: DAY, text: 'arrived', at: 1, mine: true }];
        const waiting = [{ id: 'p1', cardId: 'f1', date: DAY, text: 'not yet', at: 2, mine: true, pending: true }];
        expect(mergeNotes(server, waiting).map(note => note.text)).toEqual(['arrived', 'not yet']);
    });

    it('never shows one twice', () => {
        const both = [{ id: 'x', cardId: 'f1', date: DAY, text: 'once', at: 1, mine: true }];
        expect(mergeNotes(both, [{ ...both[0], pending: true }])).toHaveLength(1);
    });

    it('copes with either side being empty', () => {
        expect(mergeNotes()).toEqual([]);
        expect(mergeNotes([], [{ id: 'p', cardId: 'f1', date: DAY, text: 'alone', at: 1, mine: true, pending: true }])).toHaveLength(1);
    });
});

describe('what is waiting to be sent', () => {
    beforeEach(async () => { await AsyncStorage.clear(); });

    it('is everything written locally, oldest first, across people', async () => {
        await addNote(DAY, 'friend-2', 'second');
        await addNote(DAY, 'friend-1', 'first');
        const waiting = await pendingNotes(DAY);
        expect(waiting).toHaveLength(2);
        expect(waiting[0].at).toBeLessThanOrEqual(waiting[1].at);
        expect(waiting.every(note => note.pending)).toBe(true);
    });

    it('is nothing when nothing was written', async () => {
        expect(await pendingNotes(DAY)).toEqual([]);
    });
});
