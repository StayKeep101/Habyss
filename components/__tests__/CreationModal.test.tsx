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
    it('opens the existing habit editor once after choosing Habit', () => {
        const callback = jest.fn();
        const subscription = DeviceEventEmitter.addListener('show_habit_modal', callback);
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
    it('opens the existing goal flow after choosing Goal', () => {
        const push = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({ push });
        const screen = render(<CreationModal />);
        act(() => { DeviceEventEmitter.emit('show_creation_modal'); });
        fireEvent.press(screen.getByLabelText('Create goal'));
        act(() => { jest.runAllTimers(); });
        expect(push).toHaveBeenCalledWith('/create');
        expect(push).toHaveBeenCalledTimes(1);
        screen.unmount();
    });
});
