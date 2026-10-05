import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { GoalSheet } from '../Create/GoalSheet';
import { addHabit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
jest.mock('react-native-gesture-handler', () => ({
    ...jest.requireActual('react-native-gesture-handler'),
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
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

        expect(screen.getByText('50 Km')).toBeTruthy();
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });

        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect(saved()).toMatchObject({ isGoal: true, goalValue: 50, unit: 'km' });
        expect(JSON.parse(saved().goalSpec)).toMatchObject({ target: 50, metric_unit: 'km', direction: 'at_least' });
    });

    it('asks for what is missing on the sheet instead of refusing to save', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Get better at the guitar');

        // No number in it, so it reads as a project and asks for its steps.
        expect(screen.getByText('Add the major steps')).toBeTruthy();
        // As a number goal, the button says what it still needs.
        fireEvent.press(screen.getByRole('radio', { name: 'Number' }));
        const button = screen.getByText('Add a number to hit');
        await act(async () => { fireEvent.press(button); });
        expect(addHabit).not.toHaveBeenCalled();

        fireEvent.changeText(screen.getByLabelText('Target number'), '30');
        fireEvent.press(screen.getByLabelText('Choose target unit'));
        fireEvent.press(screen.getByLabelText('Unit Minutes'));
        fireEvent.press(screen.getByText('By when'));
        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        fireEvent.press(screen.getByLabelText(`Choose ${date}`));

        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect(saved()).toMatchObject({ name: 'Get better at the guitar', goalValue: 30, unit: 'minutes', targetDate: date });
    });

    it('turns a project into ordered steps', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Launch Habyss');
        fireEvent.press(screen.getByText('Steps'));
        fireEvent.changeText(screen.getByLabelText('Add a step'), 'Onboarding');
        fireEvent(screen.getByLabelText('Add a step'), 'submitEditing');
        fireEvent.changeText(screen.getByLabelText('Add a step'), 'Dashboard');
        fireEvent.press(screen.getByLabelText('Add step'));
        fireEvent.press(screen.getByText('By when'));
        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        fireEvent.press(screen.getByLabelText(`Choose ${date}`));

        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        const spec = JSON.parse(saved().goalSpec);
        expect(spec.kind).toBe('complete');
        expect(spec.milestones.map((step: { title: string }) => step.title)).toEqual(['Onboarding', 'Dashboard']);
    });

    it('keeps a unit the user picked over the one it read', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Read 300 pages this month');
        // The chip reads as the target it holds once it has one.
        fireEvent.press(screen.getByLabelText('Target, 300 Pages'));
        fireEvent.press(screen.getByLabelText('Choose target unit'));
        fireEvent.press(screen.getByLabelText('Unit Books'));

        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        await waitFor(() => expect(addHabit).toHaveBeenCalled());
        expect(JSON.parse(saved().goalSpec)).toMatchObject({ direction: 'at_least', target: 300, metric_unit: 'books' });
    });

    it('highlights the date inside the input without changing the sentence', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Launch Habyss by January 1');
        expect(within(screen.getByLabelText('Describe your goal')).getByText('January 1')).toHaveStyle({ color: '#00b9e8' });
        write(screen, 'Launch Habyss by');
        expect(screen.queryByText('January 1')).toBeNull();
        await act(async () => {});
    });

    it('opens the calendar immediately and saves the chosen date', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Read 12 books');
        fireEvent.press(screen.getByLabelText('By when'));
        expect(screen.getByTestId('goal-calendar')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Next month'));
        const next = new Date();
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        const date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
        fireEvent.press(screen.getByLabelText(`Choose ${date}`));
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        expect(saved()).toMatchObject({ targetDate: date, goalValue: 12, unit: 'books' });
    });

    it('only shows unit choices after tapping Unit and keeps the number when a unit changes', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Save 500 dollars this month');
        fireEvent.press(screen.getByLabelText('Target, 500 USD'));
        expect(screen.queryByTestId('goal-unit-picker')).toBeNull();
        expect(screen.queryByText('At least')).toBeNull();
        expect(screen.queryByText('At most')).toBeNull();
        expect(screen.queryByText('Reach')).toBeNull();
        fireEvent.press(screen.getByLabelText('Choose target unit'));
        expect(screen.getByTestId('goal-unit-picker')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Unit EUR'));
        expect(screen.queryByTestId('goal-unit-picker')).toBeNull();
        expect(screen.getByLabelText('Target number').props.value).toBe('500');
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        expect(saved()).toMatchObject({ goalValue: 500, unit: 'euros' });
    });


    it('finds units by name and preserves a decimal amount', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Run 5 km this month');
        fireEvent.press(screen.getByLabelText('Target, 5 Km'));
        fireEvent.changeText(screen.getByLabelText('Target number'), '5.');
        expect(screen.getByLabelText('Target number').props.value).toBe('5.');
        fireEvent.changeText(screen.getByLabelText('Target number'), '5.5');
        fireEvent.press(screen.getByLabelText('Choose target unit'));
        fireEvent.changeText(screen.getByLabelText('Search units'), 'miles');
        expect(screen.queryByLabelText('Unit Books')).toBeNull();
        fireEvent.press(screen.getByLabelText('Unit Miles'));
        expect(screen.getByLabelText('Target number').props.value).toBe('5.5');
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        expect(JSON.parse(saved().goalSpec)).toMatchObject({ target: 5.5, metric_unit: 'mi' });
    });

    it('requires a finish date instead of saving recurring goals', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Run 5 km every week');
        fireEvent.press(screen.getByText('Add a finish date'));
        expect(screen.queryByText('Every day')).toBeNull();
        expect(screen.queryByText('Every week')).toBeNull();
        expect(screen.queryByText('Every month')).toBeNull();
        expect(screen.getByTestId('goal-calendar')).toBeTruthy();
        expect(addHabit).not.toHaveBeenCalled();
        await act(async () => {});
    });

    it('takes an emoji as the icon when one is typed', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Read 12 books this year');
        fireEvent.press(screen.getByLabelText('Look'));
        fireEvent.changeText(screen.getByLabelText('Search goal icons'), '🈯');
        fireEvent.press(screen.getByLabelText('Icon 🈯'));
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        expect(saved()).toMatchObject({ icon: '🈯' });
    });

    it('searches icons and saves an exact custom color', async () => {
        const screen = render(<GoalSheet visible />);
        write(screen, 'Read 12 books this year');
        fireEvent.press(screen.getByLabelText('Look'));
        fireEvent.changeText(screen.getByLabelText('Search goal icons'), 'travel');
        fireEvent.press(screen.getByLabelText('Icon Airplane'));
        fireEvent.press(screen.getByLabelText('Goal color'));
        fireEvent.press(screen.getByLabelText('Color Pink'));
        fireEvent.press(screen.getByLabelText('Any colour'));
        fireEvent.changeText(screen.getByLabelText('Exact hex color'), '#123456');
        fireEvent.press(screen.getByLabelText('Apply hex color'));
        await act(async () => { fireEvent.press(screen.getByText('Create goal')); });
        expect(saved()).toMatchObject({ icon: 'airplane-outline', color: '#123456' });
    });

});
