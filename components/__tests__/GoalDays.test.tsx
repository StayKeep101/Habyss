import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { GoalDayCard, GoalMonth } from '../Goal/GoalDays';
import type { GoalDay } from '@/lib/goalPlanPeriod';
import type { Habit } from '@/lib/habitsSQLite';
import type { Task } from '@/lib/tasks';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }), useAccent: () => ({ accent: '#00b9e8' }) }));

const run = { id: 'run', name: 'Run' } as Habit;
const shoes = { id: 't', title: 'Buy shoes', status: 'open' } as Task;
const day = (key: string): GoalDay => ({ day: key, items: [
    { kind: 'habit', id: 'run', title: 'Run', done: false, habit: run },
    { kind: 'task', id: 't', title: 'Buy shoes', done: false, task: shoes },
] });

describe('a day of a goal', () => {
    it('ticks a habit only today, a task any day, and plans a task on a day to come', async () => {
        const onToggle = jest.fn();
        const onAddTask = jest.fn();
        const later = render(<GoalDayCard day={day('2026-10-28')} today="2026-10-26" color="#7aa2ff" onToggle={onToggle} onOpen={jest.fn()} onAddTask={onAddTask} />);
        expect(later.queryByRole('checkbox', { name: 'Habit: Run' })).toBeNull();
        fireEvent.press(later.getByRole('checkbox', { name: 'Task: Buy shoes' }));
        expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ kind: 'task' }));
        fireEvent.press(later.getByLabelText(/Plan a task on/));
        expect(onAddTask).toHaveBeenCalledWith('2026-10-28');

        const now = render(<GoalDayCard day={day('2026-10-26')} today="2026-10-26" color="#7aa2ff" onToggle={onToggle} onOpen={jest.fn()} />);
        expect(now.getByText('Today')).toBeTruthy();
        fireEvent.press(now.getByRole('checkbox', { name: 'Habit: Run' }));
        expect(onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'habit' }));
        await act(async () => {});
    });

    it('says a day with nothing planned is free', async () => {
        const screen = render(<GoalDayCard day={{ day: '2026-10-27', items: [] }} today="2026-10-26" color="#7aa2ff" onToggle={jest.fn()} onOpen={jest.fn()} />);
        expect(screen.getByText('Nothing planned. A free day.')).toBeTruthy();
        await act(async () => {});
    });
});

describe('a month of a goal', () => {
    it('picks a day inside the goal and draws none outside it', async () => {
        const onSelect = jest.fn();
        const screen = render(<GoalMonth month="2026-10-01" days={{ '2026-10-28': day('2026-10-28') }} selected={null} today="2026-10-26" color="#7aa2ff"
            weekStartsMonday inRange={key => key >= '2026-10-20'} onSelect={onSelect} />);
        fireEvent.press(screen.getByLabelText(/October 28.*Run; Buy shoes/));
        expect(onSelect).toHaveBeenCalledWith('2026-10-28');
        // Days before the goal began are not drawn at all, nor weeks made only of them.
        expect(screen.queryByLabelText(/October 19\./)).toBeNull();
        expect(screen.queryByLabelText(/October 5\./)).toBeNull();
        expect(screen.getByLabelText(/October 20\. Nothing planned/)).toBeTruthy();
        await act(async () => {});
    });
});
