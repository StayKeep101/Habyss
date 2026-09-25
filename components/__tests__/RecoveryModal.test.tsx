import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecoveryModal } from '../Home/RecoveryModal';
import { shiftDay } from '@/lib/habitDays';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }) }));

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Read', category: 'mind', createdAt: '2026-01-01', type: 'build',
    color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'time', taskDays: [],
    reminders: [], chartType: 'bar', startDate: '2026-01-01', isArchived: false,
    showMemo: false, frequency: 'daily', trackingMethod: 'boolean', ...over,
} as Habit);

const TODAY = new Date().toISOString().slice(0, 10);

/** 90 days ending today: '.' kept, 'x' not kept, padded with kept days before. */
const days = (pattern: string) =>
    Array.from({ length: 90 }, (_, index) => {
        const back = 89 - index;
        const mark = back < pattern.length ? pattern[pattern.length - 1 - back] : '.';
        return { date: shiftDay(TODAY, -back), completedIds: mark === '.' ? ['h1'] : [], skippedIds: [] as string[] };
    });

const show = (pattern: string, habits = [habit()], completions: Record<string, boolean> = {}) =>
    render(<RecoveryModal visible onClose={jest.fn()} habits={habits} history={days(pattern)} completions={completions} />);

beforeEach(() => mockPush.mockClear());

describe('what is savable today', () => {
    it('leads with the habit that is about to be missed twice', () => {
        // Missed yesterday, due again today, not done.
        const screen = show('..x.');
        expect(screen.getByText('PROTECT TODAY')).toBeTruthy();
        expect(screen.getByText(/do it today and it stays a single miss/)).toBeTruthy();
    });

    it('opens the habit so the miss can actually be answered', () => {
        const screen = show('..x.');
        fireEvent.press(screen.getByLabelText(/^Read, missed on/));
        expect(mockPush).toHaveBeenCalledWith({ pathname: '/habit-detail', params: { habitId: 'h1' } });
    });

    it('says so plainly when nothing is at risk', () => {
        const screen = show('....', [habit()], { h1: true });
        expect(screen.queryByText('PROTECT TODAY')).toBeNull();
        expect(screen.getByText(/Nothing is about to be missed twice/)).toBeTruthy();
    });
});

describe('the headline', () => {
    it('refuses to show a damning zero before anything has been missed', () => {
        const screen = show('....', [habit()], { h1: true });
        expect(screen.getByTestId('recovery-rate')).toHaveTextContent('—');
        expect(screen.getByText(/Nothing has been missed twice yet/)).toBeTruthy();
    });

    it('counts getting back up rather than being perfect', () => {
        // One miss, answered the next day.
        const screen = show('..x..', [habit()], { h1: true });
        expect(screen.getByTestId('recovery-rate')).toHaveTextContent('100%');
        expect(screen.getByText(/the very next day it was due/)).toBeTruthy();
    });

    it('explains the rule it is built on', () => {
        const screen = show('....', [habit()], { h1: true });
        expect(screen.getByText(/Missing once is an accident/)).toBeTruthy();
    });
});
