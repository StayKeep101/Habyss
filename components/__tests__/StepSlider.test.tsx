import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StepSlider } from '@/components/ui/StepSlider';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', buttonColors: ['#6B8AF5', '#4F6FE0'] }) }));

it('says its value, and VoiceOver moves it a step at a time', () => {
    const onChange = jest.fn();
    const screen = render(<StepSlider label="How long" values={[3, 7, 14] as const} value={7} onChange={onChange} say={value => `${value} days`} />);
    expect(screen.getByText('7 days')).toBeTruthy();
    const slider = screen.getByLabelText('How long');
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenCalledWith(14);
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenCalledWith(3);
});
