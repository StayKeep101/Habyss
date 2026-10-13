import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { CreationModal } from '@/components/Create/CreationModal';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({
    useAccentGradient: () => ({ primary: '#00b9e8', buttonColors: ['#00b9e8', '#0077b6'], shadowColor: '#00b9e8' }),
}));
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
        // At once, not after the menu has finished leaving: waiting for it
        // was most of a second between the tap and a keyboard.
        expect(callback).toHaveBeenCalledTimes(1);
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
        // At once, not after the menu has finished leaving: waiting for it
        // was most of a second between the tap and a keyboard.
        expect(callback).toHaveBeenCalledTimes(1);
        act(() => { jest.runAllTimers(); });
        expect(callback).toHaveBeenCalledTimes(1);
        subscription.remove();
        screen.unmount();
    });
});

describe('the plus button and the menu are one object', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it('opens where the button reported itself, not at a guessed corner', () => {
        const screen = render(<CreationModal />);
        act(() => { DeviceEventEmitter.emit('show_creation_modal', { x: 300, y: 700, size: 60 }); });
        const stack = screen.getByLabelText('Create goal').parent;
        expect(stack).toBeTruthy();
        // The close control sits on the button's own spot.
        expect(screen.getByLabelText('Close creation menu')).toBeTruthy();
        screen.unmount();
    });

    it('closes without opening anything when the menu is dismissed', () => {
        const habit = jest.fn();
        const subscription = DeviceEventEmitter.addListener('show_quick_add', habit);
        const screen = render(<CreationModal />);
        act(() => { DeviceEventEmitter.emit('show_creation_modal', { x: 300, y: 700, size: 60 }); });
        fireEvent.press(screen.getAllByLabelText('Close creation menu')[0]);
        act(() => { jest.runAllTimers(); });
        expect(habit).not.toHaveBeenCalled();
        subscription.remove();
        screen.unmount();
    });
});
