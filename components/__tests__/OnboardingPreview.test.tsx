import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import OnboardingScreen from '../../app/(auth)/onboarding';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => ({ preview: '1' }),
    useFocusEffect: (effect: () => void) => { const React = require('react'); React.useEffect(effect, []); },
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8', buttonColors: ['#00b9e8', '#0066ff'] }) }));
jest.mock('@/context/AppSettingsContext', () => ({ useAppSettings: () => ({ setAIPersonality: jest.fn() }) }));
jest.mock('@/hooks/useHaptics', () => ({ useHaptics: () => ({ lightFeedback: jest.fn(), successFeedback: jest.fn(), selectionFeedback: jest.fn(), mediumFeedback: jest.fn() }) }));
jest.mock('@/components/Auth/SignInOptions', () => ({ SignInOptions: () => null }));
jest.mock('@/lib/account', () => ({ currentAccount: jest.fn(async () => null), onAccountChange: () => () => undefined }));
jest.mock('@/lib/localUser', () => ({ setOnboardingComplete: jest.fn() }));

it('test mode opens on the welcome screen and climbs to the name question', async () => {
    const screen = render(<OnboardingScreen />);
    expect(screen.getByText('Start climbing')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Start climbing')); });
    expect(screen.getByText('What’s your name?')).toBeTruthy();
});
