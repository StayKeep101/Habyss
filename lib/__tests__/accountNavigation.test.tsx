import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRouter = { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', buttonColors: ['#00b9e8', '#0066ff'] }) }));
jest.mock('@/hooks/useHaptics', () => ({ useHaptics: () => ({ lightFeedback: jest.fn(), successFeedback: jest.fn() }) }));
jest.mock('@/components/Layout/SheetScreen', () => {
    const { View, Button } = require('react-native');
    return { SheetScreen: ({ onBack, children }: any) => <View><Button title="Back" onPress={onBack} />{children}</View> };
});
jest.mock('@/components/Auth/SignInOptions', () => ({ SignInOptions: () => null }));
jest.mock('@/lib/account', () => ({
    currentAccount: jest.fn(async () => ({ id: 'user', email: 'signed-in@example.com' })),
    onAccountChange: () => () => undefined,
}));
jest.mock('@/lib/cloudSync', () => ({ lastSyncedAt: jest.fn(async () => null) }));
jest.mock('@/lib/supabase', () => ({ isCloudConfigured: () => true }));
jest.mock('@/lib/localUser', () => ({ setOnboardingComplete: jest.fn() }));
jest.mock('@/lib/accountDeletion', () => ({ restartAfterDeletion: jest.fn() }));
import AccountScreen from '../../app/(root)/account';

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; mockRouter.canGoBack.mockReturnValue(false); });

it('leaves a signed-in account opened with no history without dispatching GO_BACK', async () => {
    const screen = render(<AccountScreen />);
    await waitFor(() => expect(screen.getByText('signed-in@example.com')).toBeTruthy());
    fireEvent.press(screen.getByText('Back'));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(root)/(tabs)/home');
});

it('returns a cold-start restore flow to onboarding when no previous screen exists', async () => {
    mockParams = { restore: '1' };
    const screen = render(<AccountScreen />);
    await waitFor(() => expect(screen.getByText('signed-in@example.com')).toBeTruthy());
    fireEvent.press(screen.getByText('Back'));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/onboarding');
});

it('preserves normal back navigation when Account was pushed from another screen', async () => {
    mockRouter.canGoBack.mockReturnValue(true);
    const screen = render(<AccountScreen />);
    await waitFor(() => expect(screen.getByText('signed-in@example.com')).toBeTruthy());
    fireEvent.press(screen.getByText('Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
});
