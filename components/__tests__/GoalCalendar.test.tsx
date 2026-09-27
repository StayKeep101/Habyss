import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { GoalCalendar } from '../Create/GoalCalendar';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('goal calendar navigation', () => {
    it('jumps directly to a month and year, including leap day', async () => {
        const onChange = jest.fn();
        const screen = render(<GoalCalendar value="2028-01-01" onChange={onChange} accent="#00b9e8" />);
        fireEvent.press(screen.getByLabelText('Choose month and year'));
        fireEvent.changeText(screen.getByLabelText('Calendar year'), '2028');
        fireEvent.press(screen.getByLabelText('Show Feb 2028'));
        fireEvent.press(screen.getByLabelText('Choose 2028-02-29'));
        expect(onChange).toHaveBeenCalledWith('2028-02-29');
        await act(async () => {});
    });

    it('moves forward and backward when the horizontal pager settles', async () => {
        const screen = render(<GoalCalendar value="2028-01-01" onChange={jest.fn()} accent="#00b9e8" />);
        fireEvent(screen.getByTestId('calendar-viewport'), 'layout', { nativeEvent: { layout: { width: 350 } } });
        fireEvent(screen.getByLabelText('Swipe calendar month'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 700 } } });
        expect(screen.getByText('February 2028')).toBeTruthy();
        fireEvent(screen.getByLabelText('Swipe calendar month'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0 } } });
        expect(screen.getByText('January 2028')).toBeTruthy();
        await act(async () => {});
    });

    it('rejects invalid years and can return to the current month', async () => {
        const screen = render(<GoalCalendar value="2028-01-01" onChange={jest.fn()} accent="#00b9e8" />);
        fireEvent.press(screen.getByLabelText('Choose month and year'));
        fireEvent.changeText(screen.getByLabelText('Calendar year'), '12');
        expect(screen.getByLabelText('Show Jan 12')).toBeDisabled();
        fireEvent.press(screen.getByLabelText('Go to current month'));
        expect(screen.getByText(new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))).toBeTruthy();
        expect(screen.getByLabelText('Previous month')).toBeDisabled();
        await act(async () => {});
    });
});
