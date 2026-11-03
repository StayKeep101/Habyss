import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StreamPostCard, type StreamContext } from '../Community/StreamPostCard';
import type { StreamPost } from '@/lib/communityStream';
import type { FeedPost } from '@/lib/feedService';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));

const ctx = (extra: Partial<StreamContext> = {}): StreamContext => ({
    meId: 'me', myName: 'Me', kingId: null, rankOf: () => 2, statusOf: () => undefined, facesOf: () => [],
    onReact: jest.fn(), onReport: jest.fn(), openPerson: jest.fn(), commentsOf: () => [], onOpenComments: jest.fn(), ...extra,
});
const post = (card = {}): FeedPost => ({
    userId: 'ana', day: '2026-11-02', postedAt: '2026-11-02T18:00:00.000Z', name: 'Ana', username: 'ana',
    card: { habitsDone: 3, habitsTotal: 4, tasksDone: 0, tasksTotal: 0, streak: 6, habits: [
        { name: 'Run', done: true }, { name: 'Read', done: true }, { name: 'Stretch', done: true }, { name: 'Journal', done: false },
    ], ...card },
    ackCount: 0, ackedByMe: false, ackUsers: [], myReaction: null, reactions: { fire: 2 }, mine: false,
});
const day = (kind: StreamPost['kind'], card = {}): StreamPost => ({ kind, key: 'k', at: 'x', post: post(card) } as StreamPost);

it('draws a day with its share, rank, what was done, details on demand, and reactions', () => {
    const context = ctx();
    const screen = render(<StreamPostCard item={day('daily')} ctx={context} />);
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('3 of 4 done')).toBeTruthy();
    expect(screen.getByText('Run, Read, Stretch')).toBeTruthy();
    expect(screen.queryByText('Journal')).toBeNull();
    fireEvent.press(screen.getByLabelText('Show details'));
    expect(screen.getByText('Journal')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('On fire, 2'));
    expect(context.onReact).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ana' }), 'fire');
});

it('tells the day kinds apart', () => {
    expect(render(<StreamPostCard item={day('comeback', { comeback: 5 })} ctx={ctx()} />).getByText('after 5 days')).toBeTruthy();
    expect(render(<StreamPostCard item={day('milestone', { milestone: 30 })} ctx={ctx()} />).getByText('Next: 50')).toBeTruthy();
    expect(render(<StreamPostCard item={day('best', { best: { kind: 'streak', days: 9 } })} ctx={ctx()} />).getByText('New record')).toBeTruthy();
    expect(render(<StreamPostCard item={day('chronos', { focusMinutes: 135 })} ctx={ctx()} />).getByText('focused')).toBeTruthy();
});

it('shows the best comments on the card and opens the conversation', () => {
    const comment = (id: string, body: string, extra = {}) => ({
        id, author: 'bo', authorName: 'Bo', toUser: 'ana', day: '2026-11-02', parentId: null, body, createdAt: id,
        editedAt: null, mine: false, reactions: {}, myReaction: null, ...extra,
    });
    const context = ctx({ commentsOf: () => [comment('1', 'nice'), comment('2', 'go @ana', { reactions: { '🔥': 2 } }), comment('3', 'wow')] });
    const screen = render(<StreamPostCard item={day('daily')} ctx={context} />);
    expect(screen.getByText('go ')).toBeTruthy();
    expect(screen.getByText('@ana')).toBeTruthy();
    expect(screen.getByText('View all 3')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('3 comments'));
    expect(context.onOpenComments).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ana' }));
});
