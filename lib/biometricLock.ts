import * as LocalAuthentication from 'expo-local-authentication';

/**
 * `ownPasscode`: Habyss has its own passcode (lib/appPasscode.ts), so the
 * prompt's fallback opens Habyss's keypad (error 'user_fallback') instead of
 * iOS's passcode screen. Without one, the iPhone passcode is the fallback.
 */
export async function authenticateAppLock(promptMessage = 'Unlock Habyss', ownPasscode = false): Promise<LocalAuthentication.LocalAuthenticationResult> {
    try {
        // Missing enrollment must never silently unlock an already-protected
        // app; only a successful OS result can.
        return await LocalAuthentication.authenticateAsync({
            promptMessage, cancelLabel: 'Cancel', fallbackLabel: ownPasscode ? 'Use passcode' : 'Use device passcode',
            disableDeviceFallback: ownPasscode, biometricsSecurityLevel: 'strong',
        });
    } catch {
        return { success: false, error: 'not_available' };
    }
}

export async function verifyAppLockChange(enabled: boolean): Promise<boolean> {
    if (enabled) {
        const [hardware, enrolled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(),
        ]);
        if (!hardware || !enrolled) throw new Error('Set up Face ID or Touch ID in your device settings before enabling App Lock.');
    }
    const result = await authenticateAppLock(enabled ? 'Enable Habyss App Lock' : 'Turn off Habyss App Lock');
    if (result.success) return true;
    if (['user_cancel', 'system_cancel', 'app_cancel'].includes(result.error)) return false;
    throw new Error('Authentication did not succeed. App Lock has not been changed.');
}
