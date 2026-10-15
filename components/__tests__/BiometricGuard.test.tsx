import React from 'react';
import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

const mockSettings = { isLoaded: true, isAppLockEnabled: true, appLockVerifiedAt: 0 };
jest.mock('@/context/AppSettingsContext', () => ({ useAppSettings: () => mockSettings }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/lib/biometricLock', () => ({ authenticateAppLock: jest.fn() }));
jest.mock('@/components/ui/VoidShell', () => ({ VoidShell: ({ children }: any) => children }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/components/ui/AppButton', () => ({ AppButton: ({ label, onPress }: any) => {
    const { Text } = require('react-native'); return <Text onPress={onPress}>{label}</Text>;
} }));
import { authenticateAppLock } from '@/lib/biometricLock';
import { BiometricGuard } from '@/components/Auth/BiometricGuard';
let changeState: (value: string) => void;
beforeEach(() => {
    jest.clearAllMocks();
    mockSettings.isLoaded = true; mockSettings.isAppLockEnabled = true; mockSettings.appLockVerifiedAt = 0;
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_name: string, listener: any) => { changeState = listener; return { remove: jest.fn() }; }) as any);
});
const screen = () => render(<BiometricGuard><Text>Private habits</Text></BiometricGuard>);
it('hides private content while saved settings load', () => {
    mockSettings.isLoaded = false;
    expect(screen().queryByText('Private habits')).toBeNull();
    expect(authenticateAppLock).not.toHaveBeenCalled();
});
it('requires a successful result on cold launch and keeps cancellation locked', async () => {
    (authenticateAppLock as jest.Mock).mockResolvedValueOnce({ success: false, error: 'user_cancel' }).mockResolvedValueOnce({ success: true });
    const view = screen();
    await waitFor(() => expect(view.getByLabelText('Unlock Habyss')).toBeTruthy());
    expect(view.queryByText('Private habits')).toBeNull();
    fireEvent.press(view.getByLabelText('Unlock Habyss'));
    await waitFor(() => expect(view.getByText('Private habits')).toBeTruthy());
});
it('relocks after even a brief trip to the background', async () => {
    (authenticateAppLock as jest.Mock).mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    const view = screen();
    await waitFor(() => expect(view.getByText('Private habits')).toBeTruthy());
    act(() => { changeState('inactive'); changeState('background'); changeState('active'); });
    await waitFor(() => expect(view.getByLabelText('Unlock Habyss')).toBeTruthy());
    expect(authenticateAppLock).toHaveBeenCalledTimes(2);
});
it('does not reauthenticate for an inactive-only system sheet', async () => {
    (authenticateAppLock as jest.Mock).mockResolvedValue({ success: true });
    const view = screen();
    await waitFor(() => expect(view.getByText('Private habits')).toBeTruthy());
    act(() => { changeState('inactive'); changeState('active'); });
    expect(authenticateAppLock).toHaveBeenCalledTimes(1);
});
it('uses the successful verification when the switch was just enabled', () => {
    mockSettings.appLockVerifiedAt = 123;
    expect(screen().getByText('Private habits')).toBeTruthy();
    expect(authenticateAppLock).not.toHaveBeenCalled();
});
