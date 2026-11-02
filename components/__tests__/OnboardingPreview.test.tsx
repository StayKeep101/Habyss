import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import OnboardingScreen from '../../app/(auth)/onboarding';
import { setOnboardingComplete } from '@/lib/localUser';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => ({ preview: '1' }),
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8', buttonColors: ['#00b9e8', '#0066ff'] }) }));
jest.mock('@/hooks/useHaptics', () => ({ useHaptics: () => ({ lightFeedback: jest.fn(), successFeedback: jest.fn(), selectionFeedback: jest.fn(), mediumFeedback: jest.fn() }) }));
jest.mock('@/lib/localUser', () => ({ setOnboardingComplete: jest.fn() }));
jest.mock('@/context/AppSettingsContext', () => ({ useAppSettings: () => ({ setAIPersonality: jest.fn(), setNotificationsEnabled: jest.fn(async () => undefined) }) }));
jest.mock('@/lib/notificationService', () => ({ NotificationService: { requestPermissions: jest.fn(async () => true), refreshReminders: jest.fn(async () => undefined) } }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

it('test mode opens on Echo in the dark, and closing it saves nothing and goes back to Settings', async () => {
    const screen = render(<OnboardingScreen />);
    expect(screen.getByLabelText('In the dark.')).toBeTruthy();
    // Preview has no "I already have an account": it would leave the test run.
    expect(screen.queryByText('I already have an account')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByLabelText('Close preview')); });
    expect(mockRouter.replace).toHaveBeenCalledWith('/(root)/(tabs)/settings');
    expect(setOnboardingComplete).not.toHaveBeenCalled();
});
