import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoadmapFilters } from '../Home/RoadmapFilters';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8' }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

const goals = [
    { id: 'g1', name: 'Run 50 km in September' },
    { id: 'g2', name: 'Launch the app' },
] as Habit[];

const props = (over: Partial<React.ComponentProps<typeof RoadmapFilters>> = {}) => ({
    visible: true,
    onClose: jest.fn(),
    goals,
    anchor: { x: 24, y: 120, width: 90, height: 28 },
    show: 'all' as const,
    onShow: jest.fn(),
    focus: 'all' as const,
    onFocus: jest.fn(),
    goal: null,
    onGoal: jest.fn(),
    order: 'default' as const,
    direction: 1 as const,
    onOrder: jest.fn(),
    onReset: jest.fn(),
    ...over,
});

describe('the roadmap filter menu', () => {
    it('shows every choice at once, without a page of its own', () => {
        const screen = render(<RoadmapFilters {...props()} />);
        for (const label of ['All', 'Goals', 'Habits', 'Any', 'Morning', 'Created', 'Name', 'Progress', 'Any goal']) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        // Goals are listed to filter by, with an "All" that clears it.
        expect(screen.getByText('Run 50 km in September')).toBeTruthy();
    });

    it('reports each choice to the screen behind it', () => {
        const onShow = jest.fn();
        const onGoal = jest.fn();
        const onOrder = jest.fn();
        const screen = render(<RoadmapFilters {...props({ onShow, onGoal, onOrder })} />);

        fireEvent.press(screen.getByText('Habits'));
        expect(onShow).toHaveBeenCalledWith('habits_only');

        fireEvent.press(screen.getByText('Launch the app'));
        expect(onGoal).toHaveBeenCalledWith('g2');

        fireEvent.press(screen.getByText('Name'));
        expect(onOrder).toHaveBeenCalledWith('name');
    });

    it('clears the goal filter by choosing it again', () => {
        const onGoal = jest.fn();
        const screen = render(<RoadmapFilters {...props({ goal: 'g1', onGoal })} />);
        fireEvent.press(screen.getByText('Run 50 km in September'));
        expect(onGoal).toHaveBeenCalledWith(null);
    });

    it('offers Reset only when something is actually filtered', () => {
        const onReset = jest.fn();
        const clean = render(<RoadmapFilters {...props({ onReset })} />);
        fireEvent.press(clean.getByLabelText('Reset filters'));
        expect(onReset).not.toHaveBeenCalled();
        clean.unmount();

        const filtered = render(<RoadmapFilters {...props({ show: 'goals_only', onReset })} />);
        fireEvent.press(filtered.getByLabelText('Reset filters'));
        expect(onReset).toHaveBeenCalled();
    });

    it('closes when you tap away from it', () => {
        const onClose = jest.fn();
        const screen = render(<RoadmapFilters {...props({ onClose })} />);
        // The scrim is hidden from screen readers by the menu's modal semantics.
        fireEvent.press(screen.getByTestId('filter-scrim', { includeHiddenElements: true }));
        expect(onClose).toHaveBeenCalled();
    });

    it('renders nothing while closed', () => {
        const screen = render(<RoadmapFilters {...props({ visible: false })} />);
        expect(screen.queryByText('Filter')).toBeNull();
    });
});
