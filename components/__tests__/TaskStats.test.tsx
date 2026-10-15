import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import TaskStatsScreen from '../../app/(root)/task-stats';
import { todayKey } from '@/lib/tasks';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/hooks/useDailyFocus', () => ({ useDailyTarget: () => 3 }));
const done = (day: string) => ({ id: day + Math.random(), title: 't', status: 'done', completedAt: `${day}T10:00:00`, priority: 2 });
let mockTasks: unknown[] = [];
jest.mock('@/hooks/useTasks', () => ({ useTasks: () => mockTasks }));

describe('the Tasks page', () => {
    it('leads with this week and reads any week under the finger', async () => {
        const today = todayKey();
        const lastWeek = new Date(`${today}T12:00:00`);
        lastWeek.setDate(lastWeek.getDate() - 7);
        const key = `${lastWeek.getFullYear()}-${String(lastWeek.getMonth() + 1).padStart(2, '0')}-${String(lastWeek.getDate()).padStart(2, '0')}`;
        mockTasks = [done(today), done(today), done(key)];
        const screen = render(<TaskStatsScreen />);
        expect(screen.getByText('done this week')).toBeTruthy();
        expect(screen.getByText('Numbers')).toBeTruthy();

        const chart = screen.getByTestId('week-chart');
        fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 800, height: 160 } } });
        fireEvent(chart, 'responderGrant', { nativeEvent: { locationX: 700 } });
        expect(screen.getByText('This week')).toBeTruthy();
        fireEvent(chart, 'responderRelease', { nativeEvent: { locationX: 700 } });
        expect(screen.getByText('done this week')).toBeTruthy();
        await act(async () => {});
    });
});
