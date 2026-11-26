import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TimeRange } from '../Create/TimeRange';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8' }) }));

describe('the time picker', () => {
    it('sets a usual length in one tap, moving the end and never the start', () => {
        const onChange = jest.fn();
        const screen = render(<TimeRange start="09:30" minutes={20} accent="#6B8AF5" onChange={onChange} />);
        fireEvent.press(screen.getByLabelText('Takes 1 hr'));
        expect(onChange).toHaveBeenCalledWith({ start: '09:30', minutes: 60 });
        fireEvent.press(screen.getByLabelText('Takes 5 min'));
        expect(onChange).toHaveBeenLastCalledWith({ start: '09:30', minutes: 5 });
    });
    it('gives a length even with no start time', () => {
        const onChange = jest.fn();
        const screen = render(<TimeRange accent="#6B8AF5" onChange={onChange} />);
        fireEvent.press(screen.getByLabelText('Takes 30 min'));
        expect(onChange).toHaveBeenCalledWith({ start: undefined, minutes: 30 });
    });
});
