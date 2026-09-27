import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DayCard } from '../Community/DayCard';
import { buildFeed } from '@/lib/feed';
import type { Friend } from '@/lib/friendsService';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));

const cardFor = (over: Partial<Friend>) =>
    buildFeed([{ id: 'f1', userId: 'f1', username: 'sam', ...over } as Friend])[0];

const show = (over: Partial<Friend> = {}, props: Partial<React.ComponentProps<typeof DayCard>> = {}) =>
    render(
        <DayCard
            card={cardFor(over)}
            onReact={jest.fn()}
            onOpen={jest.fn()}
            {...props}
        />,
    );

describe('a friend’s day', () => {
    it('shows who it is and what they did', () => {
        const screen = show({ todayCompleted: 2, todayTotal: 3 });
        expect(screen.getByText('sam')).toBeTruthy();
        expect(screen.getByText('2 of 3 done')).toBeTruthy();
    });

    it('calls you "You" rather than your own username', () => {
        const screen = show({ isCurrentUser: true, todayCompleted: 0, todayTotal: 2 });
        expect(screen.getByText('You')).toBeTruthy();
        expect(screen.queryByText('sam')).toBeNull();
    });

    it('lets a rest day be a rest day, not a failure', () => {
        expect(show({ todayCompleted: 0, todayTotal: 0 }).getByText('Nothing due today')).toBeTruthy();
    });

    it('shows a run only when there is one worth showing', () => {
        expect(show({ todayCompleted: 2, todayTotal: 2, currentStreak: 1 }).queryByText('1')).toBeNull();
        expect(show({ todayCompleted: 2, todayTotal: 2, currentStreak: 7 }).getByText('7')).toBeTruthy();
    });

    it('says nothing about proof when nothing was done', () => {
        // A badge on an empty day would be reading evidence into inaction.
        expect(show({ todayCompleted: 0, todayTotal: 3 }).queryByText('Logged')).toBeNull();
        expect(show({ todayCompleted: 1, todayTotal: 3 }).getByText('Logged')).toBeTruthy();
    });
});

describe('reacting', () => {
    it('offers every reaction', () => {
        const screen = show({ todayCompleted: 1, todayTotal: 1 });
        for (const label of ['Fire', 'Respect', 'Strong', 'Love', 'Star']) {
            expect(screen.getByLabelText(label)).toBeTruthy();
        }
    });

    it('reports which one was tapped', () => {
        const onReact = jest.fn();
        const screen = show({ todayCompleted: 1, todayTotal: 1 }, { onReact });
        fireEvent.press(screen.getByLabelText('Fire'));
        expect(onReact).toHaveBeenCalledWith('fire');
    });

    it('marks the one already given, so it can be taken back', () => {
        const screen = show({ todayCompleted: 1, todayTotal: 1 }, { reaction: 'clap' });
        expect(screen.getByLabelText('Respect').props.accessibilityState).toEqual({ selected: true });
        expect(screen.getByLabelText('Fire').props.accessibilityState).toEqual({ selected: false });
    });

    it('opens the friend when the card itself is tapped', () => {
        const onOpen = jest.fn();
        const screen = show({ todayCompleted: 1, todayTotal: 2 }, { onOpen });
        fireEvent.press(screen.getByLabelText(/^sam\./));
        expect(onOpen).toHaveBeenCalled();
    });
});

describe('saying something', () => {
    const notes = [
        { id: 'n1', cardId: 'f1', date: '2026-09-27', text: 'How was the long run?', at: 1, mine: true },
        { id: 'n2', cardId: 'f1', date: '2026-09-27', text: 'Brutal, worth it.', at: 2, mine: false },
    ];

    it('says nothing about notes on a card that cannot take them', () => {
        const screen = show({ todayCompleted: 1, todayTotal: 1 });
        expect(screen.queryByLabelText(/^Say something/)).toBeNull();
    });

    it('sends what was typed, once', () => {
        const onComment = jest.fn();
        const screen = show({ todayCompleted: 1, todayTotal: 1 }, { onComment });
        fireEvent.press(screen.getByLabelText('Say something'));
        fireEvent.changeText(screen.getByLabelText('Your note'), 'Nice work');
        fireEvent.press(screen.getByLabelText('Send the note'));
        expect(onComment).toHaveBeenCalledWith('Nice work');
        expect(onComment).toHaveBeenCalledTimes(1);
    });

    it('does not send an empty note', () => {
        const onComment = jest.fn();
        const screen = show({ todayCompleted: 1, todayTotal: 1 }, { onComment });
        fireEvent.press(screen.getByLabelText('Say something'));
        fireEvent.press(screen.getByLabelText('Send the note'));
        expect(onComment).not.toHaveBeenCalled();
    });

    it('shows what has been said, and who said it', () => {
        const screen = show({ todayCompleted: 1, todayTotal: 1 }, { notes, onComment: jest.fn() });
        expect(screen.getByLabelText('Say something · 2 already said')).toBeTruthy();
        expect(screen.getByText(/How was the long run\?/)).toBeTruthy();
        expect(screen.getByText('You')).toBeTruthy();
        // Their name is on the card as well as on their note.
        expect(screen.getAllByText('sam').length).toBeGreaterThan(1);
    });

    it('only offers to take back what you wrote', () => {
        const onDeleteNote = jest.fn();
        const screen = show({ todayCompleted: 1, todayTotal: 1 }, { notes, onComment: jest.fn(), onDeleteNote });
        const backs = screen.getAllByLabelText('Take that back');
        expect(backs).toHaveLength(1);
        fireEvent.press(backs[0]);
        expect(onDeleteNote).toHaveBeenCalledWith('n1');
    });
});
