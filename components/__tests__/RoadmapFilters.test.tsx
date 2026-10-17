import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoadmapFilters } from '../Home/RoadmapFilters';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8' }) }));
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
    shown: { goals: true, habits: true, tasks: true },
    onToggleShown: jest.fn(),
    focus: 'all' as const,
    onFocus: jest.fn(),
    goal: null,
    onGoal: jest.fn(),
    sharedOnly: false,
    onSharedOnly: jest.fn(),
    order: 'default' as const,
    direction: 1 as const,
    onOrder: jest.fn(),
    onReset: jest.fn(),
    ...over,
});

describe('the roadmap filter menu', () => {
    it('shows every choice at once, without a page of its own', () => {
        const screen = render(<RoadmapFilters {...props()} />);
        for (const label of ['Goals', 'Habits', 'Tasks', 'Only shared', 'Morning', 'Noon', 'Evening', 'Created', 'Name', 'Progress']) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        // No per-goal row: the filter is about what kind of thing, and when.
        expect(screen.queryByText('Run 50 km in September')).toBeNull();
    });

    it('reports each choice to the screen behind it', () => {
        const onToggleShown = jest.fn();
        const onGoal = jest.fn();
        const onOrder = jest.fn();
        const screen = render(<RoadmapFilters {...props({ onToggleShown, onGoal, onOrder })} />);

        fireEvent.press(screen.getByText('Goals'));
        expect(onToggleShown).toHaveBeenCalledWith('goals');

        fireEvent.press(screen.getByText('Name'));
        expect(onOrder).toHaveBeenCalledWith('name');
    });

    it('offers Reset only when something is actually filtered', () => {
        const onReset = jest.fn();
        const clean = render(<RoadmapFilters {...props({ onReset })} />);
        // Nothing filtered: there is no Reset to press at all.
        expect(clean.queryByLabelText('Reset filters')).toBeNull();
        expect(onReset).not.toHaveBeenCalled();
        clean.unmount();

        const filtered = render(<RoadmapFilters {...props({ shown: { goals: false, habits: true, tasks: true }, onReset })} />);
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

describe('nothing chosen is how you say "no filter"', () => {
    it('offers no "All", "Any" or "Any goal" to spend a segment on', () => {
        const screen = render(<RoadmapFilters {...props()} />);
        for (const label of ['All', 'Any', 'Any goal', 'Everything']) {
            expect(screen.queryByText(label)).toBeNull();
        }
    });

    it('shows each kind as a switch that is lit while it is shown', () => {
        const screen = render(<RoadmapFilters {...props({ shown: { goals: false, habits: true, tasks: true } })} />);
        expect(screen.getByLabelText('Goals').props.accessibilityState).toEqual({ selected: false });
        expect(screen.getByLabelText('Tasks').props.accessibilityState).toEqual({ selected: true });
    });

    it('clears the time of day the same way', () => {
        const onFocus = jest.fn();
        const screen = render(<RoadmapFilters {...props({ focus: 'morning', onFocus })} />);
        fireEvent.press(screen.getByText('Morning'));
        expect(onFocus).toHaveBeenCalledWith('all');
    });

    it('still reverses the sort rather than clearing it', () => {
        // There is no unsorted list, so Sort is the one row where tapping the
        // chosen option has to mean something else.
        const onOrder = jest.fn();
        const screen = render(<RoadmapFilters {...props({ order: 'name', onOrder })} />);
        fireEvent.press(screen.getByText('Name'));
        expect(onOrder).toHaveBeenCalledWith('name');
    });
});

describe('filtering to what is shared', () => {
    it('offers it alongside the rest', () => {
        const screen = render(<RoadmapFilters {...props()} />);
        expect(screen.getByText('Only shared')).toBeTruthy();
    });

    it('reports the choice', () => {
        const onSharedOnly = jest.fn();
        const screen = render(<RoadmapFilters {...props({ onSharedOnly })} />);
        fireEvent.press(screen.getByText('Only shared'));
        expect(onSharedOnly).toHaveBeenCalledWith(true);
    });

    it('turns itself off the second time, being one toggle rather than two', () => {
        const onSharedOnly = jest.fn();
        const screen = render(<RoadmapFilters {...props({ sharedOnly: true, onSharedOnly })} />);
        fireEvent.press(screen.getByText('Only shared'));
        expect(onSharedOnly).toHaveBeenCalledWith(false);
    });

    it('counts as an active filter, so Reset lights up', () => {
        // Otherwise the one filter you cannot see the effect of is also the one
        // you cannot clear.
        const screen = render(<RoadmapFilters {...props({ sharedOnly: true })} />);
        expect(screen.getByLabelText('Reset filters').props.accessibilityState?.disabled).toBeFalsy();
    });
});
