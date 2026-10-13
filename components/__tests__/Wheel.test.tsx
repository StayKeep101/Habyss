import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Wheel } from '../Common/Wheel';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

const options = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
];

describe('a wheel', () => {
    it('marks the one it is showing, and only that one', () => {
        const screen = render(<Wheel options={options} value="weekly" onChange={jest.fn()} />);
        expect(screen.getByLabelText('Weekly').props.accessibilityState).toEqual({ selected: true });
        expect(screen.getByLabelText('Daily').props.accessibilityState).toEqual({ selected: false });
    });

    it('can be tapped as well as turned', () => {
        // What a UIPickerView does, and the only way somebody using a screen
        // reader can reach a row that is not already in the middle.
        const onChange = jest.fn();
        const screen = render(<Wheel options={options} value="daily" onChange={onChange} />);
        fireEvent.press(screen.getByLabelText('Monthly'));
        expect(onChange).toHaveBeenCalledWith('monthly');
    });

    it('does not report the row that is already chosen', () => {
        const onChange = jest.fn();
        const screen = render(<Wheel options={options} value="daily" onChange={onChange} />);
        fireEvent.press(screen.getByLabelText('Daily'));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('shows a value it does not have as the first row rather than nothing', () => {
        const screen = render(<Wheel options={options} value="nonsense" onChange={jest.fn()} />);
        expect(screen.getByLabelText('Daily').props.accessibilityState).toEqual({ selected: true });
    });
});
