import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StreamPostCard, type StreamContext } from '../Community/StreamPostCard';
import type { StreamPost } from '@/lib/communityStream';
import type { FeedPost } from '@/lib/feedService';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));

const ctx = (extra: Partial<StreamContext> = {}): StreamContext => ({
    meId: 'me', myName: 'Me', kingId: null, rankOf: () => 2, statusOf: () => undefined, facesOf: () => [],
    onReact: jest.fn(), onReport: jest.fn(), openPerson: jest.fn(), rematch: jest.fn(), seeWeek: jest.fn(), ...extra,
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

it('draws a rivalry live, a victory with a rematch, the king with the race', () => {
    const duel = { id: 'd', mine: true, friendId: 'sam', name: 'Sam', stake: 25, days: 7, starts: '2026-10-27', ends: '2099-01-01',
        status: 'active' as const, winnerId: null, me: { done: 6, total: 8, days: 5 }, them: { done: 3, total: 8, days: 4 } };
    const live = render(<StreamPostCard item={{ kind: 'rivalry', key: 'r', at: 'x', duel }} ctx={ctx()} />);
    expect(live.getByText('You vs Sam')).toBeTruthy();
    expect(live.getByText('Ahead')).toBeTruthy();
    expect(live.getByLabelText('Live')).toBeTruthy();

    const context = ctx();
    const won = render(<StreamPostCard item={{ kind: 'victory', key: 'v', at: 'x', duel: { ...duel, status: 'settled', winnerId: 'me' } }} ctx={context} />);
    expect(won.getByText('You beat Sam')).toBeTruthy();
    fireEvent.press(won.getByText('Run it back'));
    expect(context.rematch).toHaveBeenCalled();

    const king = render(<StreamPostCard item={{ kind: 'king', key: 'k', at: 'x', king: { userId: 'bea', name: 'Bea', days: 6, showUps: 20 } }} ctx={context} />);
    expect(king.getByText('Bea wears the crown')).toBeTruthy();
    fireEvent.press(king.getByText('See the race'));
    expect(context.seeWeek).toHaveBeenCalled();
});
