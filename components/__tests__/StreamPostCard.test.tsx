import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StreamPostCard, type StreamContext } from '../Community/StreamPostCard';
import type { StreamPost } from '@/lib/communityStream';
import type { FeedPost } from '@/lib/feedService';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));

const ctx = (extra: Partial<StreamContext> = {}): StreamContext => ({
    meId: 'me', myName: 'Me', rankOf: () => 2, statusOf: () => undefined, facesOf: () => [],
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

/** Swipes (as VoiceOver does) to the pack's last card: the whole day as a list. */
const toLastCard = (screen: ReturnType<typeof render>) => {
    for (let turn = 0; turn < 12; turn++) {
        const top = screen.getByLabelText(/Card \d+ of \d+/);
        const [, at, of] = /Card (\d+) of (\d+)/.exec(top.props.accessibilityLabel)!;
        if (at === of) return;
        fireEvent(top, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    }
};

it('draws a day as a pack: whose it is, how much was done, a card a thing, the list last, and reactions', () => {
    const context = ctx();
    const screen = render(<StreamPostCard item={day('daily')} ctx={context} />);
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('done')).toBeTruthy();
    expect(screen.getByText('Run, Read, Stretch')).toBeTruthy();
    expect(screen.getByLabelText(/Card 1 of 5/)).toBeTruthy();
    expect(screen.queryByText('Journal')).toBeNull();
    toLastCard(screen);
    expect(screen.getByText('Journal')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('On fire, 2'));
    expect(context.onReact).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ana' }), 'fire');
});

it('keeps one format for every day kind, saying what made it in the caption', () => {
    expect(render(<StreamPostCard item={day('comeback', { comeback: 5 })} ctx={ctx()} />).getByText('Back after 5 days')).toBeTruthy();
    expect(render(<StreamPostCard item={day('milestone', { milestone: 30 })} ctx={ctx()} />).getByText('30-day streak · next 50')).toBeTruthy();
    expect(render(<StreamPostCard item={day('best', { best: { kind: 'streak', days: 9 } })} ctx={ctx()} />).getByText('Record: 9 days in a row')).toBeTruthy();
    expect(render(<StreamPostCard item={day('chronos', { focusMinutes: 135 })} ctx={ctx()} />).getByText('2h 15m focused')).toBeTruthy();
    // The same figure on every kind.
    expect(render(<StreamPostCard item={day('comeback', { comeback: 5 })} ctx={ctx()} />).getAllByText('done').length).toBeGreaterThan(0);
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
    expect(context.onOpenComments).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ana' }), true);
});

it("shows Today's top tasks with how long each took", () => {
    const top = [{ name: 'Ship it', done: true, minutes: 90 }, { name: 'Gym', done: false, waiting: true, with: ['Sam'] }, { name: 'Read', done: false }];
    const screen = render(<StreamPostCard item={day('daily', { top })} ctx={ctx()} />);
    toLastCard(screen);
    expect(screen.getByText("Today's 3")).toBeTruthy();
    expect(screen.queryByText('1 of 3')).toBeNull();
    expect(screen.getByText('1h 30m')).toBeTruthy();
    expect(screen.getByText('with Sam')).toBeTruthy();
    expect(screen.queryByText(/waiting on/)).toBeNull();
});
