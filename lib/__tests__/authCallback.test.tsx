import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

let mockParams: Record<string, string> = {};
let mockURL: string | null = null;
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockComplete = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter }));
jest.mock('expo-linking', () => ({ useURL: () => mockURL }));
jest.mock('../socialSignIn', () => ({ GOOGLE_REDIRECT: 'habyss://auth-callback', completeOAuthSignIn: (url: string) => mockComplete(url) }));
jest.mock('@/components/Layout/SheetScreen', () => ({ SheetScreen: ({ children }: any) => children }));
jest.mock('@/components/Common/AppButton', () => ({ AppButton: () => null }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
import AuthCallback from '../../app/auth-callback';

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; mockURL = null; });

it('handles a cold-start email code from router parameters', async () => {
    mockParams = { code: 'email-pkce' };
    mockComplete.mockResolvedValue({ ok: true, value: {} });
    render(<AuthCallback />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(root)/(tabs)/community'));
    expect(mockComplete).toHaveBeenCalledWith('habyss://auth-callback?code=email-pkce');
});

it('preserves the error fragment that router parameters omit', async () => {
    mockURL = 'habyss://auth-callback#error=access_denied&error_description=Expired';
    mockComplete.mockResolvedValue({ ok: false, error: 'Expired' });
    const screen = render(<AuthCallback />);
    await waitFor(() => expect(screen.getByText('Expired')).toBeTruthy());
    expect(mockComplete).toHaveBeenCalledWith(mockURL);
    expect(mockReplace).not.toHaveBeenCalled();
});

it('shows an incomplete link error instead of spinning forever', async () => {
    mockComplete.mockResolvedValue({ ok: false, error: 'This sign-in link is incomplete.' });
    const screen = render(<AuthCallback />);
    await waitFor(() => expect(screen.getByText('This sign-in link is incomplete.')).toBeTruthy());
});
