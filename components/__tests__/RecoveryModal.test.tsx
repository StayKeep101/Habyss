import React from 'react';
import { render } from '@testing-library/react-native';
import { RecoveryModal } from '../Home/RecoveryModal';
import { shiftDay } from '@/lib/habitDays';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/lib/habitsSQLite', () => ({ toggleCompletion: jest.fn() }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }) }));

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Read', category: 'mind', createdAt: '2026-01-01', type: 'build',
    color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'time', taskDays: [],
    reminders: [], chartType: 'bar', startDate: '2026-01-01', isArchived: false,
    showMemo: false, frequency: 'daily', trackingMethod: 'boolean', ...over,
} as Habit);

const TODAY = (() => {
    // The code keys days locally; toISOString would be a day out whenever the
    // machine is behind UTC — the same mistake the heatmap had.
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
})();

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

describe('bounce back', () => {
    it('states the rule and how often you got straight back on it', () => {
        // Missed two days ago, kept yesterday: one recovery out of one.
        const screen = show('x..');
        expect(screen.getByText(/Never miss twice/)).toBeTruthy();
        // The figure counts up; its label carries the final value.
        expect(screen.getByLabelText('100%')).toBeTruthy();
        expect(screen.getByText(/1 of 1/)).toBeTruthy();
    });

    it('lists what can still be saved today, with a tick beside it', () => {
        // Missed yesterday, due again today and not done yet.
        const screen = show('.xx');
        expect(screen.getByText('Save today')).toBeTruthy();
        expect(screen.getByLabelText('Mark Read done')).toBeTruthy();
    });

    it('says so when there have been no misses', () => {
        const screen = show('....');
        expect(screen.getByText(/No misses in the last 90 days/)).toBeTruthy();
    });
});
