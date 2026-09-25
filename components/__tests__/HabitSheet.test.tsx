import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { HabitSheet } from '../Create/HabitSheet';
import { addHabit, updateHabit } from '@/lib/habitsSQLite';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@/lib/onDeviceAI', () => ({ isOnDeviceAIReady: () => false }));
jest.mock('@/lib/notificationService', () => ({ NotificationService: { refreshReminders: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/lib/habitsSQLite', () => ({
    addHabit: jest.fn().mockResolvedValue({ id: 'h1' }),
    updateHabit: jest.fn().mockResolvedValue(undefined),
    getGoals: jest.fn().mockResolvedValue([]),
}));

const write = (screen: ReturnType<typeof render>, sentence: string) =>
    fireEvent.changeText(screen.getByLabelText('Describe the habit'), sentence);

describe('the habit sheet', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reads the days, the time and the length out of one sentence', () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Gym monday wednesday friday at 6am for 45 minutes');

        // The chips read as what they are set to, not as their own names.
        expect(screen.getByText('Mon, Wed, Fri')).toBeTruthy();
        expect(screen.getByText('06:00 · 45m')).toBeTruthy();
        // The habit itself is what is left once the schedule is taken out.
        expect(screen.getByText('Gym')).toBeTruthy();
    });

    it('keeps a day the user taps even as they keep typing', () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Read monday');
        fireEvent.press(screen.getByLabelText('Repeat, Mon'));
        fireEvent.press(screen.getByLabelText('sat'));
        expect(screen.getByText('Mon, Sat')).toBeTruthy();

        write(screen, 'Read monday 20 pages');
        expect(screen.getByText('Mon, Sat')).toBeTruthy();
        expect(screen.getByText('20 pages')).toBeTruthy();
    });

    it('saves what the rows show, with no reminder unless one is asked for', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Run tuesday thursday at 07:30');
        await act(async () => { fireEvent.press(screen.getByText('Add habit')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect((addHabit as jest.Mock).mock.calls[0][0]).toMatchObject({
            name: 'Run',
            taskDays: ['tue', 'thu'],
            startTime: '07:30',
            reminders: [],
        });
    });

    it('turns a reminder on at the habit\'s own start time', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Stretch at 21:00');
        fireEvent.press(screen.getByText('Reminder'));
        fireEvent.press(screen.getByText('At the start time'));
        await act(async () => { fireEvent.press(screen.getByText('Add habit')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect((addHabit as jest.Mock).mock.calls[0][0].reminders).toEqual(['21:00']);
    });

    it('edits an existing habit in place rather than making a second one', async () => {
        const habit = {
            id: 'h9', name: 'Meditate', taskDays: ['mon'], goalValue: 1, unit: 'time',
            color: '#10B981', icon: 'leaf-outline', reminders: [], startDate: '2026-01-01',
            category: 'personal', startTime: '07:00',
        } as unknown as Habit;

        const screen = render(<HabitSheet visible habit={habit} />);
        expect(screen.getByText('Save changes')).toBeTruthy();
        expect(screen.getByText('Mon')).toBeTruthy();

        await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
        await waitFor(() => expect(updateHabit).toHaveBeenCalled());
        expect((updateHabit as jest.Mock).mock.calls[0][0]).toMatchObject({ id: 'h9', name: 'Meditate' });
        expect(addHabit).not.toHaveBeenCalled();
    });
});

describe('opening a habit that already exists', () => {
    const saved = {
        id: 'h9', name: 'Run everyday', taskDays: ['mon', 'wed'], goalValue: 30, unit: 'min',
        color: '#10B981', icon: 'walk-outline', reminders: [], startDate: '2026-01-01',
        category: 'personal', startTime: '07:00',
    } as unknown as Habit;

    beforeEach(() => jest.clearAllMocks());

    it('opens ready to type, with what is already there', () => {
        const screen = render(<HabitSheet visible habit={saved} />);
        const field = screen.getByLabelText('Describe the habit');
        expect(field.props.value).toBe('Run everyday');
        expect(field.props.autoFocus).toBe(true);
    });

    it('does not rename it just for being opened', async () => {
        // "Run everyday" reads as a habit called "Run" that repeats daily. That
        // is right for a sentence someone types, and would be theft of a name
        // they chose if it happened merely because they opened the habit.
        const screen = render(<HabitSheet visible habit={saved} />);
        await act(async () => { fireEvent.press(screen.getByText('Save changes')); });

        await waitFor(() => expect(updateHabit).toHaveBeenCalled());
        expect((updateHabit as jest.Mock).mock.calls[0][0]).toMatchObject({
            id: 'h9',
            name: 'Run everyday',
            taskDays: ['mon', 'wed'],
            startTime: '07:00',
        });
    });

    it('reads the sentence again as soon as it is actually edited', async () => {
        const screen = render(<HabitSheet visible habit={saved} />);
        write(screen, 'Run everyday at 18:00');
        await act(async () => { fireEvent.press(screen.getByText('Save changes')); });

        await waitFor(() => expect(updateHabit).toHaveBeenCalled());
        expect((updateHabit as jest.Mock).mock.calls[0][0]).toMatchObject({ name: 'Run', startTime: '18:00' });
    });
});
