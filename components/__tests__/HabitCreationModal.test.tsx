import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HabitCreationModal } from '../HabitCreationModal';
import { addHabit, getHabits, getGoals, subscribeToHabits, updateHabit } from '@/lib/habitsSQLite';
import { NotificationService } from '@/lib/notificationService';
import type { Habit } from '@/lib/habitsSQLite';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/hooks/useHaptics', () => ({ useHaptics: () => ({ mediumFeedback: jest.fn(), selectionFeedback: jest.fn(), successFeedback: jest.fn() }) }));
jest.mock('@/hooks/usePremiumStatus', () => ({ usePremiumStatus: () => ({ isPremium: true }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@/lib/habitsSQLite', () => ({ addHabit: jest.fn(), updateHabit: jest.fn(), getHabits: jest.fn(), getGoals: jest.fn(), subscribeToHabits: jest.fn() }));
jest.mock('@/lib/calendarService', () => ({ CalendarService: {} }));
jest.mock('@/lib/notificationService', () => ({ NotificationService: { requestPermissions: jest.fn(), requestLocationPermissions: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-gesture-handler', () => {
    const View = require('react-native').View;
    return { GestureHandlerRootView: View, GestureDetector: View, Gesture: { Pan: () => {
        const gesture = { enabled: () => gesture, onUpdate: () => gesture, onEnd: () => gesture };
        return gesture;
    } } };
});
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
// These tests exercise form state, not native worklet/animation execution.
jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    const animation = { duration: () => animation, easing: () => animation };
    return {
        __esModule: true, default: { View },
        useSharedValue: (value: number) => require('react').useRef({ value }).current,
        useAnimatedStyle: (style: () => unknown) => style(),
        withTiming: (value: number) => value, runOnJS: (fn: unknown) => fn,
        interpolate: () => 1, Extrapolation: { CLAMP: 'clamp' },
        Easing: { out: (fn: unknown) => fn, in: (fn: unknown) => fn, cubic: (x: number) => x },
        FadeIn: animation, FadeOut: animation, SlideInDown: animation, SlideOutDown: animation,
    };
});

describe('low-friction habit creation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getHabits as jest.Mock).mockResolvedValue([]);
        (getGoals as jest.Mock).mockResolvedValue([]);
        (subscribeToHabits as jest.Mock).mockResolvedValue(jest.fn());
        (addHabit as jest.Mock).mockResolvedValue({ id: 'new' });
        (updateHabit as jest.Mock).mockResolvedValue(undefined);
        (NotificationService.requestPermissions as jest.Mock).mockResolvedValue(true);
    });

    it('creates a habit using only a name, without permissions or advanced fields', async () => {
        const onSuccess = jest.fn();
        const screen = render(<HabitCreationModal visible onSuccess={onSuccess} listenToGlobalEvents={false} />);
        expect(await screen.findByLabelText('Habit name')).toBeTruthy();
        expect(screen.queryByText('Life area')).toBeNull();
        fireEvent.changeText(screen.getByLabelText('Habit name'), 'Read a page');
        fireEvent.press(screen.getByText('Create habit'));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(addHabit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Read a page', frequency: 'daily', goalValue: 1, reminders: [], locationReminders: [], startTime: undefined }));
        expect(NotificationService.requestPermissions).not.toHaveBeenCalled();
        expect(NotificationService.requestLocationPermissions).not.toHaveBeenCalled();
    });

    it('requests permission only when the time-reminder toggle is enabled', async () => {
        const screen = render(<HabitCreationModal visible listenToGlobalEvents={false} />);
        fireEvent.press(await screen.findByText('Add a reminder'));
        expect(NotificationService.requestPermissions).not.toHaveBeenCalled();
        await act(async () => { fireEvent.press(screen.getByText('At a time')); });
        expect(NotificationService.requestPermissions).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('Remind me at')).toBeTruthy();
    });

    it('does not create duplicate habits from rapid taps', async () => {
        let finish!: (habit: { id: string }) => void;
        (addHabit as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const screen = render(<HabitCreationModal visible listenToGlobalEvents={false} />);
        fireEvent.changeText(await screen.findByLabelText('Habit name'), 'Walk');
        const button = screen.getByText('Create habit');
        fireEvent.press(button);
        fireEvent.press(button);
        expect(addHabit).toHaveBeenCalledTimes(1);
        await act(async () => { finish({ id: 'new' }); });
    });

    it('keeps the form usable after a failed save', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (addHabit as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
        const screen = render(<HabitCreationModal visible listenToGlobalEvents={false} />);
        fireEvent.changeText(await screen.findByLabelText('Habit name'), 'Walk');
        await act(async () => { fireEvent.press(screen.getByText('Create habit')); });
        expect(alert).toHaveBeenCalledWith('Error', 'Storage unavailable');
        await act(async () => { fireEvent.press(screen.getByText('Create habit')); });
        expect(addHabit).toHaveBeenCalledTimes(2);
        alert.mockRestore(); error.mockRestore();
    });

    it('preserves an existing date-only schedule and reminder offset during an ordinary edit', async () => {
        const initialHabit = { id: 'existing', name: 'Read', category: 'mind', frequency: 'daily', startDate: '2026-09-16', reminders: ['09:00'], reminderOffset: 15 } as Habit;
        const screen = render(<HabitCreationModal visible initialHabit={initialHabit} listenToGlobalEvents={false} />);
        await screen.findByLabelText('Habit name');
        await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
        expect(updateHabit).toHaveBeenCalledWith(expect.objectContaining({ id: 'existing', startDate: '2026-09-16', reminders: ['09:00'], reminderOffset: 15 }));
    });
});
