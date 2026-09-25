jest.mock('expo-local-authentication', () => ({
    hasHardwareAsync: jest.fn(async () => true),
    isEnrolledAsync: jest.fn(async () => true),
    authenticateAsync: jest.fn(async () => ({ success: true })),
}));
import * as LocalAuthentication from 'expo-local-authentication';
import { authenticateAppLock, verifyAppLockChange } from '../biometricLock';

beforeEach(() => jest.clearAllMocks());

describe('App Lock', () => {
    it('verifies the owner before enabling or disabling the switch', async () => {
        expect(await verifyAppLockChange(true)).toBe(true);
        expect(await verifyAppLockChange(false)).toBe(true);
        expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
    });
    it('refuses to enable without enrolled biometrics', async () => {
        (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);
        await expect(verifyAppLockChange(true)).rejects.toThrow('Set up Face ID or Touch ID');
        expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    });
    it('leaves the preference unchanged when the user cancels', async () => {
        (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: false, error: 'user_cancel' });
        expect(await verifyAppLockChange(true)).toBe(false);
    });
    it('never silently unlocks when hardware or enrollment becomes unavailable', async () => {
        (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: false, error: 'not_enrolled' });
        expect(await authenticateAppLock()).toEqual({ success: false, error: 'not_enrolled' });
        expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: false, biometricsSecurityLevel: 'strong' }));
    });
    it('fails closed on native authentication errors', async () => {
        (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValueOnce(new Error('Native module unavailable'));
        expect((await authenticateAppLock()).success).toBe(false);
    });
});
