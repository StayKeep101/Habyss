import { bestComments, insertMention, mentionAt, splitMentions, threadsOf, withMyEmoji, type Comment } from '../comments';

const c = (id: string, at: string, extra: Partial<Comment> = {}): Comment => ({
    id, author: 'a', authorName: 'Ana', toUser: 'bo', day: '2026-11-03', parentId: null, body: id, createdAt: at,
    editedAt: null, mine: false, reactions: {}, myReaction: null, ...extra,
});

describe('threadsOf', () => {
    it('puts replies under what they answer, oldest first, and keeps an orphan reply', () => {
        const threads = threadsOf([c('r2', '4', { parentId: 'a' }), c('b', '2'), c('a', '1'), c('r1', '3', { parentId: 'a' }), c('lost', '5', { parentId: 'gone' })]);
        expect(threads.map(thread => thread.comment.id)).toEqual(['a', 'b', 'lost']);
        expect(threads[0].replies.map(reply => reply.id)).toEqual(['r1', 'r2']);
    });
});

describe('bestComments', () => {
    it('shows the most reacted, then the most replied, then the newest', () => {
        const best = bestComments([
            c('quiet', '1'), c('loved', '2', { reactions: { '🔥': 2 } }), c('talked', '3'),
            c('re1', '4', { parentId: 'talked' }), c('re2', '5', { parentId: 'talked' }),
        ]);
        expect(best.map(comment => comment.id)).toEqual(['loved', 'talked']);
    });
});

describe('mentions', () => {
    it('finds the @word being typed and replaces it with the username', () => {
        expect(mentionAt('nice @ma', 8)).toEqual({ query: 'ma', start: 5 });
        expect(mentionAt('mail@me', 7)).toBeNull();
        expect(insertMention('nice @ma', 5, 8, 'marie')).toEqual({ text: 'nice @marie ', cursor: 12 });
    });

    it('marks mentions in a comment, but not an email address', () => {
        expect(splitMentions('go @sam! me@x.com')).toEqual([
            { text: 'go ', mention: false }, { text: '@sam', mention: true }, { text: '! me@x.com', mention: false },
        ]);
    });
});

describe('withMyEmoji', () => {
    it('moves your reaction without touching anyone else’s', () => {
        const before = c('x', '1', { reactions: { '🔥': 3, '👏': 1 }, myReaction: '👏' });
        expect(withMyEmoji(before, '🔥')).toMatchObject({ reactions: { '🔥': 4, '👏': 0 }, myReaction: '🔥' });
        expect(withMyEmoji(before, null)).toMatchObject({ reactions: { '🔥': 3, '👏': 0 }, myReaction: null });
    });
});
