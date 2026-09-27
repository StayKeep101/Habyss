import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
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
        expect(screen.getAllByText('Gym').length).toBeGreaterThan(0);
    });

    it('keeps a day the user taps even as they keep typing', () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Read monday');
        fireEvent.press(screen.getByLabelText('Repeat, Mon'));
        fireEvent.press(screen.getByLabelText('sat'));
        expect(screen.getByText('Mon, Sat')).toBeTruthy();

        write(screen, 'Read monday 20 pages');
        expect(screen.getByText('Mon, Sat')).toBeTruthy();
        expect(screen.getByLabelText('Measure, 20 pages')).toBeTruthy();
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
        expect(within(field).getByText('Run everyday')).toBeTruthy();
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


describe('shared habit controls', () => {
    beforeEach(() => jest.clearAllMocks());
    it('preserves fractional numeric targets, quit type and monthly scheduling on edits', async () => {
        const habit = { id: 'fraction', name: 'Monthly check', goalValue: 0.5, unit: 'km', trackingMethod: 'numeric', type: 'quit', frequency: 'monthly', reminders: ['08:00', '18:00'], startDate: '2020-01-31', icon: 'flag-outline', color: '#6B8AF5' } as Habit;
        const screen = render(<HabitSheet visible habit={habit} />);
        await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
        expect(updateHabit).toHaveBeenCalledWith(expect.objectContaining({ goalValue: 0.5, unit: 'km', type: 'quit', frequency: 'monthly', reminders: ['08:00', '18:00'] }));
    });
    it('finds a unit without changing the typed amount', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Read');
        fireEvent.press(screen.getByLabelText('Measure'));
        fireEvent.changeText(screen.getByLabelText('Habit target number'), '1');
        fireEvent.press(screen.getByLabelText('Choose habit unit'));
        fireEvent.changeText(screen.getByLabelText('Search units'), 'books');
        fireEvent.press(screen.getByLabelText('Unit Books'));
        await act(async () => { fireEvent.press(screen.getByText('Add habit')); });
        expect(addHabit).toHaveBeenCalledWith(expect.objectContaining({ goalValue: 1, unit: 'books', trackingMethod: 'numeric' }));
    });
    it('keeps midnight when opening the time control', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Stretch at 00:00');
        fireEvent.press(screen.getByLabelText('Time, 00:00'));
        fireEvent.press(screen.getByText('Starts at 00:00'));
        expect(screen.UNSAFE_getByType('DateTimePicker' as any).props.value.getHours()).toBe(0);
        await act(async () => {});
    });
});

describe('how often a habit comes round', () => {
    it('offers fortnightly and monthly, not just which weekdays', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        for (const label of ['Weekly', 'Every 2 weeks', 'Day of month', 'Yearly']) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it('hides the weekday grid for a cadence that does not use it', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        expect(screen.getByText('Weekdays')).toBeTruthy();

        fireEvent.press(screen.getByText('Day of month'));
        // Nothing to pick: it repeats off the start date, and says so.
        expect(screen.getByText(/same date each month/)).toBeTruthy();
        expect(screen.queryByText('Weekdays')).toBeNull();
    });

    it('says how often it repeats on the closed row', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        fireEvent.press(screen.getByText('Every 2 weeks'));
        expect(screen.getByText(/every 2 weeks/)).toBeTruthy();
    });
});
