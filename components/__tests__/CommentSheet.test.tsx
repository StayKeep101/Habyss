import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CommentSheet } from '../Community/CommentSheet';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('@/lib/friendsService', () => ({
    FriendsService: {
        getFriends: jest.fn(async () => [{ id: 'f', userId: 'marie', username: 'marie', displayName: 'Marie' }]),
        reportContent: jest.fn(async () => true), blockUser: jest.fn(async () => true),
    },
}));
const mockComment = (id: string, body: string, extra = {}) => ({
    id, author: 'bo', authorName: 'Bo', toUser: 'ana', day: '2026-11-02', parentId: null, body, createdAt: `2026-11-02T1${id}:00:00Z`,
    editedAt: null, mine: false, reactions: {}, myReaction: null, ...extra,
});
jest.mock('@/lib/comments', () => ({
    ...jest.requireActual('@/lib/comments'),
    loadThread: jest.fn(async () => [mockComment('1', 'Huge day'), mockComment('2', 'Agreed', { parentId: '1', authorName: 'Cy' })]),
    postComment: jest.fn(async (_to: string, _day: string, body: string, parentId: string | null) => mockComment('9', body, { parentId, mine: true, authorName: 'You' })),
    reactToComment: jest.fn(async () => undefined),
    listenToComments: jest.fn(() => () => undefined),
}));

const target = { toUser: 'ana', day: '2026-11-02', name: 'Ana', done: 3, total: 4, mine: false };

it('shows the thread with replies, replies in one tap, and mentions a friend', async () => {
    const lib = jest.requireMock('@/lib/comments');
    const onChanged = jest.fn();
    const screen = render(<CommentSheet target={target} onClose={jest.fn()} onChanged={onChanged} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Huge day')).toBeTruthy();
    expect(screen.getByText('Agreed')).toBeTruthy();

    // A one-tap reply.
    await act(async () => { fireEvent.press(screen.getByLabelText('Send: Proud of you')); });
    expect(lib.postComment).toHaveBeenCalledWith('ana', '2026-11-02', 'Proud of you', null);
    expect(onChanged).toHaveBeenCalled();

    // Reply to Bo, mentioning Marie.
    fireEvent.press(screen.getByLabelText('Reply to Bo'));
    expect(screen.getByText('Replying to Bo')).toBeTruthy();
    const field = screen.getByLabelText('Comment');
    fireEvent.changeText(field, 'cc @ma');
    fireEvent(field, 'selectionChange', { nativeEvent: { selection: { start: 6, end: 6 } } });
    fireEvent.press(screen.getByLabelText('Mention Marie'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Send')); });
    expect(lib.postComment).toHaveBeenLastCalledWith('ana', '2026-11-02', 'cc @marie ', '1');
});

it('reacts to a comment with an emoji', async () => {
    const lib = jest.requireMock('@/lib/comments');
    const screen = render(<CommentSheet target={target} onClose={jest.fn()} onChanged={jest.fn()} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.press(screen.getAllByLabelText('React')[0]);
    await act(async () => { fireEvent.press(screen.getAllByLabelText('🔥')[0]); });
    expect(lib.reactToComment).toHaveBeenCalledWith('1', '🔥');
    expect(screen.getByLabelText('🔥 1')).toBeTruthy();
});
