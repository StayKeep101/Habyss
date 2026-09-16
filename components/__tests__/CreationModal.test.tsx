import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { CreationModal } from '../CreationModal';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8' }) }));
jest.mock('@/hooks/useResponsiveLayout', () => ({ useResponsiveLayout: () => ({ horizontalPadding: 20, floatingButtonSize: 60, tabBarBottomOffset: 24 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

describe('floating creation actions', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
    it('opens quick add once after choosing Habit', () => {
        const callback = jest.fn();
        // Creating a habit goes to quick add; the detailed form is for editing.
        const subscription = DeviceEventEmitter.addListener('show_quick_add', callback);
        const screen = render(<CreationModal />);
        act(() => { DeviceEventEmitter.emit('show_creation_modal'); });
        expect(screen.getByLabelText('Create goal')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Create habit'));
        expect(callback).not.toHaveBeenCalled();
        act(() => { jest.runAllTimers(); });
        expect(callback).toHaveBeenCalledTimes(1);
        subscription.remove();
        screen.unmount();
    });
    it('opens the goal parser once after choosing Goal', () => {
        const callback = jest.fn();
        // Goals are parsed into a calculable target first; the step-by-step
        // wizard is still reachable from inside that sheet.
        const subscription = DeviceEventEmitter.addListener('show_goal_quick_add', callback);
        const screen = render(<CreationModal />);
        act(() => { DeviceEventEmitter.emit('show_creation_modal'); });
        fireEvent.press(screen.getByLabelText('Create goal'));
        expect(callback).not.toHaveBeenCalled();
        act(() => { jest.runAllTimers(); });
        expect(callback).toHaveBeenCalledTimes(1);
        subscription.remove();
        screen.unmount();
    });
});
