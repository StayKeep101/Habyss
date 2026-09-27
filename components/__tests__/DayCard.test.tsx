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
