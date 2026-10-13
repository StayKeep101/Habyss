import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { HabitSheet } from '../Create/HabitSheet';
import { addHabit, updateHabit } from '@/lib/habitsSQLite';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
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

        // The chips read as what they are set to, not as their own names —
        // and a schedule now reads back as a sentence, not as abbreviations.
        expect(screen.getByText('Monday, Wednesday and Friday')).toBeTruthy();
        // The chip now says when it starts and when it ends, not a length.
        expect(screen.getByText('06:00 → 06:45')).toBeTruthy();
        // The habit itself is what is left once the schedule is taken out.
        expect(screen.getAllByText('Gym').length).toBeGreaterThan(0);
    });

    it('keeps a day the user taps even as they keep typing', () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Read monday');
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        fireEvent.press(screen.getByLabelText('Saturday'));
        expect(screen.getAllByText('Monday and Saturday').length).toBeGreaterThan(0);

        write(screen, 'Read monday 20 pages');
        expect(screen.getAllByText('Monday and Saturday').length).toBeGreaterThan(0);
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
        fireEvent.press(screen.getByLabelText('When it starts'));
        await act(async () => { fireEvent.press(screen.getByText('Add habit')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect((addHabit as jest.Mock).mock.calls[0][0].reminders).toEqual(['21:00']);
    });

    it('leads a reminder by hours and days, not only minutes', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Pack the bag at 18:00');
        fireEvent.press(screen.getByText('Reminder'));
        fireEvent.press(screen.getByLabelText('When it starts'));
        // A number with − and +, and the unit beside it.
        fireEvent.changeText(screen.getByLabelText('How long before'), '2');
        fireEvent.press(screen.getByLabelText('h'));
        expect(screen.getAllByText('2 hr before').length).toBeGreaterThan(0);

        fireEvent.changeText(screen.getByLabelText('How long before'), '1');
        fireEvent.press(screen.getByLabelText('day'));
        await act(async () => { fireEvent.press(screen.getByText('Add habit')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect((addHabit as jest.Mock).mock.calls[0][0]).toMatchObject({ reminders: ['18:00'], reminderOffset: 1440 });
    });

    it('reads a saved lead back in the unit it was set in', async () => {
        const habit = {
            id: 'h7', name: 'Shop', taskDays: ['sat'], goalValue: 1, unit: 'time', color: '#6B8AF5',
            icon: 'cart-outline', reminders: ['10:00'], reminderOffset: 120, startDate: '2026-01-01', startTime: '10:00',
        } as unknown as Habit;
        const screen = render(<HabitSheet visible habit={habit} />);
        fireEvent.press(screen.getByLabelText(/^Reminder/));
        // The unit opens on hours, because that is what 120 minutes is.
        expect(screen.getByLabelText('h').props.accessibilityState).toEqual({ selected: true });
        expect(screen.getByLabelText('min').props.accessibilityState).toEqual({ selected: false });
        expect(screen.getAllByText('2 hr before').length).toBeGreaterThan(0);
    });

    it('lets Health count a habit measured in something Health measures', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Walk 8000 steps');
        fireEvent.press(screen.getByLabelText(/^Measure/));
        // "Steps" is also the unit button's label; the chip is the later one.
        const chips = screen.getAllByText('Steps');
        fireEvent.press(chips[chips.length - 1]);
        await act(async () => { fireEvent.press(screen.getByText('Add habit')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect((addHabit as jest.Mock).mock.calls[0][0]).toMatchObject({ healthKitMetric: 'steps' });
    });

    it('does not offer Health for something Health cannot measure', async () => {
        const screen = render(<HabitSheet visible />);
        write(screen, 'Read 20 pages');
        fireEvent.press(screen.getByLabelText(/^Measure/));
        // A step count filling in "20 pages" would look like an answer.
        expect(screen.queryByText('Who counts it')).toBeNull();
    });

    it('edits an existing habit in place rather than making a second one', async () => {
        const habit = {
            id: 'h9', name: 'Meditate', taskDays: ['mon'], goalValue: 1, unit: 'time',
            color: '#10B981', icon: 'leaf-outline', reminders: [], startDate: '2026-01-01',
            category: 'personal', startTime: '07:00',
        } as unknown as Habit;

        const screen = render(<HabitSheet visible habit={habit} />);
        expect(screen.getByText('Save changes')).toBeTruthy();
        // An existing habit's weekdays read back as the rule they describe.
        expect(screen.getByText('Monday')).toBeTruthy();

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
    it('keeps midnight rather than falling back to a default hour', async () => {
        // 00:00 is falsy in every obvious check, which is how it used to turn
        // into 08:00 on the way to the wheel.
        const screen = render(<HabitSheet visible />);
        write(screen, 'Stretch at 00:00');
        fireEvent.press(screen.getByLabelText('Time, 00:00'));
        // The wheel is on screen the moment the row opens, not behind a button.
        expect(screen.UNSAFE_getByType('DateTimePicker' as any).props.value.getHours()).toBe(0);
        await act(async () => {});
    });
});

describe('how often a habit comes round', () => {
    it('offers every ordinary answer as a preset', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        for (const label of ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Hourly']) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        // Weekdays and weekends are weekly rules, one tap away under Weekly.
        fireEvent.press(screen.getByText('Weekly'));
        expect(screen.getByText('Weekdays')).toBeTruthy();
        expect(screen.getByText('Weekends')).toBeTruthy();
    });

    it('opens the detail a preset needs, and nothing else', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));

        fireEvent.press(screen.getByText('Monthly'));
        // A month wants dates or an ordinal, never a row of weekday toggles.
        expect(screen.getByText('Each')).toBeTruthy();
        expect(screen.getByText('On the')).toBeTruthy();
        expect(screen.queryByLabelText('Saturday')).toBeNull();
    });

    it('can say every 2 months on the third Sunday', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        fireEvent.press(screen.getByText('Monthly'));
        fireEvent.press(screen.getByText('On the'));
        fireEvent.changeText(screen.getByLabelText('How often it repeats'), '2');
        fireEvent.press(screen.getByText('Third'));
        fireEvent.press(screen.getByText('Sun'));
        expect(screen.getAllByText('Every 2 months on the third Sunday').length).toBeGreaterThan(0);
    });

    it('says the whole rule on the closed row, however long it gets', () => {
        const screen = render(<HabitSheet visible />);
        fireEvent.press(screen.getByLabelText(/^Repeat/));
        fireEvent.press(screen.getByText('Weekly'));
        fireEvent.changeText(screen.getByLabelText('How often it repeats'), '2');
        expect(screen.getAllByText(/every 2 weeks/).length).toBeGreaterThan(0);
    });
});
