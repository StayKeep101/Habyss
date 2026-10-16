import React from 'react';
import { render } from '@testing-library/react-native';
import { MomentumModal } from '../Home/MomentumModal';
import { shiftDay } from '@/lib/habitDays';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
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

const TODAY = (() => {
    // The code keys days locally; toISOString would be a day out whenever the
    // machine is behind UTC — the same mistake the heatmap had.
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
})();

const show = (habits: Habit[], days: ReturnType<typeof history>) =>
    render(
        <MomentumModal visible onClose={jest.fn()} habits={habits} history={days} completions={{}} />,
    );

describe('trend', () => {
    it('answers in one sentence: how much was kept, against the month before', () => {
        // Kept every day lately, never before: up 100 points.
        const screen = show([habit()], history(back => (back <= 30 ? ['h1'] : [])));
        expect(screen.getByText('100%')).toBeTruthy();
        expect(screen.getByText(/of habits kept/)).toBeTruthy();
        expect(screen.getByText(/↑ 100 vs last month/)).toBeTruthy();
    });

    it('sorts habits into rising and slipping', () => {
        const run = habit({ id: 'h2', name: 'Run' });
        const screen = show([habit(), run], history(back => (back <= 30 ? ['h1'] : ['h2'])));
        expect(screen.getByText('Rising')).toBeTruthy();
        expect(screen.getByText('Slipping')).toBeTruthy();
    });
});
