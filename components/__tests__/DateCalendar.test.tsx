import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DateCalendar } from '../Create/DateCalendar';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('date calendar navigation', () => {
    it('jumps directly to a month and year, including leap day', async () => {
        const onChange = jest.fn();
        const screen = render(<DateCalendar value="2028-01-01" onChange={onChange} accent="#00b9e8" />);
        fireEvent.press(screen.getByLabelText('Choose month and year'));
        fireEvent.changeText(screen.getByLabelText('Calendar year'), '2028');
        fireEvent.press(screen.getByLabelText('Show Feb 2028'));
        fireEvent.press(screen.getByLabelText('Choose 2028-02-29'));
        expect(onChange).toHaveBeenCalledWith('2028-02-29');
        await act(async () => {});
    });

    it('changes month by swiping, with no arrows', async () => {
        const screen = render(<DateCalendar value="2028-01-01" onChange={jest.fn()} accent="#00b9e8" />);
        expect(screen.queryByLabelText('Next month')).toBeNull();
        const grid = screen.getByTestId('calendar-viewport');
        fireEvent(grid, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
        expect(screen.getByText('February 2028')).toBeTruthy();
        fireEvent(screen.getByTestId('calendar-viewport'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
        expect(screen.getByText('January 2028')).toBeTruthy();
        await act(async () => {});
    });

    it('rejects invalid years and can return to the current month', async () => {
        const screen = render(<DateCalendar value="2028-01-01" onChange={jest.fn()} accent="#00b9e8" />);
        fireEvent.press(screen.getByLabelText('Choose month and year'));
        fireEvent.changeText(screen.getByLabelText('Calendar year'), '12');
        expect(screen.getByLabelText('Show Jan 12')).toBeDisabled();
        fireEvent.changeText(screen.getByLabelText('Calendar year'), '2028');
        fireEvent.press(screen.getByLabelText('Show Jan 2028'));
        fireEvent.press(screen.getByLabelText('Go to current month'));
        expect(screen.getByText(new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))).toBeTruthy();
        await act(async () => {});
    });
});
