import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { GoalSheet } from '../Create/GoalSheet';
import { addHabit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@/lib/onDeviceAI', () => ({ isOnDeviceAIReady: () => false }));
jest.mock('@/lib/habitsSQLite', () => ({
    addHabit: jest.fn().mockResolvedValue({ id: 'g1' }),
    updateHabit: jest.fn().mockResolvedValue(undefined),
    getHabits: jest.fn().mockResolvedValue([]),
}));

const write = (screen: ReturnType<typeof render>, sentence: string) =>
    fireEvent.changeText(screen.getByLabelText('Describe your goal'), sentence);

const saved = () => (addHabit as jest.Mock).mock.calls[0][0];

describe('the goal sheet', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reads a measurable goal straight out of the sentence', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Run 50km this month');

        expect(screen.getByText('At least 50 km')).toBeTruthy();
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect(saved()).toMatchObject({ isGoal: true, goalValue: 50, unit: 'km' });
        expect(JSON.parse(saved().goalSpec)).toMatchObject({ target: 50, metric_unit: 'km', direction: 'at_least' });
    });

    it('asks for what is missing on the sheet instead of refusing to save', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Get better at the guitar');

        // Nothing measurable yet, so the button says what it still needs.
        const button = screen.getByText('Add a number to hit');
        await act(async () => { fireEvent.press(button); });
        expect(addHabit).not.toHaveBeenCalled();

        fireEvent.changeText(screen.getByLabelText('Target number'), '30');
        fireEvent.press(screen.getByText('minutes'));
        fireEvent.press(screen.getByText('By when'));
        fireEvent.press(screen.getByText('Every week'));

        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect(saved()).toMatchObject({ name: 'Get better at the guitar', goalValue: 30, unit: 'minutes', goalPeriod: 'weekly' });
    });

    it('keeps a unit the user picked over the one it read', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Read 300 pages this month');
        // The chip reads as the target it holds once it has one.
        fireEvent.press(screen.getByLabelText('Target, At least 300 pages'));
        fireEvent.press(screen.getByText('At most'));

        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect(JSON.parse(saved().goalSpec)).toMatchObject({ direction: 'at_most', target: 300, metric_unit: 'pages' });
    });
});
