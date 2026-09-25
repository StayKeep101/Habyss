import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { MomentumModal } from '../Home/MomentumModal';
import { shiftDay } from '@/lib/habitDays';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Read', category: 'mind', createdAt: '2026-01-01', type: 'build',
    color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'time', taskDays: [],
    reminders: [], chartType: 'bar', startDate: '2026-01-01', isArchived: false,
    showMemo: false, frequency: 'daily', trackingMethod: 'boolean', ...over,
} as Habit);

/** 70 days ending today, so a 30-day window has a 30-day window before it. */
const history = (done: (back: number) => string[]) =>
    Array.from({ length: 70 }, (_, index) => {
        const back = 69 - index;
        return { date: shiftDay(TODAY, -back), completedIds: done(back), skippedIds: [] as string[] };
    });

const TODAY = new Date().toISOString().slice(0, 10);

const show = (habits: Habit[], days: ReturnType<typeof history>) =>
    render(
        <MomentumModal visible onClose={jest.fn()} habits={habits} history={days} completions={{}} />,
    );

describe('reading momentum', () => {
    it('leads with the rate and says what it is measured against', () => {
        const screen = show([habit()], history(() => ['h1']));
        expect(screen.getByTestId('momentum-rate')).toHaveTextContent('100%');
        expect(screen.getByText(/kept over 30 days/)).toBeTruthy();
    });

    it('shows the direction rather than only the grade', () => {
        // Kept throughout the recent window, never in the one before it.
        const screen = show([habit()], history(back => (back <= 30 ? ['h1'] : [])));
        expect(screen.getByTestId('momentum-delta')).toHaveTextContent('+100');
    });

    it('does not invent a trend before there is a window to compare with', () => {
        const fresh = habit({ startDate: shiftDay(TODAY, -3) });
        const screen = show([fresh], history(() => ['h1']));
        expect(screen.queryByTestId('momentum-delta')).toBeNull();
        expect(screen.getByText(/starts comparing itself/)).toBeTruthy();
    });

    it('ranks the habit that is dragging everything down first', () => {
        const habits = [habit({ id: 'good', name: 'Meditate' }), habit({ id: 'bad', name: 'Run' })];
        const screen = show(habits, history(() => ['good']));
        const names = screen.getAllByText(/^(Meditate|Run)$/).map(node => node.props.children);
        expect(names[0]).toBe('Run');
    });
});

describe('opening a day', () => {
    const yesterday = shiftDay(TODAY, -1);
    const label = new Date(`${yesterday}T12:00:00`)
        .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

    it('says nothing about any single day until one is tapped', () => {
        const screen = show([habit()], history(() => ['h1']));
        expect(screen.getByText('Tap a day')).toBeTruthy();
        expect(screen.queryByText(label)).toBeNull();
    });

    it('opens the tapped day and shows what it asked for', () => {
        const habits = [habit({ id: 'h1', name: 'Read' }), habit({ id: 'h2', name: 'Run' })];
        const screen = show(habits, history(() => ['h1']));

        fireEvent.press(screen.getByLabelText(new RegExp(`^${label}`)));

        // Scoped to the opened day: both names also appear in the ranking below.
        const panel = within(screen.getByTestId('day-detail'));
        expect(panel.getByText(label)).toBeTruthy();
        expect(panel.getByText('1 of 2 kept')).toBeTruthy();
        expect(panel.getByText('Read')).toBeTruthy();
        expect(panel.getByText('Run')).toBeTruthy();
    });

    it('closes the day when the same bar is tapped again', () => {
        const screen = show([habit()], history(() => ['h1']));
        const bar = screen.getByLabelText(new RegExp(`^${label}`));

        fireEvent.press(bar);
        expect(screen.getByText(label)).toBeTruthy();

        fireEvent.press(screen.getByLabelText(new RegExp(`^${label}`)));
        expect(screen.queryByText(label)).toBeNull();
    });

    it('closes the open day when the window changes, so it cannot show a day that is gone', () => {
        const screen = show([habit()], history(() => ['h1']));
        fireEvent.press(screen.getByLabelText(new RegExp(`^${label}`)));
        expect(screen.getByText(label)).toBeTruthy();

        fireEvent.press(screen.getByText('14 days'));
        expect(screen.queryByText(label)).toBeNull();
    });
});
